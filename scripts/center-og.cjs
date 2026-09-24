// Move the existing outlined vector as one group; never redraw the approved wordmark.
// Usage: NODE_PATH=/path/to/authoring/node_modules node scripts/center-og.cjs
const fs=require('node:fs');
const sharp=require('sharp');
const source=fs.readFileSync('public/brand/ncg-wordmark-white-vector.svg','utf8');
const shift=600-(300+((169-11)*(600/(185-11)))/2);
const marker='<rect width="1200" height="630" fill="#FFFFFF"/>';
if(!source.includes(marker))throw Error('Unexpected vector source');
const svg=source.replace(marker,`${marker}\n<g transform="translate(${shift} 0)">`).replace('</svg>','</g>\n</svg>');
fs.writeFileSync('public/brand/ncg-og-centered.svg',svg);
sharp(Buffer.from(svg)).resize(1800,945).png().toFile('public/brand/ncg-og-centered.png').then(()=>console.log('OG: outlined letters and subtitle centered, 1800 × 945, dot position preserved.'));
