// LIVE keyword difficulty checker — runs per video inside the render pipeline.
// Picks the EASIEST winnable search phrase for the video's topic BEFORE the
// script/meta are built, using US-only data:
//   1. candidate phrases  <- topic + seed + YouTube autocomplete (gl=us&hl=en)
//   2. live difficulty    <- yt-dlp top-12 real results per phrase (views|channel)
//   3. rule (proved 2026-09-27, research/keyword-ranking-check-2026-09-27.md):
//        3+ results under 500 views in top 12  = EASY  (small channel wins in weeks)
//        2+ giants (1M+) in top 5, no gaps     = HARD  (never fight the wall)
//   4. never blocks a render: any failure -> chosen=null, caller keeps its keyword.
// Runner note: GitHub-hosted runners egress from US IPs, so yt-dlp search results
// here are US-ranked. Local (Pakistan) runs are approximate only.
//   node keyword-check.mjs --topic "..." --seed "..." --niche "..." --json out.json [--max 8]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const argOf = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const TOPIC = argOf("--topic", "");
const SEED = argOf("--seed", "");
const NICHE = argOf("--niche", "");
const OUT = argOf("--json", "");
const MAX = Math.min(Math.max(parseInt(argOf("--max", "8"), 10) || 8, 3), 12);

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "your", "you", "my", "is", "are", "how", "what", "why", "with", "s"]);
const words = (s) => new Set(norm(s).split(" ").filter((w) => w && !STOP.has(w)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function autocomplete(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&gl=us&hl=en&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`autocomplete HTTP ${r.status}`);
  const d = await r.json();
  return (Array.isArray(d?.[1]) ? d[1] : []).map((x) => String(x)).filter((x) => x.length > 2 && x.length < 80);
}

function ytdlpResults(kw) {
  const run = () => spawnSync("yt-dlp",
    ["--flat-playlist", "--no-warnings", "--quiet", "--print", "%(view_count)s|%(channel)s", `ytsearch12:${kw}`],
    { encoding: "utf8", timeout: 45000, shell: false, maxBuffer: 4 * 1024 * 1024 });
  let r = run();
  if (r.error || r.status !== 0) r = run(); // one retry (transient extractor hiccups)
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.code : (r.stderr || "").split("\n")[0].slice(0, 80);
    throw new Error(`yt-dlp: ${why || "exit " + r.status}`);
  }
  const pos = String(r.stdout || "").split("\n").filter(Boolean).slice(0, 12)
    .map((l) => { const v = Number((l.split("|")[0] || "").trim()); return Number.isFinite(v) && v >= 0 ? v : null; });
  return pos; // positional: index 0 = the #1 ranked result
}

function score(pos) {
  const views = pos.filter((v) => v !== null);
  if (!views.length) throw new Error("no usable results");
  const sorted = [...views].sort((a, b) => a - b);
  const median = sorted[Math.floor(views.length / 2)];
  const rank1 = pos.find((v) => v !== null) ?? 0;
  const sub500 = views.filter((v) => v < 500).length;
  const giantsTop5 = pos.slice(0, 5).filter((v) => v !== null && v >= 1_000_000).length;
  let verdict = "MED";
  if (sub500 >= 3 || median < 5000) verdict = "EASY";
  if ((giantsTop5 >= 2 && sub500 === 0) || median >= 250_000) verdict = "HARD";
  return { verdict, median, rank1, top1: Math.max(...views), sub500, giantsTop5, usable: views.length };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[kwcheck] topic="${TOPIC}" seed="${SEED}" region=US max=${MAX}`);
  const out = { checkedAt: startedAt, region: "US", tool: "yt-dlp ytsearch12", topic: TOPIC, seed: SEED, candidates: [], chosen: null, chosenScore: null, reason: "", status: "ok" };

  // 1. candidate pool: seed + topic phrase + US autocomplete expansions.
  // Long phrases return zero suggestions, so also probe the first-4-words prefix.
  const seeds = [...new Set([norm(SEED), norm(TOPIC).split(" ").slice(0, 6).join(" ")])].filter(Boolean);
  const probe = [...new Set(seeds.concat(seeds.map((s) => s.split(" ").slice(0, 4).join(" "))))].filter(Boolean);
  const pool = [];
  const seen = new Set();
  const addCand = (kw) => { const k = norm(kw); if (k && !seen.has(k)) { seen.add(k); pool.push(k); } };
  for (const s of seeds) addCand(s); // originals first in scoring order
  for (const s of probe) {
    try { for (const sugg of await autocomplete(s)) addCand(sugg); }
    catch (e) { console.log(`[kwcheck] autocomplete "${s}": ${String(e.message).slice(0, 60)}`); }
  }
  // prioritize: seed first, then keep pool order (autocomplete = real user phrasing)
  const toScore = pool.slice(0, MAX);
  console.log(`[kwcheck] pool ${pool.length} candidates, scoring ${toScore.length}`);

  // 2-3. live US difficulty per candidate
  const seedWords = words(SEED + " " + TOPIC);
  let failures = 0;
  for (const kw of toScore) {
    try {
      const pos = ytdlpResults(kw);
      const s = score(pos);
      const overlap = [...words(kw)].filter((w) => seedWords.has(w)).length;
      out.candidates.push({ kw, ...s, overlap });
      console.log(`[kwcheck] ${s.verdict.padEnd(4)} "${kw}"  median=${s.median} top=${s.top1} sub500=${s.sub500}/${s.usable}`);
    } catch (e) {
      failures++;
      console.log(`[kwcheck] FAIL  "${kw}"  ${String(e.message).slice(0, 70)}`);
    }
    await sleep(400);
  }
  if (!out.candidates.length) { out.status = "failed"; out.reason = "all candidate checks failed (yt-dlp missing or network)"; }
  else {
    // 4. pick: EASY with best topic overlap; tiebreak = lower median
    const easy = out.candidates.filter((c) => c.verdict === "EASY").sort((a, b) => (b.overlap - a.overlap) || (a.median - b.median));
    if (easy.length) { out.chosen = easy[0].kw; out.chosenScore = "EASY"; out.reason = `easiest of ${out.candidates.length} checked (sub500=${easy[0].sub500}, median=${easy[0].median})`; }
    else {
      const best = [...out.candidates].sort((a, b) => (a.verdict === "HARD" ? 1 : 0) - (b.verdict === "HARD" ? 1 : 0) || a.median - b.median)[0];
      out.chosenScore = best.verdict; out.reason = `no EASY phrase found; keeping caller keyword (best checked: "${best.kw}" ${best.verdict})`;
    }
  }
  if (failures) out.failures = failures;
  console.log(`[kwcheck] ${out.chosen ? `CHOSEN "${out.chosen}" (${out.chosenScore})` : "no switch"} — ${out.reason}`);

  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); }
  process.exit(0); // ALWAYS fail-open: caller keeps its keyword on any miss
}

main().catch((e) => {
  console.log(`[kwcheck] fatal: ${String(e.message).slice(0, 100)}`);
  if (OUT) { try { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), region: "US", topic: TOPIC, seed: SEED, candidates: [], chosen: null, chosenScore: null, reason: String(e.message).slice(0, 120), status: "failed" }, null, 2)); } catch { } }
  process.exit(0);
});
