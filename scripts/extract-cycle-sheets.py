#!/usr/bin/env python3
"""Extract sheet definitions and original vector icons. Requires PyMuPDF 1.28.x.

Run from any directory; --check recomputes without changing generated files.
The small extraction-spec.json contains visually reviewed labels and event text;
box geometry, timeline symbols and icon paths come from the source PDFs.
"""
import argparse
import hashlib
import html
import json
import re
import string
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/reference/cycle-sheets"
SPEC = json.loads((DATA / "extraction-spec.json").read_text())
OUTPUTS = {}


def put(path, content):
    OUTPUTS[path] = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False, indent=2) + "\n"


def norm(value):
    return "".join(c.lower() for c in value if c.isalnum())


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower().replace("'", "").replace("’", "")).strip("-")


def icon_key(value):
    return "".join(part.capitalize() for part in slug(value).split("-"))


def rect_values(rect):
    return [round(v, 3) for v in rect]


def union(rects):
    result = pymupdf.Rect(rects[0])
    for rect in rects[1:]:
        result |= rect
    return result


class Sheet:
    def __init__(self, cycle, side, source_dir):
        self.filename = f"ATO_C{cycle}_ArgoSheet_{side}.pdf"
        source = source_dir / self.filename
        self.doc = pymupdf.open(source)
        self.page = self.doc[0]
        assert len(self.doc) == 1
        self.page.set_rotation(270 if side == "FRONT" else 90)
        self.matrix = self.page.rotation_matrix
        self.words = [(word[4], pymupdf.Rect(word[:4]) * self.matrix) for word in self.page.get_text("words")]
        self.drawings = self.page.get_drawings()
        for drawing in self.drawings:
            drawing["uprightRect"] = drawing["rect"] * self.matrix
        self.source = {
            "file": self.filename, "page": 1,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "uprightRotationDegrees": self.page.rotation,
            "uprightSizePt": [round(self.page.rect.width, 3), round(self.page.rect.height, 3)],
        }

    def label(self, title, cargo=False):
        wanted = norm(title)
        for start in range(len(self.words)):
            text = ""
            rects = []
            for word, rect in self.words[start:start + 12]:
                text += norm(word)
                rects.append(rect)
                if text == wanted:
                    result = union(rects)
                    if not cargo or (result.x0 > 450 and result.y0 > 295):
                        return result
                if len(text) >= len(wanted):
                    break
        raise ValueError(f"Cannot locate {title!r} in {self.filename}")

    def inside(self, rect, exclude_boxes=False):
        return [d for d in self.drawings if rect.contains(d["uprightRect"])
                and not (exclude_boxes and len(d["items"]) == 44
                         and d["uprightRect"].width > 10
                         and abs(d["uprightRect"].width - d["uprightRect"].height) < 0.02)]


