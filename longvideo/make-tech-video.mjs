// TECH VIDEO factory — data-driven "Dark Mode Minimalist Tech" explainer.
// --topic "..." -> AI fits the topic into fixed scene templates -> TTS ->
// tech-subset music -> 1080p render. Runs in the public render repo (no tokens).
//   node make-tech-video.mjs --topic "How Git actually works"
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pickApprovedTrack } from "../music-engine.mjs";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");
const EXPL = path.join(ROOT, "explainer");
const PUB = path.join(EXPL, "public");
const IS_WIN = process.platform === "win32";
const PY = IS_WIN ? "python" : "python3";
const tIdx = process.argv.indexOf("--topic");
const TOPIC = tIdx > 0 ? process.argv[tIdx + 1] : "Auto Increment vs UUID";

try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { }

const spawnOpts = { stdio: "inherit", shell: IS_WIN };

// ---------------- AI scene script ----------------
const SYSTEM = `You write scripts for "Dark Mode Minimalist Tech" explainer videos (60-100 seconds) in the style of modern coding channels.
Return ONLY JSON: {"scenes":[ ... ]} using EXACTLY these scene templates in this order:
1. {"t":"title","headline":"punchy question, max 42 chars","sub":"SHORT TECH TAG","text":""}
2. 2-3 middle scenes chosen from:
   {"t":"terminal","label":"STEP 1 — SHORT NAME","termTitle":"app — query","lines":["typed line 1 (max 44 chars)","-- comment line"],"caption":"one-line takeaway","text":"narration 35-50 words"}
   {"t":"counter","label":"STEP 2 — SHORT NAME","nodeTitle":"db — region","sub":"one line","values":[1001,1002,1003],"text":"narration 35-50 words"}
   {"t":"bars","label":"STEP 3 — SHORT NAME","bars":[{"label":"INT","text":"4 bytes","v":4}],"caption":"compare line","text":"narration 35-50 words"}
   {"t":"clash","label":"STEP 4 — SHORT NAME","a":"db — US-East","b":"db — Europe","value":1001,"warn":"COLLISION — SHORT REASON","text":"narration 35-50 words"}
   {"t":"code","label":"STEP 5 — SHORT NAME","big":"short code reveal (max 44 chars)","caption":"why it matters","grid":true,"lines":["id = solve();"],"text":"narration 35-50 words"}
3. {"t":"end","headline":"Now you know.","sub":"FOLLOW FOR MORE","text":""}
Rules:
- Exactly 6 or 7 scenes. Scene 1 = title, last = end.
- "text" = what the narrator SAYS. Plain English, direct, no em-dashes, no hashtags.
- "lines" items must be realistic code/SQL/commands for the topic, each max 46 chars, max 2 lines per terminal.
- Numbers/facts must be REAL and correct for the topic. Bars v values are relative sizes.
- Every middle scene needs "label" formatted like "STEP 1 — THE IDEA".`;

