import fs from 'node:fs';
// Works for a manual static upload as well as a Git-based Netlify build.
let endpoint=process.env.VITE_SUPABASE_URL||'';
if(!endpoint&&fs.existsSync('.env.local'))endpoint=fs.readFileSync('.env.local','utf8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]||'';
let supabase='';try{const url=new URL(endpoint);if(url.protocol==='https:')supabase=` ${url.origin} wss://${url.host}`;}catch{}
fs.writeFileSync('dist/_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self'${supabase}; frame-src https://www.youtube-nocookie.com https://www.youtube.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
/admin.html
  X-Robots-Tag: noindex, nofollow
/sw.js
  Cache-Control: no-store
/offline-shell.json
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);
fs.writeFileSync('dist/_redirects','/auth/callback /index.html 200\n');
console.log('Prepared static hosting headers and authentication callback route.');
