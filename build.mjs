import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text;
const b64 = p => fs.readFileSync(p).toString('base64');
const F = [
  ['Barlow Condensed', 500, '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2'],
  ['Barlow Condensed', 600, '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2'],
  ['Barlow Condensed', 700, '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2'],
  ['Barlow', 400, '@fontsource/barlow/files/barlow-latin-400-normal.woff2'],
  ['Barlow', 500, '@fontsource/barlow/files/barlow-latin-500-normal.woff2'],
  ['Barlow', 600, '@fontsource/barlow/files/barlow-latin-600-normal.woff2'],
  ['IBM Plex Mono', 400, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'],
  ['IBM Plex Mono', 500, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'],
];
const fonts = F.map(([fam, w, p]) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64('node_modules/' + p)}) format("woff2")}`).join('\n');
const data = `window.__DECK__=${JSON.stringify({ oled: JSON.parse(fs.readFileSync('assets/oled.json', 'utf8')), oledA: 'data:image/png;base64,' + b64('assets/oled_A.png'), oledB: 'data:image/png;base64,' + b64('assets/oled_B.png') })};`;
let html = fs.readFileSync('src/index.tpl.html', 'utf8');
html = html.replace('/*FONTS*/', () => fonts).replace('/*CSS*/', () => fs.readFileSync('src/style.css', 'utf8')).replace('/*DATA*/', () => data).replace('/*JS*/', () => js.replace(/<\/script/g, '<\\/script'));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/sustentacion_lora_3d.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
