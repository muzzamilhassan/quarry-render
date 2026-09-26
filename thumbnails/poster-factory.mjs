// 4-channel photo-poster factory — the How Dev Works thumbnail DNA, rebranded
// for Investors Compass / Money Rulebook / Debt-Free Doctrine / Quote Quarry.
// Same law as the tech channel: real photo, dark angled shade, glow edge strip,
// chip pill top-left, letterspaced eyebrow, Anton headline with ONE accent word,
// hard zero-blur offset shadow, brand wordmark bottom-right.
//   node thumbnails/poster-factory.mjs --channel ic --title "How Index Funds Actually Work" --out out.png
//   node thumbnails/poster-factory.mjs --channel mr --title "..." --photo mr-1 --chip SCANDALS --out ...
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FONTS = path.join(ROOT, 'thumbnails', 'fonts', 'hdw');
const PHOTOS = path.join(ROOT, 'thumbnails', 'photos');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const CHANNEL = String(arg('channel', 'ic')).toLowerCase();
const TITLE = String(arg('title', 'How Money Actually Works'));
const OUT = String(arg('out', `thumbnails/demos/poster-${CHANNEL}.png`));

// ---------- channel skins (accent + dark shade tint + copy voice) ----------
const CHANNELS = {
  ic: {
    name: "INVESTOR'S COMPASS", wordmark: '◆ INVESTORSCOMPASS',
    accent: '#E8C15A', accentText: '#F0CE74', accentSoft: '#F5E3B0',
    edge: ['#F0D080', '#8A6D2F'], shade: '11,17,40',
    powers: ['CRASH', 'RICH', 'MILLION', 'BILLION', 'BILLIONS', 'MONEY', 'MARKET', 'GOLD'],
    chip: (t) =>
      /market|stock|s&p|wall street|crash|bubble|recession/i.test(t) ? 'MARKETS' :
      /invest|index|fund|portfolio|dividend|compound|etf/i.test(t) ? 'INVESTING' :
      /rich|wealth|millionaire|billionaire|fortune/i.test(t) ? 'WEALTH' :
      /gold|bond|dollar|cash|asset/i.test(t) ? 'ASSETS' : 'INVESTING',
  },
  mr: {
    name: 'MONEY RULEBOOK', wordmark: '◆ MONEYRULEBOOK',
    accent: '#C1272D', accentText: '#F4766F', accentSoft: '#FCA5A5',
    edge: ['#E0484F', '#6B1216'], shade: '18,8,10',
    powers: ['NEVER', 'BROKE', 'RICH', 'HIDDEN', 'TRAP', 'FOOLED', 'LIED', 'YEARS', 'RULES'],
    chip: (t) =>
      /bank|fed|interest rate|central/i.test(t) ? 'BANKING' :
      /fraud|scam|lie|lied|stole|ponzi|enron|theranos|madoff/i.test(t) ? 'SCANDALS' :
      /rich|poor|broke|salary|income|money rule/i.test(t) ? 'MONEY RULES' :
      /psycholog|habit|trap|why you/i.test(t) ? 'PSYCHOLOGY' : 'MONEY RULES',
  },
  dfd: {
    name: 'DEBT-FREE DOCTRINE', wordmark: '◆ DEBTFREEDOCTRINE',
    accent: '#4ADE80', accentText: '#5BEA8C', accentSoft: '#A7F3C9',
    edge: ['#4ADE80', '#14532D'], shade: '7,18,12',
    powers: ['TRAP', 'TRAPPED', 'DEBT', 'FREE', 'YEARS', 'SNOWBALL', 'WORKS'],
    chip: (t) =>
      /snowball|avalanche|payoff|pay off/i.test(t) ? 'PAYOFF PLAN' :
      /credit card|debt|loan|student|borrow/i.test(t) ? 'DEBT' :
      /budget|save|saving|emergency fund/i.test(t) ? 'FREEDOM PLAN' :
      /mortgage|car loan|interest/i.test(t) ? 'LOANS' : 'DEBT FREE',
  },
  qq: {
    name: 'QUOTE QUARRY', wordmark: '◆ QUOTEQUARRY',
    accent: '#F5E31C', accentText: '#F5E31C', accentSoft: '#FBF3A0',
    edge: ['#F5E31C', '#7A6E0B'], shade: '8,8,8',
    powers: ['CALM', 'CHAOS', 'STOIC', 'CONTROL', 'FOCUS', 'POWER', 'MIND'],
    chip: (t) =>
      /stoic|marcus|seneca|epictetus|philosoph/i.test(t) ? 'STOICISM' :
      /discipline|habit|routine|consisten/i.test(t) ? 'DISCIPLINE' :
      /calm|anxiety|stress|fear|anger/i.test(t) ? 'MINDSET' :
      /quote|wisdom|lesson/i.test(t) ? 'WISDOM' : 'MINDSET',
  },
};
const C = CHANNELS[CHANNEL];
if (!C) { console.error('FAIL: --channel must be ic | mr | dfd | qq'); process.exit(1); }

