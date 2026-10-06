"""Trace the 22 labelled main-menu glyphs into transparent, monochrome SVGs.

Requires pngtopnm (Netpbm) and Potrace 1.16. No Python packages are required.
python3 scripts/extract-menu-icons.py --potrace /path/to/potrace
Add --check to compare regenerated assets without writing anything.
The original screenshot is never changed. Crops exclude labels and tile borders.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'data/reference/mainmenu-icons.json'


def read_ppm(data):
    """Read Netpbm's binary RGB output; avoid splitting arbitrary pixel bytes."""
    header = re.match(rb'P6\s+(\d+)\s+(\d+)\s+255\s', data)
    assert header, 'Expected 8-bit RGB Netpbm output'
    width, height = map(int, header.groups())
    pixels = data[header.end():]
    assert len(pixels) == width * height * 3
    return width, height, pixels


def icon_bitmap(rgb, width, height, entry, threshold, padding):
    left, top, crop_width, crop_height = entry['crop']
    assert 0 <= left < left + crop_width <= width and 0 <= top < top + crop_height <= height
    points = []
    for y in range(crop_height):
        for x in range(crop_width):
            offset = ((top + y) * width + left + x) * 3
            if min(rgb[offset:offset + 3]) >= threshold:
                points.append((x, y))
    assert len(points) > 100, f"Empty or incomplete crop: {entry['name']}"
    x0, y0 = min(x for x, y in points), min(y for x, y in points)
    x1, y1 = max(x for x, y in points) + 1, max(y for x, y in points) + 1
    assert x0 > 0 and y0 > 0 and x1 < crop_width and y1 < crop_height, f"Clipped glyph: {entry['name']}"
    bitmap_width, bitmap_height = x1 - x0 + padding * 2, y1 - y0 + padding * 2
    pixels = bytearray([255]) * (bitmap_width * bitmap_height)
    for x, y in points:
        pixels[(y - y0 + padding) * bitmap_width + x - x0 + padding] = 0
    return f'P5\n{bitmap_width} {bitmap_height}\n255\n'.encode() + pixels, [left + x0, top + y0, x1 - x0, y1 - y0]


def trace(bitmap, executable, options):
    result = subprocess.run([executable, '--svg', '--flat', '--turdsize', str(options['turdsize']),
        '--alphamax', str(options['alphamax']), '--opttolerance', str(options['opttolerance']),
        '--unit', str(options['unit']), '--output', '-', '-'], input=bitmap, check=True, capture_output=True)
    root = ET.fromstring(result.stdout)
    for child in list(root):
        if child.tag.rsplit('}', 1)[-1] == 'metadata':
            root.remove(child)
    root.attrib.pop('width', None)
    root.attrib.pop('height', None)
    root.attrib.pop('version', None)
    root.set('fill', '#000000')
    for element in root.iter():
        element.tag = element.tag.rsplit('}', 1)[-1]
    root.set('xmlns', 'http://www.w3.org/2000/svg')
    assert root.get('viewBox') and any(element.tag == 'path' and element.get('d') for element in root.iter())
    assert all(element.tag in {'svg', 'g', 'path'} for element in root.iter()), 'Only vector paths are permitted'
    return ET.tostring(root, encoding='unicode')


def preview(icons, labels):
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root = ET.Element('{http://www.w3.org/2000/svg}svg', viewBox='0 0 880 1020')
    ET.SubElement(root, 'rect', width='880', height='1020', fill='#EDE9DF')
    ET.SubElement(root, 'text', x='440', y='30', fill='#242320', **{'font-family': 'sans-serif', 'font-size': '20', 'text-anchor': 'middle'}).text = 'Main menu icons · 22 SVG assets'
    for index, (name, xml) in enumerate(icons.items()):
        x, y = (index % 4) * 220, 50 + (index // 4) * 160
        for offset, background, foreground in [(20, '#FFFFFF', '#000000'), (114, '#292723', '#FFFFFF')]:
            ET.SubElement(root, 'rect', x=str(x + offset), y=str(y), width='86', height='102', rx='6', fill=background)
            icon = ET.fromstring(xml.replace('#000000', foreground))
            icon.set('x', str(x + offset + 8)); icon.set('y', str(y + 8)); icon.set('width', '70'); icon.set('height', '86')
            root.append(icon)
        ET.SubElement(root, 'text', x=str(x + 110), y=str(y + 122), fill='#242320', **{'font-family': 'sans-serif', 'font-size': '13', 'text-anchor': 'middle'}).text = labels[name]
        ET.SubElement(root, 'text', x=str(x + 110), y=str(y + 140), fill='#65615B', **{'font-family': 'sans-serif', 'font-size': '10', 'text-anchor': 'middle'}).text = name + '.svg'
    return ET.tostring(root, encoding='unicode') + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--potrace', default='potrace')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    source = (ROOT / config['source']).resolve()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == config['sourceSha256'], 'Screenshot changed; review crops before tracing'
    version = subprocess.run([args.potrace, '--version'], check=True, capture_output=True, text=True).stdout.splitlines()[0]
    assert version.startswith('potrace 1.16'), f"Unexpected tracing version: {version}"
    width, height, rgb = read_ppm(subprocess.run(['pngtopnm', str(source)], check=True, capture_output=True).stdout)
    assert [width, height] == config['sourceSize']
    outputs, icons, manifest, labels = {}, {}, [], {}
    for entry in config['icons']:
        name = entry['name']
        assert re.fullmatch(r'[A-Z][A-Za-z]+', name) and name not in icons
        bitmap, bounds = icon_bitmap(rgb, width, height, entry, config['foregroundThreshold'], config['padding'])
        svg = trace(bitmap, args.potrace, config['tracing'])
        asset = f'assets/menu-icons/{name}.svg'
        outputs[ROOT / asset] = svg + '\n'
        icons[name], labels[name] = svg, entry['label']
        manifest.append({**entry, 'glyphBounds': bounds, 'asset': asset, 'sha256': hashlib.sha256((svg + '\n').encode()).hexdigest()})
    outputs[ROOT / 'src/theme/menu-icons.ts'] = '// Generated by scripts/extract-menu-icons.py from mainmenu.png; transparent vector paths only.\n' \
        + 'export const menuIcons = ' + json.dumps(icons, indent=2) + ' as const;\n' \
        + 'export const menuIconLabels = ' + json.dumps(labels, indent=2) + ' as const;\n'
    outputs[ROOT / 'data/reference/menu-icon-manifest.json'] = json.dumps({
        'source': config['source'], 'sourceSha256': config['sourceSha256'], 'sourceSize': [width, height],
        'tracing': config['tracing'], 'foregroundThreshold': config['foregroundThreshold'], 'padding': config['padding'], 'icons': manifest,
    }, indent=2) + '\n'
    outputs[ROOT / 'docs/menu-icons-preview.svg'] = preview(icons, labels)
    for path, text in outputs.items():
        if args.check:
            assert path.exists() and path.read_text() == text, f"Stale generated file: {path.relative_to(ROOT)}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    print(f"{'Verified' if args.check else 'Extracted'} {len(icons)} named vector icons; {sum(len(svg.encode()) for svg in icons.values())} SVG bytes.")


if __name__ == '__main__':
    main()
