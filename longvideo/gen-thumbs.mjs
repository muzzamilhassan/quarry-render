// Generate 4 channel thumbnails via OpenRouter image models (key: OPENAI_IMG_KEY env or .env)
// Outputs: ../quarry-render-relative gen/ folder -> gen-<channel>.png
import fs from "node:fs";
import path from "node:path";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");
let envLines = [];
try { envLines = fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n"); } catch { }
for (const line of envLines) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.OPENAI_IMG_KEY;
if (!KEY) throw new Error("no OPENAI_IMG_KEY");

const JOBS = [
  {
    ch: "investors-compass",
    prompt: `YouTube thumbnail, 16:9. Dark navy background. Two shocked elderly economist faces in circular gold-rimmed frames, wearing suits. A giant glowing red crack splitting the screen between them. Huge bold white text top: "THE $46B MISTAKE". Small gold banner bottom-left: "INVESTOR'S COMPASS". Dramatic cinematic lighting, high contrast, crisp text, style of top finance documentary channels. No other text.`,
  },
  {
    ch: "money-rulebook",
    prompt: `YouTube thumbnail, 16:9. Dark background with a huge corporate glass skyscraper, a massive red arrow crashing down through it, shattered glass particles. Giant bold white text: "COLLAPSED" and a smaller line "and everyone saw it coming". Small red banner bottom-left: "MONEY RULEBOOK". Dramatic, high contrast, crisp readable text, style of top business documentary channels. No other text.`,
  },
  {
    ch: "debt-free-doctrine",
    prompt: `YouTube thumbnail, 16:9. Dark background. A giant credit card caught in a wooden mousetrap, dramatic spotlight. Bold white text top: "THE MINIMUM PAYMENT TRAP", a red angled stamp "$35/MO = 27 YEARS". Small green banner bottom-left: "DEBT-FREE DOCTRINE". High contrast, crisp text, cinematic, style of top personal finance channels. No other text.`,
  },
  {
    ch: "quotequarry",
    prompt: `YouTube thumbnail, 16:9. Pure black background. A marble statue bust of Marcus Aurelius on the right side, dramatic single warm spotlight. A small human silhouette standing before giant ancient roman clocks. Huge bold yellow text: "MEMENTO MORI" and smaller white text "REMEMBER YOU WILL DIE". Small yellow banner bottom-left: "QUOTE QUARRY". Minimal, dramatic, crisp text, style of top stoicism channels. No other text.`,
  },
];

const outDir = path.join(DIR, "gen");
fs.mkdirSync(outDir, { recursive: true });

for (const job of JOBS) {
  let done = false;
  for (const model of ["google/gemini-3.1-flash-image", "google/gemini-3-pro-image", "openai/gpt-5-image-mini"]) {
    if (done) break;
    try {
      console.log(`[gen] ${job.ch} via ${model} ...`);
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: job.prompt }], modalities: ["image", "text"] }),
      });
      if (!r.ok) { console.log(`  [warn] ${model}: HTTP ${r.status}`); continue; }
      const d = await r.json();
      const msg = d.choices?.[0]?.message;
      const b64 = msg?.images?.[0]?.source?.data || msg?.images?.[0]?.image_url?.url?.split(",")[1];
      if (!b64) { console.log(`  [warn] ${model}: no image in response`); continue; }
      const out = path.join(outDir, `gen-${job.ch}.png`);
      fs.writeFileSync(out, Buffer.from(b64, "base64"));
      console.log(`  [done] ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
      done = true;
    } catch (e) {
      console.log(`  [warn] ${model}: ${String(e.message).slice(0, 90)}`);
    }
  }
  if (!done) console.log(`[FAIL] ${job.ch}`);
}
console.log("all done");