// ---------- auto copy derivation (same logic as the tech factory) ----------
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

function derive(title) {
  const main = (String(title).split(/\s*[|—]\s*|\s+-\s+/)[0] || title).trim();
  const words = main.toUpperCase().split(/\s+/).filter(Boolean);
  const orig = main.split(/\s+/);
  let idx = orig.findIndex(w => { const c = w.replace(/[^A-Za-z0-9]/g, ''); return c.length >= 2 && c === c.toUpperCase() && /[A-Z0-9]/.test(c); });
  if (idx < 0) idx = words.findIndex(w => C.powers.includes(w) || ['ACTUALLY', 'REALLY', 'NEVER', 'ALWAYS'].includes(w));
  if (idx < 0) idx = words.length - 1;
  const maxW = 800, lines = [];
  let size = 132;
  for (; size >= 72; size -= 6) {
    const perLine = Math.floor(maxW / (0.5 * size));
    const wl = []; let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (cand.length <= perLine) cur = cand;
      else { if (cur) wl.push(cur); cur = w; }
    }
    if (cur) wl.push(cur);
    if (wl.length <= 3 && wl.every(l => l.length <= perLine)) { lines.push(...wl); break; }
    lines.length = 0;
  }
  if (!lines.length) { lines.push(words.join(' ').slice(0, 22)); }
  return { lines, accentIdx: Math.min(idx, words.length - 1), chip: C.chip(main) };
}

function withAccent(lines, accentIdx) {
  let n = 0;
  return lines.map(l => l.split(' ').map(w => {
    const hit = n === accentIdx; n++;
    return hit ? `<span>${w}</span>` : w;
  }).join(' ')).join('<br>');
}

// ---------- template (How Dev Works DNA, channel-skinned) ----------
const F = (n) => `url('file:///${FONTS.split(path.sep).join('/')}/${n}')`;
const FONT_CSS = `
@font-face { font-family:'Anton'; src:${F('anton.woff2')} format('woff2'); }
@font-face { font-family:'InterB'; src:${F('inter-black.woff2')} format('woff2'); font-weight:900; }
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1280px; height:720px; overflow:hidden; }
.stage { position:relative; width:1280px; height:720px; overflow:hidden; }
`;

