"""Split reviewed card scans and mask printed content without generating artwork.

Requires `djpeg` (libjpeg); all remaining processing uses Python's standard library.
Run available source batches: python3 scripts/extract-gear-art.py
Run selected batches: python3 scripts/extract-gear-art.py --batch epson-210624
Completed batch assets remain valid after their source scans are removed.
Every extraction checks the original scan and preserves retained artwork pixels.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[1]


def png(path, width, height, pixels):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    stride = width * 4
    rows = b''.join(b'\0' + pixels[y * stride:(y + 1) * stride] for y in range(height))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                    + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                    + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


def inside_rect(x, y, rect):
    left, top, right, bottom = rect
    return left <= x < right and top <= y < bottom


def polygon_rows(points, width, height):
    """Rasterize a polygon at source-pixel centres, with no resampling."""
    mask = bytearray(width * height)
    for y in range(max(0, min(p[1] for p in points)), min(height, max(p[1] for p in points))):
        crossings = []
        for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
            if min(y1, y2) <= y + 0.5 < max(y1, y2):
                crossings.append(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1))
        crossings.sort()
        for left, right in zip(crossings[::2], crossings[1::2]):
            lo, hi = max(0, math.ceil(left - 0.5)), min(width, math.ceil(right - 0.5))
            mask[y * width + lo:y * width + hi] = b'\1' * (hi - lo)
    return mask


def alpha_at(x, y, width, height, radius):
    if radius <= x < width - radius or radius <= y < height - radius:
        return 255
    cx = radius if x < radius else width - radius
    cy = radius if y < radius else height - radius
    # Antialias only the transparent rounded outer edge; RGB pixels remain exact.
    coverage = sum((x + (sx + 0.5) / 4 - cx) ** 2 + (y + (sy + 0.5) / 4 - cy) ** 2 <= radius ** 2
                   for sy in range(4) for sx in range(4))
    return round(255 * coverage / 16)


def extract(config_path):
    config = json.loads(config_path.read_text())
    batch = config['batch']
    out = ROOT / 'assets/gear-art' / batch
    docs = ROOT.parent / 'ato_docs/gear-art' / batch
    source = (ROOT / config['source']).resolve()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == config['sourceSha256'], 'Scan changed; review crop coordinates before extracting.'
    decoded = subprocess.run(['djpeg', str(source)], check=True, capture_output=True).stdout
    header, rgb = decoded.split(b'\n255\n', 1)
    width, height = map(int, header.splitlines()[1].split())
    assert [width, height] == config['sourceSize'] and len(rgb) == width * height * 3
    catalogue = json.loads((ROOT / 'data/generated/catalogue.json').read_text())
    definitions = {card['id']: card for card in catalogue['cards']}
    px, py, pw, ph = config['paperSample']
    results, images = [], []
    for card in config['cards']:
        face = next(face for face in definitions[card['definitionId']]['faces'] if face['id'] == card['faceId'])
        assert face['kind'] == 'gear' and face['name'] == card['name'] and face['printedIds'] == card['printedIds'], 'Catalogue mapping changed.'
        assert all(printed in face['printedIds'] for printed in card.get('sourcePrintedIds', [])), 'Printed scan identity mismatch.'
        left, top, cw, ch = card['crop']
        assert 0 <= left < left + cw <= width and 0 <= top < top + ch <= height
        original, cleaned, gray = (bytearray(cw * ch * 4) for _ in range(3))
        polygons = [polygon_rows(points, cw, ch) for points in card['artPolygons']]
        preserved = 0
        for y in range(ch):
            for x in range(cw):
                source_index = ((top + y) * width + left + x) * 3
                colour = rgb[source_index:source_index + 3]
                i = (y * cw + x) * 4
                alpha = alpha_at(x, y, cw, ch, config['cornerRadius'])
                original[i:i + 4] = colour + bytes([alpha])
                keep = any(inside_rect(x, y, rect) for rect in card['artRects']) or any(mask[y * cw + x] for mask in polygons)
                if any(inside_rect(x, y, rect) for rect in card['eraseRects']):
                    keep = False
                paper_index = ((py + y % ph) * width + px + x % pw) * 3
                paper = rgb[paper_index:paper_index + 3]
                if keep:
                    cleaned[i:i + 4] = colour + bytes([alpha])
                    assert cleaned[i:i + 3] == rgb[source_index:source_index + 3]
                    preserved += 1
                else:
                    cleaned[i:i + 4] = paper + bytes([alpha])
                # The app renders all titles, icons and rules as live UI.
                r, g, b = cleaned[i:i + 3]
                luminance = round(0.2126 * r + 0.7152 * g + 0.0722 * b)
                gray[i:i + 4] = bytes([luminance, luminance, luminance, alpha])
        png(docs / 'original' / card['filename'], cw, ch, original)
        png(out / card['filename'], cw, ch, cleaned)
        png(out / 'grayscale' / card['filename'], cw, ch, gray)
        images.append((cw, ch, cleaned))
        result = {key: card[key] for key in ('name', 'definitionId', 'faceId', 'printedIds', 'filename', 'crop')}
        result.update(width=cw, height=ch, preservedPixelCount=preserved,
                      sha256=hashlib.sha256((out / card['filename']).read_bytes()).hexdigest())
        if 'sourcePrintedIds' in card:
            result['sourcePrintedIds'] = card['sourcePrintedIds']
        if 'reviewNote' in card:
            result['reviewNote'] = card['reviewNote']
        art_bottom = max([rect[3] for rect in card['artRects']] + [point[1] for polygon in card['artPolygons'] for point in polygon])
        link = {'image': f'assets/gear-art/{batch}/{card["filename"]}',
                'grayscaleImage': f'assets/gear-art/{batch}/grayscale/{card["filename"]}',
                'width': cw, 'height': ch, 'artBottom': art_bottom}
        result['artwork'] = link
        results.append(result)
    manifest = {'batch': batch, 'source': config['source'], 'sourceSha256': config['sourceSha256'],
                'configurationSha256': hashlib.sha256(config_path.read_bytes()).hexdigest(),
                'method': 'Exact source-pixel cropping and masks; sampled paper fills; no AI reconstruction or artwork resampling.', 'cards': results,
                'skippedCards': config.get('skippedCards', [])}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (docs / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    # Full-resolution review strips, three cards per strip.
    for group in range(math.ceil(len(images) / 3)):
        cards = images[group * 3:group * 3 + 3]
        sw, sh = sum(card[0] for card in cards), max(card[1] for card in cards)
        strip, offset = bytearray(sw * sh * 4), 0
        for cw, ch, image in cards:
            for y in range(ch):
                strip[(y * sw + offset) * 4:(y * sw + offset + cw) * 4] = image[y * cw * 4:(y + 1) * cw * 4]
            offset += cw
        png(docs / 'review' / f'cleaned-{group + 1}.png', sw, sh, strip)
    print(f'{batch}: extracted {len(results)} faces; {sum("reviewNote" in card for card in results)} overlap notes.', flush=True)


def write_registries(config_paths):
    artwork_links, results = {}, []
    for path in config_paths:
        config = json.loads(path.read_text())
        manifest = json.loads((ROOT / 'assets/gear-art' / config['batch'] / 'manifest.json').read_text())
        assert manifest['sourceSha256'] == config['sourceSha256'], 'Regenerate stale batch manifest.'
        assert manifest['configurationSha256'] == hashlib.sha256(path.read_bytes()).hexdigest(), 'Regenerate changed batch coordinates or metadata.'
        expected = {(card['definitionId'], card['faceId'], card['filename']) for card in config['cards']}
        assert expected == {(card['definitionId'], card['faceId'], card['filename']) for card in manifest['cards']}, 'Regenerate changed batch mapping.'
        for card in manifest['cards']:
            faces = artwork_links.setdefault(card['definitionId'], {})
            assert card['faceId'] not in faces, f'Duplicate artwork link: {card["name"]}; review replacement explicitly.'
            assert hashlib.sha256((ROOT / card['artwork']['image']).read_bytes()).hexdigest() == card['sha256'], 'Artwork differs from manifest.'
            faces[card['faceId']] = card['artwork']
            results.append(card)
    (ROOT / 'src/catalogue/gear-art.ts').write_text('// Generated by scripts/extract-gear-art.py; keyed by persistent definition and face IDs.\n'
        + "import type { GearArtwork } from '../domain/cards.ts';\n\n"
        + 'export const gearArtwork: Readonly<Record<string, Partial<Record<\'front\' | \'back\', GearArtwork>>>> = '
        + json.dumps(artwork_links, indent=2) + ';\n')
    registry = '// Generated by scripts/extract-gear-art.py. Static require paths bundle assets on web, iOS and Android.\n'
    registry += "import type { ImageSourcePropType } from 'react-native';\n\nexport const gearArtAssets: Readonly<Record<string, ImageSourcePropType>> = {\n"
    for card in results:
        for key in ('image', 'grayscaleImage'):
            path = card['artwork'][key]
            registry += f'  {json.dumps(path)}: require({json.dumps("../../../" + path)}),\n'
    registry += '};\n'
    (ROOT / 'src/components/cards/gear-art-assets.ts').write_text(registry)
    print(f'Registries retain {len(results)} faces across {len(config_paths)} batches.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch', action='append', help='Process only this batch; repeat for multiple batches. Registries always merge all batches.')
    args = parser.parse_args()
    configs = sorted((ROOT / 'data/reference').glob('gear-art-*.json'))
    by_batch = {json.loads(path.read_text())['batch']: path for path in configs}
    assert len(by_batch) == len(configs), 'Repeated batch name.'
    selected = args.batch if args.batch else [batch for batch, path in by_batch.items()
        if (ROOT / json.loads(path.read_text())['source']).is_file()]
    assert set(selected) <= set(by_batch), 'Unknown batch name.'
    # Check all selections before any writes.
    for batch in selected:
        source = ROOT / json.loads(by_batch[batch].read_text())['source']
        if not source.is_file():
            raise FileNotFoundError(f'{batch}: restore the recorded source scan to regenerate this batch: {source}')
    for batch in set(by_batch) - set(selected):
        manifest = ROOT / 'assets/gear-art' / batch / 'manifest.json'
        if not manifest.is_file():
            raise FileNotFoundError(f'{batch}: no completed manifest; restore the source scan before extracting.')
        if not args.batch:
            print(f'{batch}: source scan removed; retaining completed assets and manifest.', flush=True)
    for batch in dict.fromkeys(selected):
        extract(by_batch[batch])
    write_registries(configs)


if __name__ == '__main__':
    main()
