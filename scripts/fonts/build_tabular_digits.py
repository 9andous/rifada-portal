"""Build "Rifada Cairo Tabular Digits": Cairo's Arabic-Indic digits on one equal width.

Cairo (OFL, no Reserved Font Name) draws the Arabic-Indic digits with proportional widths and has
no `tnum` feature, so number columns do not align. This script derives a digits-only font from the
self-hosted Cairo variable file: for each weight it instantiates a static master, keeps only the
Arabic-Indic and Extended Arabic-Indic digits plus the Arabic decimal and thousands separators,
and puts every digit on one common width with its ink centred.

The common width is kept tight so narrow digits (١ and ٠) do not float apart in times and years:
it is 0.80 of the widest digit's ink plus side bearings, and the few wide digits (٣ ٥ ٧ ٨) are
condensed horizontally by up to about 22% to fit. Cairo's zero, a small square that reads as an
empty glyph at figure sizes, is redrawn as a filled round dot. Separators keep their natural width.

The output is loaded before Cairo in the font stack (src/app/fonts.ts), so only the digit glyphs come
from this file and every other glyph still comes from Cairo.

Usage (regeneration only; the output files are committed):
    python -m pip install fonttools brotli
    python scripts/fonts/build_tabular_digits.py
"""

from __future__ import annotations

import io
import os
from pathlib import Path

from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/fonts/cairo/cairo-arabic-wght-normal.woff2"
OUT_DIR = ROOT / "public/fonts/cairo"
WEIGHTS = (400, 500, 600, 700)
FAMILY = "Rifada Cairo Tabular Digits"

DIGITS = [*range(0x0660, 0x066A), *range(0x06F0, 0x06FA)]
SEPARATORS = [0x066B, 0x066C]
ZEROS = [0x0660, 0x06F0]
ZERO_SCALE = 1.9
# Side bearing kept on each side of the widest digit, in font units.
SIDE_BEARING = int(os.environ.get("RIFADA_DIGITS_SB", "28"))
# Common digit width relative to the tightest width that needs no condensing (widest ink plus two
# side bearings). Below 1.0 the widest digits are condensed horizontally to fit, which brings the
# narrow digits (١ and ٠) closer to their neighbours.
COMPACT = float(os.environ.get("RIFADA_DIGITS_COMPACT", "0.80"))
OUT_SUFFIX = os.environ.get("RIFADA_DIGITS_SUFFIX", "")


def build(weight: int) -> Path:
    font = TTFont(SOURCE)
    font = instantiateVariableFont(font, {"wght": weight})

    options = Options()
    options.layout_features = []
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=DIGITS + SEPARATORS)
    subsetter.subset(font)

    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    glyf = font["glyf"]
    digit_glyphs = sorted({cmap[c] for c in DIGITS if c in cmap})

    # Some digits are composites of others; flatten them so each can be reshaped on its own.
    glyph_set = font.getGlyphSet()
    flat = {}
    for name in digit_glyphs:
        recording = DecomposingRecordingPen(glyph_set)
        glyph_set[name].draw(recording)
        pen = TTGlyphPen(None)
        recording.replay(pen)
        flat[name] = pen.glyph()
    for name, glyph in flat.items():
        glyf[name] = glyph

    # Cairo draws the Arabic-Indic zero as a small square, which reads as an empty or missing glyph
    # at figure sizes. Replace it with a filled round dot (the conventional Arabic zero), centred
    # where Cairo's square sits and sized relative to it so it keeps the weight's colour.
    for name in {cmap[c] for c in ZEROS if c in cmap}:
        glyph = glyf[name]
        glyph.expand(glyf)
        glyph.recalcBounds(glyf)
        cx, cy = (glyph.xMin + glyph.xMax) / 2, (glyph.yMin + glyph.yMax) / 2
        r = (glyph.xMax - glyph.xMin) * ZERO_SCALE / 2
        k = 0.5523 * r  # cubic circle approximation
        pen = TTGlyphPen(None)
        cubic = Cu2QuPen(pen, max_err=1.0, reverse_direction=False)
        cubic.moveTo((cx, cy + r))
        cubic.curveTo((cx + k, cy + r), (cx + r, cy + k), (cx + r, cy))
        cubic.curveTo((cx + r, cy - k), (cx + k, cy - r), (cx, cy - r))
        cubic.curveTo((cx - k, cy - r), (cx - r, cy - k), (cx - r, cy))
        cubic.curveTo((cx - r, cy + k), (cx - k, cy + r), (cx, cy + r))
        cubic.closePath()
        dot = pen.glyph()
        dot.recalcBounds(glyf)
        glyf[name] = dot
        advance, _ = hmtx[name]
        hmtx[name] = (advance, dot.xMin)

    # One common width for every digit; condense only the digits whose ink does not fit, then centre
    # every digit's ink in the cell.
    def bounds(name):
        glyph = glyf[name]
        glyph.expand(glyf)
        glyph.recalcBounds(glyf)
        return glyph

    widest = max(bounds(n).xMax - bounds(n).xMin for n in digit_glyphs if bounds(n).numberOfContours)
    target = round((widest + 2 * SIDE_BEARING) * COMPACT)
    allowed = target - 2 * SIDE_BEARING
    condensed = []
    for name in digit_glyphs:
        glyph = bounds(name)
        if glyph.numberOfContours == 0:
            hmtx[name] = (target, 0)
            continue
        if glyph.isComposite():
            raise RuntimeError(f"Unexpected composite digit {name}")
        ink = glyph.xMax - glyph.xMin
        if ink > allowed:
            factor = allowed / ink
            centre = (glyph.xMin + glyph.xMax) / 2
            glyph.coordinates.transform(((factor, 0), (0, 1)))
            glyph.coordinates.translate((round(centre - centre * factor), 0))
            glyph.recalcBounds(glyf)
            condensed.append((name, round(factor, 3)))
        shift = round((target - (glyph.xMax - glyph.xMin)) / 2 - glyph.xMin)
        glyph.coordinates.translate((shift, 0))
        glyph.recalcBounds(glyf)
        hmtx[name] = (target, glyph.xMin)

    names = font["name"]
    for record in list(names.names):
        if record.nameID in (1, 4, 16):
            names.setName(FAMILY, record.nameID, record.platformID, record.platEncID, record.langID)
        elif record.nameID == 6:
            names.setName(f"RifadaCairoTabularDigits-{weight}", 6, record.platformID, record.platEncID, record.langID)
    font["OS/2"].usWeightClass = weight

    out = OUT_DIR / f"cairo-tabular-digits-{weight}{OUT_SUFFIX}.woff2"
    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer)
    out.write_bytes(buffer.getvalue())
    print(f"{out.relative_to(ROOT)}: digit width {target}, condensed {condensed}, {len(buffer.getvalue())} bytes")
    return out


if __name__ == "__main__":
    for w in WEIGHTS:
        build(w)