def vector_svg(sheet, drawings, padding=0.4, id_prefix="SheetIcon"):
    """Serialize PDF Bézier paths, not a raster crop or a clipped full-page SVG."""
    assert drawings, "Empty icon"
    bounds = union([d["uprightRect"] for d in drawings])
    bounds += (-padding, -padding, padding, padding)

    def point(p):
        p = p * sheet.matrix
        return (p.x - bounds.x0, p.y - bounds.y0)

    def fmt(p):
        return f"{p[0]:.4f} {p[1]:.4f}"

    paths, masks, cutouts = [], [], []

    def apply_cutouts():
        if not cutouts:
            return
        mask_id = f"{id_prefix}Cutout{len(masks) + 1}"
        masks.append(f'<mask id="{mask_id}" maskUnits="userSpaceOnUse" x="0" y="0" width="{bounds.width:.4f}" height="{bounds.height:.4f}"><rect width="{bounds.width:.4f}" height="{bounds.height:.4f}" fill="white"/>' + "".join(cutouts) + '</mask>')
        paths[:] = [f'<g mask="url(#{mask_id})">' + "\n".join(paths) + '</g>']
        cutouts.clear()

    for d in drawings:
        commands, last = [], None
        for item in d["items"]:
            kind = item[0]
            if kind == "re":
                r, direction = item[1:]
                pts = [r.tl, r.tr, r.br, r.bl] if direction == 1 else [r.tl, r.bl, r.br, r.tr]
                pts = [point(p) for p in pts]
                commands.append("M" + fmt(pts[0]) + " " + " ".join("L" + fmt(p) for p in pts[1:]) + " Z")
                last = None
            elif kind == "qu":
                q = item[1]
                pts = [point(p) for p in (q.ul, q.ur, q.lr, q.ll)]
                commands.append("M" + fmt(pts[0]) + " " + " ".join("L" + fmt(p) for p in pts[1:]) + " Z")
                last = None
            elif kind in ("l", "c"):
                pts = [point(p) for p in item[1:]]
                if last is None or any(abs(a - b) > 0.001 for a, b in zip(last, pts[0])):
                    commands.append("M" + fmt(pts[0]))
                commands.append(("L" if kind == "l" else "C") + " ".join(fmt(p) for p in pts[1:]))
                last = pts[-1]
            else:
                raise ValueError(f"Unsupported vector command {kind}")
        if d["closePath"]:
            commands.append("Z")
        # Retain white cutouts; normalize the original dark ink to the app's black SVG format.
        fill = "none" if d["fill"] is None else ("#ffffff" if min(d["fill"]) > 0.9 else "#000000")
        attrs = f'fill="{fill}" fill-rule="{"evenodd" if d["even_odd"] else "nonzero"}"'
        if d["color"] is not None:
            attrs += f' stroke="#000000" stroke-width="{d["width"]:.4f}"'
        else:
            attrs += ' stroke="none"'
        path = f'  <path {attrs} d="{" ".join(commands)}"/>'
        if fill == "#ffffff":
            # PDF white paint becomes a transparent cutout, including on coloured UI panels.
            # Named black/white mask colours must not be recoloured with the visible ink.
            cutouts.append(path.replace('fill="#ffffff"', 'fill="black"'))
        else:
            apply_cutouts()
            paths.append(path)
    apply_cutouts()
    defs = '<defs>' + "\n".join(masks) + '</defs>\n' if masks else ""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {bounds.width:.4f} {bounds.height:.4f}" preserveAspectRatio="xMidYMid meet">\n' + defs + "\n".join(paths) + "\n</svg>\n"
    return svg, bounds


