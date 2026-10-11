# Synthetic PDF fixtures

These are original, fictional test files. They contain no identity documents,
real names, account information, private source paths, or embedded system fonts.
The text uses the PDF base-14 Helvetica font; PDF.js obtains its rendering data
from the project's bundled, licensed standard fonts.

- `standard-fonts-cmyk.pdf`: Helvetica text, DeviceCMYK patches and DeviceGray.
- `synthetic-jpeg-scan.pdf`: an original raster illustration in a DCT/JPEG stream.
- `embedded-cmyk-profile.pdf`: explicit ICCBased CMYK patches. The profile is
  copied from `vendor/pdfjs/iccs/CGATS001Compat-v2-micro.icc`, under CC0; see the
  retained `vendor/pdfjs/iccs/LICENSE`.
- `synthetic-jpeg2000.pdf`: the same original illustration encoded as lossless
  JPEG2000, using a JPXDecode image stream.

The original raster drawing and fixture-generation code follow the project's
MIT license. To recreate the rasters, install Pillow and run
`python tests/fixtures/generate-synthetic-images.py`. To recreate the PDFs from
the committed rasters and vendored profile, run
`node tests/fixtures/generate-pdfs.mjs`; this step needs no development packages.

The PDF-resource integration check uses the currently vendored browser build of
PDF.js, the actual `src/worker-assets.mjs` bridge and no external resource fetch.
It checks operator lists, decoded image buffers, converted CMYK colors, and the
specific embedded resources actually read. See `tests/pdf-resources.mjs`.
Run `node tests/pdf-resources.mjs` from the project root with Node 22 or newer.
The checker supplies the newer standard-library APIs needed by the browser
bundle on Node 22, and an unused import-time DOMMatrix placeholder; these are
test-runner adaptations and do not alter PDF.js, its resource bridge, or the app.
Its Node operator-list checks do not prove browser rendering, downloading or
mobile compatibility. Optional rendering requires a user-supplied canvas module.
To render too, add `--canvas-module /path/to/@napi-rs/canvas/index.js` and
`--render-dir test-output/pdf-resources`. The render directory is ignored by Git.
