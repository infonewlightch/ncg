// Reconstruct the user-provided wordmark as outlined vector geometry.
// Authoring dependencies are intentionally outside the application dependency tree.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire('/Users/sus4yoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const authorRequire = createRequire('/tmp/ncg-vector-tools/node_modules/');
const sharp = runtimeRequire('sharp');
const opentype = authorRequire('opentype.js');
const PDFDocument = authorRequire('pdfkit');
const SVGtoPDF = authorRequire('svg-to-pdfkit');

async function main() {
  const root = path.resolve(__dirname, '..');
  const out = path.join(root, 'output/brand');
  const publicOut = path.join(root, 'public/brand');
  // Refined from the supplied 207×180 reference. Straight stems and a small
  // number of cubic curves remove JPEG ripples instead of tracing the noise.
  const outline = [
    'M11 171V115H21.3L48 154V115H58V171H47.5L21 132V171Z',
    'M114 133H102C99.8 126.5 95.4 123 89 123C78.7 123 73 130.2 73 143C73 155.2 78.8 162 89 162C95.4 162 100 158.8 102 153H114C110.8 165.3 102.8 172 89.5 172C72.8 172 63 161.2 63 143C63 125 72.5 114 89 114C102.3 114 110.9 120.3 114 133Z',
    'M168 131H156C153 125.6 148.1 123 141.5 123C131 123 125 130.5 125 143C125 155.6 130.6 162 141.5 162C151.1 162 156.9 157.6 158.3 148H145V140H169V171H160L159 164C154.8 169.4 149.6 172 141 172C124.8 172 115 161 115 143C115 126 125 114 141.5 114C155 114 164.3 120.2 168 131Z',
  ].join(' ');
  const navy = '#123564';
  const gold = '#BE8F3E';
  const left = 11, right = 185, top = 114, bottom = 172;
  const scale = 600 / (right - left);
  const logoLeft = 300;
  const mainHeight = (bottom - top) * scale;
  const fontBytes = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial.ttf');
  const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
  const subtitle = 'NEWLIGHT CHURCH GLOBAL';
  const fontSize = 25;
  const glyphs = font.stringToGlyphs(subtitle);
  const unitScale = fontSize / font.unitsPerEm;
  const natural = glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth * unitScale, 0);
  const firstBounds = glyphs[0].getPath(0, 0, fontSize).getBoundingBox();
  const lastGlyph = glyphs[glyphs.length - 1];
  const lastBounds = lastGlyph.getPath(0, 0, fontSize).getBoundingBox();
  const naturalInk = natural - lastGlyph.advanceWidth * unitScale + lastBounds.x2 - firstBounds.x1;
  // Match the subtitle's ink edges to the N's left and G's right, excluding the dot.
  const subtitleWidth = (169 - left) * scale;
  const tracking = (subtitleWidth - naturalInk) / (glyphs.length - 1);
  let cursor = -firstBounds.x1;
  const subtitlePath = new opentype.Path();
  for (const glyph of glyphs) {
    subtitlePath.extend(glyph.getPath(cursor, 0, fontSize));
    cursor += glyph.advanceWidth * unitScale + tracking;
  }
  const subtitleBounds = subtitlePath.getBoundingBox();
  const subtitleHeight = subtitleBounds.y2 - subtitleBounds.y1;
  const gap = 29;
  const contentHeight = mainHeight + gap + subtitleHeight;
  const logoTop = (630 - contentHeight) / 2;
  const subtitleBaseline = logoTop + mainHeight + gap - subtitleBounds.y1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
<title id="title">NCG — NEWLIGHT CHURCH GLOBAL</title>
<desc id="desc">Navy NCG lettering and a gold period on a pure white background. All lettering is outlined vector geometry.</desc>
<rect width="1200" height="630" fill="#FFFFFF"/>
<g transform="translate(${logoLeft} ${logoTop}) scale(${scale}) translate(${-left} ${-top})">
<path d="${outline}" fill="${navy}" fill-rule="evenodd"/>
<circle cx="178.5" cy="165.5" r="6.5" fill="${gold}"/>
</g>
<path d="${subtitlePath.toPathData(4)}" transform="translate(${logoLeft} ${subtitleBaseline})" fill="${navy}"/>
</svg>\n`;
  const stem = 'ncg-wordmark-white-vector';
  fs.writeFileSync(path.join(out, `${stem}.svg`), svg);
  fs.writeFileSync(path.join(publicOut, `${stem}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(publicOut, 'ncg-social-share-white.png'));
  await sharp(Buffer.from(svg)).resize(3600, 1890).png().toFile(path.join(out, `${stem}-preview.png`));
  const pdfPath = path.join(out, `${stem}.pdf`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [1200, 630], margin: 0, info: {
      Title: 'NCG — NEWLIGHT CHURCH GLOBAL', Author: 'Newlight Church Global',
      Subject: 'Outlined vector wordmark on white',
    }});
    const stream = fs.createWriteStream(pdfPath);
    stream.on('finish', resolve); stream.on('error', reject);
    doc.pipe(stream);
    SVGtoPDF(doc, svg, 0, 0, { width: 1200, height: 630, assumePt: true });
    doc.end();
  });
  console.log(JSON.stringify({ svg: path.join(out, `${stem}.svg`), pdf: pdfPath, mainHeight, subtitleWidth, contentHeight, tracking }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