def adventure_data(sheet, config):
    result = []
    for index, (title, expected) in enumerate(config["adventures"]):
        label = sheet.label(title)
        candidates = [d for d in sheet.drawings if len(d["items"]) == 44
                      and d["uprightRect"].x1 < 410
                      and label.y1 - 0.5 < d["uprightRect"].y0 < label.y1 + 15]
        groups = []
        for drawing in sorted(candidates, key=lambda d: d["uprightRect"].x0):
            if not groups or drawing["uprightRect"].x0 - groups[-1][-1]["uprightRect"].x1 > 5:
                groups.append([])
            groups[-1].append(drawing)
        group = min(groups, key=lambda g: abs((union([d["uprightRect"] for d in g]).x0 + union([d["uprightRect"] for d in g]).x1) / 2 - (label.x0 + label.x1) / 2))
        assert len(group) == expected, f"{title}: expected {expected}, found {len(group)}"
        labels = SPEC["greekBoxLabels"] if expected == 10 else ["α"] + [None] * (expected - 2) + ["Ω"]
        boxes = [{"position": n + 1, "label": labels[n], "sourceRectPt": rect_values(d["uprightRect"])} for n, d in enumerate(group)]
        result.append({
            "id": f"c{config['cycle']}-{slug(title)}", "title": title,
            "progressBoxCount": expected, "boxes": boxes, "storyReferences": [],
            "storyReferencesStatus": "awaiting-user-list",
            "sourceTitleRectPt": rect_values(label), "sourceOrder": index + 1,
            "layout": {"row": index // 3 + 1, "column": index % 3 + 1, "columnSpan": 2 if expected == 10 else 1},
        })
    return result


def timeline_data(sheet, config):
    definition = config["timeline"]
    days = []
    for text, rect in sheet.words:
        if not re.fullmatch(r"\d{2}|T[0-6](?:/00)?", text):
            continue
        if not any(a <= rect.x0 <= b for a, b in definition["dayNumberX"]):
            continue
        days.append((text, rect))
    days.sort(key=lambda d: (0 if d[1].x0 < 150 else 1, d[1].y0))
    expected = ([f"T{i}" for i in range(6)] + ["T6/00"] if definition.get("tutorial") else ["00"]) + [f"{i:02}" for i in range(1, definition["lastDay"] + 1)]
    assert [d[0] for d in days] == expected, f"Incomplete day numbers in {sheet.filename}"
    output = []
    for index, (label, rect) in enumerate(days):
        mid = (rect.y0 + rect.y1) / 2
        symbols = {}
        for d in sheet.drawings:
            r = d["uprightRect"]
            if not (rect.x1 < r.x0 < rect.x1 + 36 and abs((r.y0 + r.y1) / 2 - mid) < 4.7):
                continue
            count = len(d["items"])
            kind = "battleResearch" if count in (200, 201) else "structuralResearch" if count == 37 else "battle" if count in (75, 78) and r.width > 8 else None
            if kind:
                assert kind not in symbols, f"Duplicate {kind} on {label}"
                symbols[kind] = {"type": kind, "phase": "encounter" if kind == "battle" else "advancement", "sourceRectPt": rect_values(r)}
        logical_day = "00" if label == "T6/00" else label
        events = [dict(e) for e in definition["events"] if e["day"] == logical_day]
        for event in events:
            event.pop("day")
            event.update({"type": "specialEvent", "phase": "story"})
        acclimation = next((a for a in definition["acclimation"] if a["day"] == logical_day), None)
        if acclimation:
            events.append({**{k: v for k, v in acclimation.items() if k != "day"}, "type": "acclimation", "phase": "exploration", "number": int(acclimation["text"][12])})
        output.append({
            "id": f"c{config['cycle']}-day-{slug(label)}", "label": label,
            "dayNumber": int(logical_day) if logical_day.isdigit() else None,
            "tutorial": label.startswith("T"), "order": index + 1,
            "printedMuted": label in definition.get("mutedDays", []),
            "markers": list(symbols.values()), "events": events,
            "sourceNumberRectPt": rect_values(rect),
        })
    return {"days": output, "printedColumnBreakBefore": f"{definition['secondColumnStartsAt']:02}", "endOfTimeline": definition.get("endOfTimeline")}


def matrix_data(sheet, config):
    rows = list(string.ascii_uppercase) + config["matrixExtraRows"]
    cells = {text: rect for text, rect in sheet.words if re.fullmatch(r"[A-Za-z]{1,2}(?:[1-9]|1[012])", text) and rect.x0 > 400}
    assert set(cells) == {f"{r}{c}" for r in rows for c in range(1, 13)}
    outlines = [d["uprightRect"] for d in sheet.drawings if len(d["items"]) == 44 and 10 < d["uprightRect"].width < 15 and d["uprightRect"].x0 > 400]

    def box(cell):
        label = cells[cell]
        centre = pymupdf.Point((label.x0 + label.x1) / 2, (label.y0 + label.y1) / 2)
        candidates = [r for r in outlines if r.contains(centre)]
        assert len(candidates) == 1, f"Missing/ambiguous matrix outline {cell}"
        return candidates[0]

    for cell in cells:
        box(cell)
    # Exact label centres let a future layout reproduce the printed spacing with a compact data file.
    columns = [{"number": c, "sourceCentreXPt": round((cells[f'A{c}'].x0 + cells[f'A{c}'].x1) / 2, 3), "sourceBoxXPt": round(box(f'A{c}').x0, 3)} for c in range(1, 13)]
    row_defs = [{"id": r, "group": "main" if len(r) == 1 else "supplemental", "sourceCentreYPt": round((cells[f'{r}1'].y0 + cells[f'{r}1'].y1) / 2, 3), "sourceBoxYPt": round(box(f'{r}1').y0, 3)} for r in rows]
    first = box("A1")
    return {"rows": row_defs, "columns": columns, "sourceCellSizePt": [round(first.width, 3), round(first.height, 3)], "cellCount": len(cells), "cellIdTemplate": "<rowId><columnNumber>", "columnGroups": [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], "persistsAcrossCycles": True, "toggleGesture": "longPress"}


def hidden_track_data(sheet, config):
    result = []
    for track in config["hiddenTracks"]:
        label = sheet.label(track["title"])
        boxes = [d for d in sheet.drawings if len(d["items"]) == 44 and d["uprightRect"].width > 14
                 and label.y1 < d["uprightRect"].y0 < label.y1 + track["rows"] * 24
                 and abs((d["uprightRect"].x0 + d["uprightRect"].x1) / 2 - (label.x0 + label.x1) / 2) < 65]
        # The printed reward cells paint the same enlarged outline twice.
        boxes = list({tuple(round(v, 1) for v in d["uprightRect"]): d for d in boxes}.values())
        boxes.sort(key=lambda d: (round(d["uprightRect"].y0, 1), d["uprightRect"].x0))
        expected = track["rows"] * track["columns"]
        assert len(boxes) == expected, f"{sheet.filename} {track['title']}: {len(boxes)} boxes, expected {expected}"
        result.append({
            "id": f"c{config['cycle']}-{slug(track['title'])}", "title": track["title"], "hold": "hidden",
            "resourceId": slug(track["resource"]), "progressBoxCount": expected,
            "layout": {"rows": track["rows"], "columns": track["columns"]},
            "boxes": [{"position": i + 1, "printedRewardResourceId": slug(track["resource"]) if (i + 1) % track["rewardEvery"] == 0 else None, "sourceRectPt": rect_values(d["uprightRect"])} for i, d in enumerate(boxes)],
            "automaticRewardRules": None,
        })
    return result


def hidden_notes_data(sheet, cycle):
    if cycle < 4:
        return []
    label = sheet.label("Tally Marks")
    lines = sorted({round(d["uprightRect"].y0, 3) for d in sheet.drawings
                    if d["uprightRect"].x0 > 620 and d["uprightRect"].width > 150
                    and label.y1 < d["uprightRect"].y0 < label.y1 + 100})
    return [{"id": f"c{cycle}-tally-marks", "title": "Tally Marks", "kind": "freeText", "hold": "hidden", "printedLineCount": len(lines), "sourceTitleRectPt": rect_values(label), "sourceLineYPt": lines}]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / SPEC["sourceDirectory"])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    resources = {}
    cycle_files, preview_icons = [], []
    for config in SPEC["cycles"]:
        cycle = config["cycle"]
        front, back = Sheet(cycle, "FRONT", args.source_dir), Sheet(cycle, "BACK", args.source_dir)
        cargo_groups = []
        for category in ("mortal", "primordial", "divine"):
            entries = []
            for title in config[category] + (["Cores"] if category == "primordial" else []):
                canonical = "Promised Futures Carcass" if norm(title) == "promisedfuturescarcass" else title
                resource_id = slug(canonical)
                label = front.label(title, cargo=True)
                crop = pymupdf.Rect(label.x0 - 34, label.y0 - 6, label.x0 - 0.5, label.y1 + 6)
                drawings = front.inside(crop, exclude_boxes=True)
                icon = icon_key(canonical)
                svg, bounds = vector_svg(front, drawings, id_prefix=icon)
                path = ROOT / f"assets/resource-icons/{icon}.svg"
                evidence = {"cycle": cycle, "sourceFile": front.filename, "printedName": title, "labelRectPt": rect_values(label), "iconRectPt": rect_values(bounds), "vectorPathCount": len(drawings)}
                if resource_id not in resources:
                    put(path, svg)
                    preview_icons.append((canonical, path, svg))
                    resources[resource_id] = {
                        "id": resource_id, "name": canonical, "category": category,
                        "kind": "namedQuantityList" if title == "Cores" else "quantity",
                        "subtype": "core" if title == "Cores" else None,
                        "iconKey": icon, "iconPath": str(path.relative_to(ROOT)), "cycles": [], "aliases": [], "sources": [],
                    }
                resource = resources[resource_id]
                if title != canonical and title not in resource["aliases"]:
                    resource["aliases"].append(title)
                resource["cycles"].append(cycle)
                resource["sources"].append(evidence)
                entries.append({"resourceId": resource_id, "printedName": title, "sourceOrder": len(entries) + 1})
            cargo_groups.append({"category": category, "hold": "hidden" if category == "divine" else "main", "entries": entries})
        cargo_groups.append({"category": "rare", "hold": config["rareHold"], "kind": "namedQuantityList", "title": "Rare Resources"})
        adventures = adventure_data(front, config)
        stories_path = ROOT / f"data/reference/adventures/cycle-{cycle}.json"
        if stories_path.exists():
            hubs = json.loads(stories_path.read_text())["hubs"]
            for track in adventures:
                hub = next((h for h in hubs if h["trackId"] == track["id"]), None)
                if hub:
                    track["storyReferences"] = [{"entryId": e["id"], "title": e["title"], "label": e["label"], "kind": e["kind"], "storybookPage": hub["storybookPage"]} for e in hub["entries"]]
                    track["storyReferencesStatus"] = "supplied-adventure-tracker"
                    track["storiesFile"] = f"../adventures/cycle-{cycle}.json"
        data = {"schemaVersion": 1, "cycle": cycle, "title": config["title"], "sources": {"front": front.source, "back": back.source}, "adventureTracks": adventures,
                "cargo": {"groups": cargo_groups, "hiddenTracks": hidden_track_data(back, config), "hiddenNotes": hidden_notes_data(back, cycle)},
                "timeline": timeline_data(back, config), "choiceMatrix": matrix_data(back, config)}
        filename = f"cycle-{cycle}.json"
        put(DATA / filename, data)
        cycle_files.append({"cycle": cycle, "file": filename, "adventureTracks": len(adventures), "adventureBoxes": sum(t["progressBoxCount"] for t in adventures), "timelineDays": len(data["timeline"]["days"]), "matrixCells": data["choiceMatrix"]["cellCount"]})
        if cycle == 1:
            blank = next(d for d in front.drawings if len(d["items"]) == 44 and adventures[0]["boxes"][1]["sourceRectPt"] == rect_values(d["uprightRect"]))
            put(ROOT / "assets/cycle-sheet-icons/ProgressBox.svg", vector_svg(front, [blank])[0])
            # All three symbols occur on the first two ordinary timeline rows.
            for kind, icon, day in [("battle", "TimelineBattle", "01"), ("structuralResearch", "StructuralBreakthrough", "01"), ("battleResearch", "BattleBreakthrough", "02")]:
                marker = next(m for d in data["timeline"]["days"] if d["label"] == day for m in d["markers"] if m["type"] == kind)
                anchor = pymupdf.Rect(marker["sourceRectPt"])
                day_rect = pymupdf.Rect(next(d["sourceNumberRectPt"] for d in data["timeline"]["days"] if d["label"] == day))
                mid = (day_rect.y0 + day_rect.y1) / 2
                x0, x1 = (anchor.x0 - 2.5, anchor.x0 + 7.5) if kind == "battleResearch" else (anchor.x0 - 0.2, anchor.x1 + 0.2)
                nearby = back.inside(pymupdf.Rect(x0, mid - 5.3, x1, mid + 5.3))
                put(ROOT / f"assets/cycle-sheet-icons/{icon}.svg", vector_svg(back, nearby)[0])
    put(DATA / "resources.json", {"schemaVersion": 1, "resources": list(resources.values())})
    put(DATA / "manifest.json", {"schemaVersion": 1, "purpose": "Static reference definitions for later implementation; no campaign state.", "coordinateSystem": "PDF points, upright landscape, origin top-left; rectangles [x0, y0, x1, y1].", "rulebook": SPEC["rulebook"], "resourceRegistry": "resources.json", "cycleFiles": cycle_files, "generatedBy": "scripts/extract-cycle-sheets.py", "sourceSpec": "extraction-spec.json"})
    # Vector contact sheet is a review artifact, not an app screen.
    groups = []
    for i, (title, _, svg) in enumerate(preview_icons):
        x, y = 20 + (i % 4) * 250, 20 + (i // 4) * 86
        width, icon_height = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups())
        scale = min(48 / width, 48 / icon_height)
        paths = svg[svg.index(">") + 1:svg.rindex("</svg>")]
        inner = f'<g transform="translate({x + (48 - width * scale) / 2:.4f} {y + (48 - icon_height * scale) / 2:.4f}) scale({scale:.6f})">{paths}</g>'
        groups.append(inner + f'<text x="{x + 60}" y="{y + 29}" font-size="12" font-family="sans-serif">{html.escape(title)}</text>')
    height = 40 + ((len(preview_icons) + 3) // 4) * 86
    put(ROOT / "docs/resource-icons-preview.svg", f'<svg xmlns="http://www.w3.org/2000/svg" width="1030" height="{height}" viewBox="0 0 1030 {height}"><rect width="1030" height="{height}" fill="#fff"/>' + "\n".join(groups) + '</svg>\n')
    stale = [str(path.relative_to(ROOT)) for path, content in OUTPUTS.items() if not path.exists() or path.read_text() != content]
    if args.check:
        assert not stale, "Generated files differ: " + ", ".join(stale)
    else:
        for path, content in OUTPUTS.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    print(f"{'Verified' if args.check else 'Generated'} {len(cycle_files)} cycles, {len(resources)} resource SVGs, {sum(c['adventureTracks'] for c in cycle_files)} adventure tracks, {sum(c['adventureBoxes'] for c in cycle_files)} adventure boxes, {sum(c['timelineDays'] for c in cycle_files)} timeline rows.")


if __name__ == "__main__":
    main()
