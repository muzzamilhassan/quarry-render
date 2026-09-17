// LONG-FORM uploader (PRIVATE repo — the only place YouTube tokens live).
// Finds the latest successful render in muzzamilhassan/quarry-render (public),
// downloads its artifact, and schedules the upload at the channel's ET slot.
// Idempotent: an artifact (by id) is never uploaded twice.
//   node longform-upload.mjs [--channel investors-compass]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { google } from "googleapis";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");
const RENDER_REPO = "muzzamilhassan/quarry-render";
const GH_TOKEN = process.env.GITHUB_PAT || process.env.GH_TOKEN || "";
const ONLY = process.argv.indexOf("--channel");
const ONLY_SLUG = ONLY > 0 ? process.argv[ONLY + 1] : null;

try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { }

const CHANNELS = ["investors-compass", "money-rulebook", "debt-free-doctrine", "quotequarry"];
const SLOT_ET = { "investors-compass": "19:00", "money-rulebook": "19:45", "debt-free-doctrine": "20:30", "quotequarry": "21:15" };
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
const UPCOMING = new Date("2026-01-01"); // sentinel
const UPL = path.join(ROOT, "state", "longform-uploads.json");
const uploads = (() => { try { return JSON.parse(fs.readFileSync(UPL, "utf8")); } catch { return {}; } })();

const gh = (args) => {
  const r = spawnSync("gh", args, { encoding: "utf8", env: { ...process.env, GH_TOKEN }, shell: process.platform === "win32" });
  return r;
};
const ghJson = (args) => {
  const r = gh(args);
  try { return JSON.parse(r.stdout); } catch { return null; }
};

function etToUTC(y, mo, d, h, mi) {
  let ts = Date.UTC(y, mo - 1, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  for (let k = 0; k < 2; k++) {
    const parts = dtf.formatToParts(new Date(ts));
    const g = (x) => Number(parts.find((q) => q.type === x).value);
    ts += ts - Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  }
  return ts;
}
function nextSlotET(hhmm) {
  const [H, M] = hhmm.split(":").map(Number);
  for (let add = 1; add <= 4; add++) {
    const cand = new Date(Date.now() + add * 86400000);
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(cand);
    const g = (x) => Number(p.find((q) => q.type === x).value);
    const ts = etToUTC(g("year"), g("month"), g("day"), H, M);
    if (ts > Date.now() + 2 * 3600 * 1000) return new Date(ts).toISOString().replace(/\.\d+Z$/, "Z");
  }
  throw new Error("no slot found");
}
function channelAuth(slug) {
  const envName = `YT_TOKEN_${slug.toUpperCase().replace(/-/g, "_")}`;
  const tokenFile = path.join(ROOT, "yt-mcp", "channels", slug, "token.json");
  const raw = process.env[envName] || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "");
  if (!raw) throw new Error("no token for " + slug);
  const t = JSON.parse(raw);
  const a = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  a.setCredentials({ refresh_token: t.refresh_token });
  return a;
}

