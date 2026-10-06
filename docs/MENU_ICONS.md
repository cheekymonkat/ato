# Main menu icons

The 22 labelled glyphs in `../ato_docs/argo/mainmenu.png` are extracted as
transparent, black SVG paths in `assets/menu-icons`. File names use the associated
label in PascalCase, for example `CargoHold.svg`, `CampaignNotes.svg`,
`GodformsAndSummons.svg` and `MnestisTheatre.svg`. Tile backgrounds, borders and
printed labels are excluded. Unlabelled status/footer symbols are not included.
The six header destinations use the matching extracted glyphs: Argo, Map,
CargoHold (Cargo), Technology, Argonauts and Timeline. Selected and inactive colours
follow the header's existing gold and pale-grey palette.
The Argonauts glyph is used as the app emblem at the header's top left, in gold at 40px.

[View all icons on light and dark backgrounds](menu-icons-preview.svg).

`src/theme/menu-icons.ts` bundles the SVG strings and original labels; no runtime
image slicing, external files or network requests are needed. The exported
`MenuIcon` component in `src/components/Icon.tsx` accepts the named key, size and
colour on web, iOS and Android:

```tsx
<MenuIcon name="CargoHold" size={28} colour="#FFFFFF" />
```

## Reproduce the extraction

Requires Python 3, `pngtopnm` from Netpbm and
[Potrace 1.16](https://potrace.sourceforge.net/). No Python packages are required.
Potrace was built in a temporary directory; it is only needed when regenerating
icons and is not an application dependency.

```sh
python3 scripts/extract-menu-icons.py --potrace /path/to/potrace
python3 scripts/extract-menu-icons.py --potrace /path/to/potrace --check
```

The input configuration is `data/reference/mainmenu-icons.json`. It records the
original screenshot dimensions (1179 × 2556), SHA-256, 22 named crop rectangles,
foreground threshold (154), transparent padding (2px) and tracing settings.
Each crop selects only its glyph region. The converter extracts the light
foreground, tightly bounds it, adds padding and traces a monochrome bitmap with
Potrace (`turdsize=0`, `alphamax=1`, `opttolerance=0.2`, `unit=10`). Transparent
holes are preserved; no opaque background or embedded raster image is used.
Metadata and fixed output dimensions are removed, retaining the view box and
paths for `SvgXml`, as with the project's existing symbols.

`data/reference/menu-icon-manifest.json` records each label, reviewed crop,
actual glyph bounds, output path and SVG hash. The script also regenerates the
bundled TypeScript registry and vector preview. `--check` compares all generated
outputs without writing. An input hash mismatch requires reviewing the crops.

Every icon was rendered and compared side by side with its screenshot crop.
At source resolution, the vector silhouettes overlap the thresholded source
masks by 93.7–98.8% (intersection over union); small differences are expected
from curve smoothing. These are faithful traces of screenshot artwork, not
recovered original vectors. Fine detail remains limited by the supplied raster.
