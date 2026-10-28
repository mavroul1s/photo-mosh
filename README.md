# PHOTO / MOSH

A standalone photo glitch editor with a dark interface, adjustable effects, and offline session exports.

Made by [mavroul1s](https://github.com/mavroul1s) · Nikolaos Mavros.

**[Open the editor](https://mavroul1s.github.io/photo-mosh/)** · [Download the HTML](https://github.com/mavroul1s/photo-mosh/raw/refs/heads/main/index.html)

## Use it

Download `index.html` and open it in a modern browser. No installation, server, account, internet connection, or build step is needed. The demo photograph is embedded. Photos and edits stay in browser memory; no analytics, remote scripts, fonts, or image uploads.

1. Upload, drag in, or paste a photo.
2. Choose one of six presets and adjust the controls.
3. Download an image or the complete session ZIP.

## Effects

- Rectangular slice displacement, with adjustable density and block size
- Horizontal and vertical pixel smears
- Horizontal, vertical, or combined directions
- RGB channel splitting, luminance pixel sorting, grain, and scanlines
- Saturation, contrast, and an overall intensity control
- Repeatable seeded patterns, Remix, live animation, and draggable before/after comparison

Presets: **Slice shift**, **Signal loss**, **Chromatic**, **Pixel drift**, **After hours**, and **Meltdown**. At zero intensity the output is the unmodified working image, including its alpha channel. Color and texture settings are scaled by intensity.

## Downloads

- **Image:** PNG, JPEG (quality 95%), or WebP (quality 95%). Original working size, or a maximum side of 2048 / 1080 pixels. Smaller photos are never upscaled. If a browser substitutes PNG for an unsupported encoder, the extension follows the actual MIME type.
- **Download ZIP:** `artwork` in your chosen format, `original.png`, `settings.json`, `session.html`, and a short readme. The dependency-free ZIP writer uses standard uncompressed ZIP entries with UTF-8 filenames and CRC-32 checksums.
- **Save HTML:** a complete offline editor containing your current source image and settings. Reopen it to continue editing. Your imported photo is embedded in that download; only share it if you want to share the photo.
- **Settings:** export / import a validated JSON recipe to reuse on another image.

Animation is a live preview; exports freeze its current seed into a still image. The original PNG in a bundle preserves the editor's working image, not the original file's metadata or binary encoding. Transparent photos remain transparent in PNG/WebP; JPEG does not support transparency.

## Shortcuts

| Key | Action |
| --- | --- |
| `R` | Remix the pattern |
| `C` | Toggle comparison |
| `Space` | Play / pause animation |

Shortcuts pause while typing or using controls. The sample is a JPEG. Supported uploads: JPG, PNG, WebP, AVIF, GIF, and BMP, subject to browser decoding support. GIF uploads use a still frame.

## Limits and privacy

Uploads are limited to 50 MB. Photos exceeding 16 megapixels or an 8192px side are reduced before editing to keep browser memory use practical. Preview rendering uses a maximum side of 1200 pixels, while exports rerender at the selected resolution. Effects scale with the image dimensions; grain and scanline sampling can differ between preview and full-size export. All image work uses the Canvas 2D API. Extreme-resolution exports can take several seconds on mobile devices.

Sessions are **not automatically saved**. Download a session before closing the tab. The application makes no network requests during use; the help and source links open external websites only when clicked.

## Development

All application code, CSS, icons, and the sample image live in `index.html`. No package manager or production dependencies.

Optional local server:

```sh
python -m http.server 4173
```

For GitHub Pages, serve the `main` branch from the repository root. `.nojekyll` keeps hosting static.

Browser regression checks are in `tests/smoke.cjs`. They require Playwright and Chromium, and run directly against the HTML file:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/smoke.cjs
```

## Credits and license

Application code: [MIT](LICENSE).

Embedded demo photograph: [Sunlight Through The Trees by Darren Bockman on Unsplash](https://unsplash.com/photos/green-leaf-trees-illuminated-by-suns-rays-pN3Z2usSIQw), under the [Unsplash License](https://unsplash.com/license). The photograph is covered by that license separately from the application code. The visual reference supplied for this project is not included in the repository.
