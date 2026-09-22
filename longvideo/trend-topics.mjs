// Trend topics puller — YouTube autocomplete mining per channel niche (NO API key).
// suggestqueries.google.com with ds=yt returns REAL YouTube search demand.
// Writes state/trend-topics.json + posts an ntfy digest. Weekly cron (or manual).
//   node trend-topics.mjs
import fs from "node:fs";
import path from "node:path";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");
const NTFY = process.env.NTFY_TOPIC || "";

const SEEDS = {
  "investors-compass": ["stock market crash explained", "how to invest", "warren buffett", "passive income", "market crash"],
  "money-rulebook": ["money rules", "pay yourself first", "rich habits", "company collapse", "personal finance"],
  "debt-free-doctrine": ["get out of debt", "credit score", "debt snowball", "loan trap", "debt free"],
  "quotequarry": ["stoicism", "discipline", "marcus aurelius", "mental strength", "sigma mindset"],
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
async function suggest(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return Array.isArray(d[1]) ? d[1].filter((x) => typeof x === "string") : [];
  } catch (e) {
    console.log(`  [suggest] ${q}: ${String(e.message).slice(0, 50)}`);
    return [];
  } finally { clearTimeout(t); }
}

console.log("[trends] mining YouTube autocomplete...");
const out = { date: new Date().toISOString().slice(0, 10), niches: {} };
const digest = [];
for (const [slug, seeds] of Object.entries(SEEDS)) {
  const all = new Set();
  for (const seed of seeds) {
    for (const s of await suggest(seed)) if (s.length > 8 && s.length < 70) all.add(s);
    await new Promise((r) => setTimeout(r, 400));
  }
  // prefer suggestions containing the seed's core noun + numbers/questions (proven CTR lifts)
  const ranked = [...all].sort((a, b) => {
    const sc = (x) => (/\d/.test(x) ? 2 : 0) + (/\?$/.test(x) ? 1 : 0);
    return sc(b) - sc(a) || a.localeCompare(b);
  });
  out.niches[slug] = ranked.slice(0, 12);
  digest.push(`${slug}: ${ranked.slice(0, 5).map((x) => `"${x}"`).join(", ")}`);
  console.log(`[trends] ${slug}: ${ranked.length} suggestions`);
}

const stateDir = path.join(ROOT, "state");
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, "trend-topics.json"), JSON.stringify(out, null, 2));
console.log(`[trends] saved state/trend-topics.json`);

if (NTFY) {
  try {
    await fetch(`https://ntfy.sh/${NTFY}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Title: "Weekly trending topics" },
      body: digest.join("\n"),
    });
  } catch { }
}
console.log("[trends] done");
