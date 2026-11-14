# Onbun artwork

## Current references

`historical-sculptures-source.png` is the unmodified photograph supplied by the
user. Its visible watermark identifies Steve Sly Japanese Art. The objects are
Ashinaga and Tenaga candleholders. [Source gallery](https://steveslyjapaneseart.com/).

`sculpture-masks.json` contains editable outlines and crop rectangles in that
600 × 939 photograph. The ASCII renderer samples the selected objects, suppresses
the neutral photographic background, and draws real monochrome characters at
the display's pixel ratio. No generated sculpture replaces the supplied image.

`kuniyoshi-print-source.png` is the second supplied reference. Its pair of figures
is isolated using the combined `print` selection and holes in the same JSON
file, rendered as ASCII, and overlaps the app store’s Make an app box. Utagawa Kuniyoshi, Ashinaga and
Tenaga from *Asakusa Okuyama Iki Ningyo*, c. 1855.
[Image record and attribution](https://commons.wikimedia.org/wiki/File:Kuniyoshi_Ashinagatenaga.jpg).

`wakan-ashinaga-tenaga-source.jpg` is an unused historical reference from
*Wakan Sansai Zue*.
[Image record](https://commons.wikimedia.org/wiki/File:Wakan_Sansai_Zue_-_Ashinaga_Chouhi.jpg).

## Category assets

The four editable category originals are `category-audio.svg`,
`category-desktop.svg`, `category-social.svg`, and `category-tools.svg`.
Each exposes an `#artwork` group and named parts for editing. They are native
paths, circles, and rectangles with no embedded images or font dependencies.

Categories and app cards reference the exact same SVG. `assets/store.js` maps
each app to its category and assigns a color palette, a historical figure,
and a faint opacity once per app per page load. Those choices remain stable
while filtering or searching. `assets/yokai-background.js` renders each card's
ASCII layer and releases observers when filtered cards are removed.

## Foreground vectors

The foreground only uses native SVG limbs. The editable paths are in
`assets/hose.js`; grip/release and retraction geometry are in `assets/island.js`.
They render in viewport coordinates, without bitmap textures, CSS blur filters,
or a transform-scaled illustration layer.

The former `ashinaga.svg`, `tenaga.svg`, and classical statue PNGs are unused
artwork retained from previous directions. No active page references those
invented characters or the old statue ASCII renderer.