function template({ img, chip, eyebrow, linesHtml, size }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
.photo{position:absolute;inset:0;background:url('file:///${img.split(path.sep).join('/')}') center/cover no-repeat;
  filter:contrast(1.07) saturate(1.08) brightness(0.92);}
.shade{position:absolute;inset:0;background:
  linear-gradient(76deg, rgba(${C.shade},0.96) 0%, rgba(${C.shade},0.86) 30%, rgba(${C.shade},0.42) 58%, rgba(${C.shade},0.10) 78%, rgba(${C.shade},0.30) 100%),
  linear-gradient(0deg, rgba(${C.shade},0.88) 0%, rgba(${C.shade},0.25) 30%, rgba(${C.shade},0) 55%),
  linear-gradient(180deg, rgba(${C.shade},0.55) 0%, rgba(${C.shade},0) 22%);}
.glowedge{position:absolute;left:0;top:0;bottom:0;width:10px;background:linear-gradient(180deg,${C.edge[0]},${C.edge[1]} 70%);}
.chip{position:absolute;left:72px;top:56px;display:flex;align-items:center;gap:12px;background:rgba(8,10,14,0.82);
  border:1.5px solid ${C.accent}66;border-radius:999px;padding:11px 26px;
  font:900 23px InterB;letter-spacing:5px;color:${C.accentSoft};}
.chip i{width:12px;height:12px;border-radius:50%;background:${C.accent};box-shadow:0 0 14px ${C.accent};}
.txt{position:absolute;left:72px;bottom:64px;right:340px;}
.eyebrow{font:900 26px InterB;letter-spacing:7px;color:${C.accentSoft};margin-bottom:14px;}
h1{font-family:Anton;font-size:${size}px;line-height:0.98;color:#FAFBFD;letter-spacing:1px;
  text-shadow:6px 6px 0 rgba(4,6,10,0.55);}
h1 span{color:${C.accentText};text-shadow:6px 6px 0 rgba(4,6,10,0.55);}
.brand{position:absolute;right:56px;bottom:48px;font:900 24px InterB;letter-spacing:5px;color:${C.accentSoft};}
</style></head><body><div class="stage">
<div class="photo"></div><div class="shade"></div><div class="glowedge"></div>
<div class="chip"><i></i>${chip}</div>
<div class="txt">
  <div class="eyebrow">${eyebrow}</div>
  <h1>${linesHtml}</h1>
</div>
<div class="brand">${C.wordmark}</div>
</div></body></html>`;
}

// ---------- build ----------
const pool = fs.existsSync(PHOTOS)
  ? fs.readdirSync(PHOTOS).filter(f => f.startsWith(CHANNEL + '-') && /\.jpe?g$/i.test(f))
  : [];
if (!pool.length) { console.error(`FAIL: no photos for ${CHANNEL} in thumbnails/photos (${CHANNEL}-*.jpg)`); process.exit(1); }
const photoArg = arg('photo');
const imgFile = (typeof photoArg === 'string' && photoArg)
  ? (pool.includes(photoArg) ? photoArg : pool.find(f => f.startsWith(photoArg)) || (pool.includes(photoArg + '.jpg') ? photoArg + '.jpg' : null))
  : pool[hash(TITLE) % pool.length];
if (!imgFile) { console.error('FAIL: --photo not found in pool'); process.exit(1); }

const d = derive(TITLE);
const linesHtml = withAccent(d.lines, d.accentIdx);
const size = d.lines.length >= 3 ? 96 : (d.lines.some(l => l.length > 14) ? 108 : 122);
const chip = typeof arg('chip') === 'string' && arg('chip') ? arg('chip') : d.chip;
const html = template({ img: path.join(PHOTOS, imgFile), chip, eyebrow: C.name, linesHtml, size });

// ---------- render ----------
const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });
if (!chrome) { console.error('FAIL: no Chrome/Edge found (set CHROME_PATH)'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const absOut = path.resolve(OUT);
const tmp = absOut.replace(/\.png$/, '') + '.html';
fs.writeFileSync(tmp, html);
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto('file:///' + tmp.split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: OUT });
await browser.close();
fs.rmSync(tmp, { force: true });
console.log('OK: wrote', OUT, '(' + Math.round(fs.statSync(OUT).size / 1024) + 'KB) — [' + CHANNEL.toUpperCase() + '] "' + TITLE + '"  photo=' + imgFile + '  chip=' + chip);