function parseJsonLoose(s) { const m = String(s).match(/\{[\s\S]*\}/); if (!m) throw new Error("no JSON"); return JSON.parse(m[0]); }
async function postJson(url, headers, body) {
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`); }
  return r.json();
}
async function aiJson(runner) {
  let lastErr;
  for (let a = 0; a < 4; a++) {
    try { return await runner(); } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 5000 * (a + 1))); }
  }
  throw lastErr;
}

const gemini = () => aiJson(async () => {
  const key = process.env.LONGVIDEO_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no key");
  const d = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: [{ text: `${SYSTEM}\n\nTOPIC: ${TOPIC}` }] }], generationConfig: { temperature: 0.8, responseMimeType: "application/json" } });
  return parseJsonLoose(d.candidates?.[0]?.content?.parts?.[0]?.text || "");
});
const groq = () => aiJson(async () => {
  const key = process.env.LONGVIDEO_GROQ_API_KEY;
  if (!key) throw new Error("no key");
  const d = await postJson("https://api.groq.com/openai/v1/chat/completions",
    { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "User-Agent": "quarry-tech/1.0" },
    { model: "openai/gpt-oss-120b", temperature: 0.8, max_tokens: 12000, messages: [{ role: "user", content: `${SYSTEM}\n\nTOPIC: ${TOPIC}\nOutput ONLY the raw JSON object.` }] });
  return parseJsonLoose(d.choices?.[0]?.message?.content || "");
});

// guaranteed fallback = the tested UUID story, mapped to the schema
const FALLBACK = {
  scenes: [
    { t: "title", headline: "Why Databases Fight Over IDs", sub: "AUTO INCREMENT vs UUID", text: "" },
    { t: "counter", label: "STEP 1 — THE BASELINE", nodeTitle: "users_db — US-East", sub: "single database, counting up", values: [1001, 1002, 1003, 1004], text: "Every database needs a unique ID for every row. The simplest way is to just count. One thousand one, one thousand two, one thousand three. Done." },
    { t: "bars", label: "STEP 2 — THE PRICE", bars: [{ label: "INT", text: "4 bytes", v: 4 }, { label: "BIGINT", text: "8 bytes", v: 8 }, { label: "UUID", text: "16 bytes", v: 16 }], caption: "and a UUID is impossible to say out loud", text: "A plain integer uses only four bytes. A UUID uses sixteen, and it is impossible to say out loud. So why would anyone pay four times the memory?" },
    { t: "clash", label: "STEP 3 — THE CONFLICT", a: "users_db — US-East", b: "users_db — Europe", value: 1001, warn: "COLLISION — ID 1001 EXISTS TWICE", text: "Because the moment you run two databases, one in the US and one in Europe, both start counting from zero. And both generate ID one thousand one. Collision." },
    { t: "code", label: "STEP 4 — THE FIX", big: "550e8400-e29b-41d4", caption: "the first bits are a TIMESTAMP — every ID sorts itself", grid: true, lines: ["id = uuidv7();  -- unique + sorted"], text: "The fix is UUID version seven. It hides a timestamp inside the ID itself, so every value is unique, and the newest rows always sort first. That is why modern systems love it." },
    { t: "end", headline: "Now you know why UUIDs exist.", sub: "FOLLOW FOR MORE", text: "" },
  ],
};

console.log(`[tech] topic: ${TOPIC}`);
let script = null;
try {
  script = await gemini();
  console.log("[script] gemini OK");
} catch (e) { console.log(`[warn] gemini: ${String(e.message).slice(0, 90)}`); }
if (!script) {
  try {
    script = await groq();
    console.log("[script] groq OK");
  } catch (e) { console.log(`[warn] groq: ${String(e.message).slice(0, 90)}`); }
}
const okShape = script && Array.isArray(script.scenes)
  && script.scenes.length >= 6 && script.scenes.length <= 8
  && script.scenes[0]?.t === "title" && script.scenes[script.scenes.length - 1]?.t === "end"
  && script.scenes.slice(1, -1).every((s) => String(s.text || "").split(/\s+/).filter(Boolean).length >= 20)
  && script.scenes.slice(1, -1).every((s) => ["terminal", "counter", "bars", "clash", "code"].includes(s.t));
if (!okShape) {
  console.log(`[script] weak/invalid AI scenes — using built-in UUID fallback`);
  script = FALLBACK;
}
const scenes = script.scenes;
const midwords = scenes.slice(1, -1).reduce((a, s) => a + String(s.text || "").split(/\s+/).filter(Boolean).length, 0);
console.log(`[script] ${scenes.length} scenes, ${midwords} narration words`);

// ---------------- TTS (middle scenes with narration) ----------------
const audioDir = path.join(PUB, "tech-audio");
fs.mkdirSync(audioDir, { recursive: true });
const spoken = scenes.map((s, i) => ({ i, text: String(s.text || "") })).filter((x) => x.text.trim());
const inPath = path.join(audioDir, "tts-input.json");
fs.writeFileSync(inPath, JSON.stringify(spoken));
const vIdx = process.argv.indexOf("--voice");
const VOICE = vIdx > 0 ? process.argv[vIdx + 1] : "en-US-AndrewNeural";
const tts = spawnSync(PY, [path.join(EXPL, "edge_batch.py"), inPath], { ...spawnOpts, env: { ...process.env, EXPLAINER_VOICE: VOICE, EXPLAINER_RATE: "+4%" } });
if (tts.status !== 0) throw new Error("tts failed");
const durs = JSON.parse(fs.readFileSync(path.join(audioDir, "tts-durations.json"), "utf8"));
const byI = new Map(durs.map((d) => [d.i, d]));
const buildWords = (ws) => (ws || []).map((w) => ({ w: w.w, t0: Math.round(w.s * 1000), t1: Math.round((w.s + w.d) * 1000) }));

// ---------------- timing ----------------
const starts = [];
const dursArr = [];
let cur = 0;
for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  const narr = byI.get(i)?.ms || 0;
  let dur;
  if (s.t === "title") dur = 2.8;
  else if (s.t === "end") dur = 4.0;
  else if (s.t === "code") dur = Math.max(narr / 1000 + 2.2, 8); // code scenes need reveal time
  else dur = Math.max(narr / 1000 + 1.4, 4.5);
  starts.push(Math.round(cur * 100) / 100);
  dursArr.push(Math.round(dur * 100) / 100);
  cur += dur;
}
const totalS = Math.round((cur + 0.6) * 100) / 100;
console.log(`[timeline] ${scenes.length} scenes, ${totalS}s total`);

// ---------------- music (clean minimal tech subset only) ----------------
const ALL = JSON.parse(fs.readFileSync(path.join(DIR, "approved-music.json"), "utf8"));
const TECH_CALM = ["Deliberate Thought", "Cut Trance", "Shiny Tech"];
const pool = ALL.filter((m) => TECH_CALM.includes(m.title));
const track = await (async () => { try { return await pickApprovedTrack((pool.length ? pool : ALL).map((m) => m.title)); } catch { return null; } })();
let music = null;
if (track) {
  music = "tech-audio/music.mp3";
  fs.copyFileSync(track.file, path.join(PUB, music));
  console.log(`[music] "${track.title}"`);
} else {
  console.log("[warn] no music — continuing silent bed");
}

// ---------------- audio paths + props ----------------
const sceneAudio = scenes.map((s, i) => {
  if (!String(s.text || "").trim()) return null;
  const rel = `tech-audio/audio/beat-${String(i).padStart(2, "0")}.mp3`;
  return fs.existsSync(path.join(PUB, rel)) && fs.statSync(path.join(PUB, rel)).size > 2048 ? rel : null;
});
const props = {
  scenes,
  starts,
  durs: dursArr,
  sceneWords: scenes.map((s, i) => buildWords(byI.get(i)?.words)),
  sceneAudio,
  music,
};
const propsPath = path.join(PUB, "tech-video.json");
fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
console.log(`[props] ${propsPath}`);

// ---------------- render ----------------
const ensure = spawnSync("npx", ["remotion", "browser", "ensure"], { cwd: EXPL, ...spawnOpts });
if (ensure.status !== 0) throw new Error("browser ensure failed");
const outMp4 = path.join(EXPL, "out", "tech-video.mp4");
const args = (conc) => ["remotion", "render", "remotion/index.ts", "TechVideo", outMp4, `--props=${propsPath}`, `--concurrency=${conc}`, "--timeout=240000", "--port=3492"];
let r = spawnSync("npx", args(3), { cwd: EXPL, ...spawnOpts });
if (r.status !== 0) r = spawnSync("npx", args(2), { cwd: EXPL, ...spawnOpts });
if (r.status !== 0) throw new Error("render failed");
console.log(`[DONE] ${outMp4} (${(fs.statSync(outMp4).size / 1048576).toFixed(1)} MB, ${totalS}s)`);