async function processChannel(slug) {
  if (ONLY_SLUG && slug !== ONLY_SLUG) return;
  console.log(`\n=== ${slug} ===`);
  const runs = ghJson(["run", "list", "-R", RENDER_REPO, "--workflow=longform-render.yml", "--status=success", "--limit", "8", "--json", "databaseId,createdAt"]) || [];
  if (!runs.length) { console.log("[skip] no successful renders"); return; }

  // newest run that has this channel's artifact and is not yet uploaded
  let chosen = null;
  const skippedShort = uploads[`${slug}-short`] || [];
  const inbox = path.join(DIR, "lf-inbox", slug);
  for (const run of runs) {
    const arts = ghJson(["api", `repos/${RENDER_REPO}/actions/runs/${run.databaseId}/artifacts`, "--jq", ".artifacts"]) || [];
    const art = arts.find((a) => a.name === `lf-${slug}` && !a.expired);
    if (!art) continue;
    if ((uploads[slug] || []).some((u) => u.artifactId === art.id)) { console.log(`[skip] artifact ${art.id} already uploaded`); continue; }
    if (skippedShort.includes(art.id)) { console.log(`[skip] artifact ${art.id} is a short test render`); continue; }

    fs.rmSync(inbox, { recursive: true, force: true });
    fs.mkdirSync(inbox, { recursive: true });
    const dl = gh(["run", "download", String(run.databaseId), "-R", RENDER_REPO, "-n", `lf-${slug}`, "-D", inbox]);
    if (dl.status !== 0) { console.log(`[warn] download failed for run ${run.databaseId}: ${String(dl.stderr).slice(0, 90)}`); continue; }
    const metaPath = path.join(inbox, `lf-meta-${slug}.json`);
    if (!fs.existsSync(metaPath)) { console.log("[warn] meta missing in artifact"); continue; }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.durationMs && meta.durationMs < 8 * 60 * 1000) {
      console.log(`[skip] artifact ${art.id} is a short test render (${Math.round(meta.durationMs / 1000)}s)`);
      uploads[`${slug}-short`] = skippedShort.concat([art.id]).slice(-40);
      fs.mkdirSync(path.dirname(UPL), { recursive: true });
      fs.writeFileSync(UPL, JSON.stringify(uploads, null, 2));
      continue;
    }
    chosen = { run: run.databaseId, art, meta };
    break;
  }
  if (!chosen) { console.log("[skip] nothing new to upload"); return; }
  console.log(`[found] run ${chosen.run} artifact ${chosen.art.id}`);
  const meta = chosen.meta;
  const videoFile = path.join(inbox, meta.videoFile);
  const thumbFile = path.join(inbox, meta.thumbFile);
  if (!fs.existsSync(videoFile)) throw new Error("video missing in artifact");
  const sizeMb = (fs.statSync(videoFile).size / 1048576).toFixed(1);
  console.log(`[artifact] "${meta.title}" ${sizeMb} MB`);

  const publishAt = meta.publishAt && new Date(meta.publishAt) > new Date(Date.now() + 2 * 3600 * 1000)
    ? meta.publishAt
    : nextSlotET(SLOT_ET[slug] || "19:00");

  const auth = channelAuth(slug);
  const youtube = google.youtube({ version: "v3", auth });
  const readable = new Readable();
  readable._read = () => { };
  readable.push(fs.readFileSync(videoFile));
  readable.push(null);
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: String(meta.title).slice(0, 95), description: meta.description, tags: meta.tags, categoryId: "27", defaultLanguage: "en", defaultAudioLanguage: "en" },
      status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false },
    },
    media: { body: readable },
  });
  const videoId = res.data.id;
  console.log(`[upload] scheduled 👉 https://youtube.com/watch?v=${videoId} (public ${publishAt})`);
  if (fs.existsSync(thumbFile)) {
    try {
      const ts = new Readable(); ts._read = () => { }; ts.push(fs.readFileSync(thumbFile)); ts.push(null);
      await youtube.thumbnails.set({ videoId, media: { body: ts } });
      console.log("[upload] thumbnail set");
    } catch (e) { console.log(`[warn] thumbnail: ${String(e.message).slice(0, 80)}`); }
  }
  uploads[slug] = (uploads[slug] || []).concat([{ date: new Date().toISOString().slice(0, 10), title: meta.title, videoId, publishAt, artifactId: chosen.art.id, runId: chosen.run }]).slice(-100);
  fs.mkdirSync(path.dirname(UPL), { recursive: true });
  fs.writeFileSync(UPL, JSON.stringify(uploads, null, 2));
  try {
    const ntopic = process.env.NTFY_TOPIC;
    if (ntopic) {
      await fetch(`https://ntfy.sh/${ntopic}`, { method: "POST", headers: { "Content-Type": "text/plain", Title: `Long-form uploaded: ${slug}` }, body: `${meta.title}\nGoes public ${publishAt}\nhttps://youtube.com/watch?v=${videoId}` });
    }
  } catch { }
}

for (const slug of CHANNELS) {
  try {
    await processChannel(slug);
  } catch (e) {
    console.log(`[FAIL] ${slug}: ${String(e.message).slice(0, 200)}`);
  }
}
console.log("\n[uploader] done");
