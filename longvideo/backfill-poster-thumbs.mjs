// Backfill: give EVERY existing long-form video the How-Dev-Works poster
// thumbnail. Shorts (<=180s) are skipped. The CURRENT thumbnail of each video
// is downloaded to state/thumb-backup/<videoId>.jpg BEFORE it is overwritten,
// so nothing is ever lost. Idempotent via state/poster-backfill.json.
//   node longvideo/backfill-poster-thumbs.mjs [--channel investors-compass] [--dry]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { google } from "googleapis";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..");

try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { }

const CHANNELS = ["investors-compass", "money-rulebook", "debt-free-doctrine", "quotequarry"];
const POSTER_KEY = { "investors-compass": "ic", "money-rulebook": "mr", "debt-free-doctrine": "dfd", "quotequarry": "qq" };
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
const ONLY = process.argv.indexOf("--channel");
const ONLY_SLUG = ONLY > 0 ? process.argv[ONLY + 1] : null;
const DRY = process.argv.includes("--dry");
const BACKUP_DIR = path.join(ROOT, "state", "thumb-backup");
const LEDGER = path.join(ROOT, "state", "poster-backfill.json");
const MIN_SEC = 180; // long-form docs are 10+ min; shorts are <=3 min

const ledger = (() => { try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch { return {}; } })();

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

function durSec(iso) {
  const m = String(iso || "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + +(m[4] || 0);
}

async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("http " + r.status + " for " + url);
  return Buffer.from(await r.arrayBuffer());
}

async function backupThumb(youtube, videoId) {
  const dest = path.join(BACKUP_DIR, `${videoId}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) return dest; // already backed up
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const q of ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"]) {
    try {
      const buf = await fetchBuf(`https://i.ytimg.com/vi/${videoId}/${q}`);
      if (buf.length > 5000) { fs.writeFileSync(dest, buf); return dest; }
    } catch { }
  }
  throw new Error("no thumbnail available to back up");
}

async function processChannel(slug) {
  if (ONLY_SLUG && slug !== ONLY_SLUG) return;
  console.log(`\n=== ${slug} ===`);
  const youtube = google.youtube({ version: "v3", auth: channelAuth(slug) });

  const ch = await youtube.channels.list({ part: "contentDetails", mine: true });
  const uploadsPl = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPl) { console.log("[skip] no uploads playlist"); return; }

  const ids = [];
  let page = undefined;
  for (let p = 0; p < 4; p++) {
    const items = await youtube.playlistItems.list({ part: "contentDetails", playlistId: uploadsPl, maxResults: 50, pageToken: page });
    for (const it of items.data.items || []) ids.push(it.contentDetails.videoId);
    page = items.data.nextPageToken;
    if (!page) break;
  }
  if (!ids.length) { console.log("[skip] no videos on channel"); return; }

  const vids = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await youtube.videos.list({ part: "snippet,contentDetails,status", id: ids.slice(i, i + 50) });
    vids.push(...(r.data.items || []));
  }
  const longs = vids.filter(v => durSec(v.contentDetails?.duration) >= MIN_SEC);
  console.log(`[scan] ${vids.length} videos on channel, ${longs.length} long-form`);
  if (DRY) for (const v of longs) console.log(`  [dry] ${v.id}  "${v.snippet.title}"`);

  let done = 0, skipped = 0, failed = 0;
  for (const v of longs) {
    const videoId = v.id;
    const title = v.snippet.title;
    if (ledger[videoId]?.done) { skipped++; continue; }
    try {
      const backup = await backupThumb(youtube, videoId);
      const out = path.join(ROOT, "thumbnails", "demos", `backfill-${videoId}.png`);
      const r = spawnSync("node", [path.join(ROOT, "thumbnails", "poster-factory.mjs"),
        "--channel", POSTER_KEY[slug] || "ic", "--title", title, "--out", out], { encoding: "utf8" });
      if (r.status !== 0 || !fs.existsSync(out)) throw new Error("poster failed: " + String(r.stderr || r.stdout).slice(-120));
      if (!DRY) {
        const media = new Readable(); media._read = () => { }; media.push(fs.readFileSync(out)); media.push(null);
        await youtube.thumbnails.set({ videoId, media: { body: media } });
      }
      ledger[videoId] = { channel: slug, title, done: new Date().toISOString().slice(0, 10), dry: DRY || undefined, oldThumb: path.relative(ROOT, backup) };
      done++;
      console.log(`[ok ${done}] ${videoId}  "${title.slice(0, 60)}" (old thumb saved)`);
      fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    } catch (e) {
      failed++;
      ledger[videoId] = ledger[videoId] || { channel: slug, title };
      ledger[videoId].lastError = String(e.message).slice(0, 160);
      console.log(`[FAIL] ${videoId}  "${title.slice(0, 50)}" — ${String(e.message).slice(0, 100)}`);
      fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    }
  }
  console.log(`[done] ${slug}: ${done} updated, ${skipped} already done, ${failed} failed`);
}

for (const slug of CHANNELS) {
  try { await processChannel(slug); }
  catch (e) { console.log(`[channel-fail] ${slug}: ${String(e.message).slice(0, 140)}`); }
}
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
const total = Object.values(ledger).filter(v => v.done).length;
console.log(`\nALL DONE — ${total} videos now wear the poster style${DRY ? " (DRY RUN — nothing was changed)" : ""}`);
try {
  if (process.env.NTFY_TOPIC && !DRY) {
    await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, { method: "POST", headers: { "Content-Type": "text/plain", Title: "Poster thumbnails backfill" }, body: `Backfill complete. ${total} long videos updated across 4 channels. Old thumbnails backed up in state/thumb-backup/.` });
  }
} catch { }
