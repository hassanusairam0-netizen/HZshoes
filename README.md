# HASSAN ZHANG — AIR 6770

A scroll-driven 3D product site for the AIR 6770 Heritage Refined, designed by Jacob & Usairam.

## Run it

It is a static site with no build step. Serve the folder over HTTP (ES modules don't load from `file://`):

```sh
npx serve .            # or: python3 -m http.server 8000
```

Three.js 0.160.0 and GSAP 3.12.5 (with ScrollTrigger) load from jsDelivr and cdnjs; fonts are Bodoni Moda and Jost from Google Fonts.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | Page structure and all copy |
| `css/styles.css` | Layout, type, responsive rules |
| `js/main.js` | Renderer, scroll-driven camera stations, 360° viewer, anatomy hotspots, exploded view, comparison, materials lab, product renders |
| `js/shoe.js` | The procedural AIR 6770 model and the shoebox |
| `js/textures.js` | Procedural leather, suede, foam, weave, honeycomb and tread maps, plus branding textures |
| `js/logo.js` | The HZ monogram (SVG), used for the header, loader, favicon, footer and the shoe's embossing |
| `assets/original-concept.jpg` | The handmade original, cropped to the shoe |

## About the model

There is no external 3D file. `shoe.js` builds the shoe at load time from an analytic shoe last: each panel (suede shell, yellow saddle, patent stripes, gold toe cap, heel counter, crimson rand, tongue, collar, laces, insole, cushioning, midsole, outsole) is a separate mesh with real thickness, its own stitching and its own material. That is what lets the anatomy view highlight single parts and the exploded view take the shoe apart and rebuild it from the same transforms.

Gallery images and the comparison render are made in the browser from the same model during loading.

To replace it with a sculpted GLB later, keep the part names in `shoe.parts` (used by the anatomy highlights and exploded view) and the `anchors` map (camera targets and hotspots).
