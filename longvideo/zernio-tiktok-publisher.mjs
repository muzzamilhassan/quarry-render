// Zernio TikTok Publisher — Automated TikTok posting via Zernio Unified API
// Mode: DIRECT POST (auto-publishes to the profile). Zernio's TikTok app has a
// shared direct-post capacity that occasionally reports "at capacity" — that
// frees up over time, so failed attempts are retried with a delay. Set
// ZERNIO_TIKTOK_DRAFT=true to fall back to Creator-Inbox drafts instead.
import fs from 'node:fs';
import path from 'node:path';

const ZERNIO_API = 'https://api.zernio.com/v1';
const CAPTION_LIMIT = 2200; // TikTok caption cap incl. hashtags

let envStr = '';
try {
  if (fs.existsSync('.env')) {
    envStr = fs.readFileSync('.env', 'utf8');
  } else if (fs.existsSync('C:/Users/Revnix/Documents/youtube-automation/.env')) {
    envStr = fs.readFileSync('C:/Users/Revnix/Documents/youtube-automation/.env', 'utf8');
  }
} catch (e) { }

const envOf = (key) => process.env[key] || (envStr.match(new RegExp(`^${key}=(.+)$`, 'm')) || [])[1]?.trim() || '';

const API_KEY = envOf('ZERNIO_API_KEY');
const ACCOUNT_ID = envOf('ZERNIO_TIKTOK_ACCOUNT_ID');
// Auto-publish unless explicitly opted into drafts (ZERNIO_TIKTOK_DRAFT=true)
const DRAFT_MODE = ['1', 'true', 'yes'].includes((envOf('ZERNIO_TIKTOK_DRAFT') || '').toLowerCase());
const RETRY_ATTEMPTS = parseInt(envOf('ZERNIO_TIKTOK_RETRIES') || '1', 10); // extra attempts after the first
const RETRY_WAIT_MS = parseInt(envOf('ZERNIO_TIKTOK_RETRY_WAIT_MS') || '30000', 10);
// When TikTok's direct-post capacity is full, the post is rescheduled this many
// hours ahead (Zernio auto-publishes it then) instead of dropping it.
const RESCHEDULE_HOURS = parseFloat(envOf('ZERNIO_TIKTOK_RESCHEDULE_HOURS') || '3');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function clip(text, limit = CAPTION_LIMIT) {
  const s = String(text || '').trim();
  return s.length <= limit ? s : s.substring(0, limit - 1).trimEnd() + '…';
}

/**
 * Request presigned upload URL for media
 */
export async function getPresignedUrl(filename = 'reel.mp4', contentType = 'video/mp4') {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY is missing in .env');

  const res = await fetch(`${ZERNIO_API}/media/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ filename, contentType })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Zernio presign failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data; // { uploadUrl, publicUrl, key, expiresIn }
}

/**
 * Upload video buffer to presigned Cloudflare R2 / S3 URL
 */
export async function uploadVideoBuffer(uploadUrl, videoBuffer, contentType = 'video/mp4') {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: videoBuffer
  });

  if (!res.ok) {
    throw new Error(`Upload to storage failed (${res.status}): ${res.statusText}`);
  }
}

/**
 * Check accounts linked to Zernio
 */
export async function listAccounts() {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;
  const res = await fetch(`${ZERNIO_API}/accounts`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return await res.json();
}

// Zernio has no GET /posts/:id — watch the list endpoint for our post's
// platform status. Delivery verdict arrives within seconds of creation.
async function waitForPostStatus(postId, targetAccountId, { timeoutMs = 75000, intervalMs = 6000 } = {}) {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const res = await fetch(`${ZERNIO_API}/posts`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      const data = await res.json();
      const post = (data.posts || []).find(p => p._id === postId);
      if (!post) continue;
      const pl = (post.platforms || []).find(p => (p.accountId?._id || p.accountId) === targetAccountId) || (post.platforms || [])[0] || {};
      if (pl.status === 'published') return { ok: true, status: pl.status };
      if (pl.status === 'failed') return { ok: false, status: pl.status, error: pl.errorMessage || '', category: pl.errorCategory || '' };
    } catch (e) { }
  }
  return { ok: false, status: 'TIMEOUT', error: 'no delivery verdict in time (check Zernio dashboard)' };
}

// Which TikTok accounts to post to. Priority: explicit comma-separated
// ZERNIO_TIKTOK_ACCOUNT_IDS > every active TikTok account linked to the
// Zernio profile (auto-discovery — new accounts are picked up with zero
// config) > legacy single ZERNIO_TIKTOK_ACCOUNT_ID if discovery fails.
async function resolveTargetAccounts() {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;
  const explicit = (envOf('ZERNIO_TIKTOK_ACCOUNT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (explicit.length) return explicit;

  try {
    const res = await fetch(`${ZERNIO_API}/accounts`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    const accounts = (data.accounts || [])
      .filter(a => (a.platform || '').toLowerCase() === 'tiktok' && a.platformStatus !== 'inactive')
      .map(a => a._id);
    if (accounts.length) return accounts;
  } catch (e) { }

  const legacy = envOf('ZERNIO_TIKTOK_ACCOUNT_ID') || ACCOUNT_ID;
  return legacy ? [legacy] : [];
}

async function createPost({ content, mediaUrl, scheduledFor, accountId } = {}) {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;
  const targetAccount = accountId || envOf('ZERNIO_TIKTOK_ACCOUNT_ID') || ACCOUNT_ID;
  const payload = {
    publishNow: !scheduledFor,
    platforms: [
      {
        platform: 'tiktok',
        accountId: targetAccount,
        platformSpecificData: {
          tiktokSettings: {
            draft: DRAFT_MODE,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            allow_comment: true,
            allow_duet: true,
            allow_stitch: true
          }
        }
      }
    ],
    content,
    mediaItems: [
      {
        type: 'video',
        url: mediaUrl
      }
    ]
  };

  const res = await fetch(`${ZERNIO_API}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(scheduledFor ? { ...payload, scheduledFor } : payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`post creation failed (${res.status}): ${JSON.stringify(data)}`);
  const postId = data?.post?._id || data?.id || data?._id;
  if (!postId) throw new Error(`no post id in response: ${JSON.stringify(data)}`);
  return postId;
}

/**
 * Main publisher function for TikTok via Zernio
 * Compatible with run-content-machine.mjs interface: publishToTikTok({ videoBuffer, title })
 */
export async function publishToTikTok({ videoBuffer, videoUrl, title } = {}) {
  const apiKey = envOf('ZERNIO_API_KEY') || API_KEY;

  if (!apiKey) {
    console.warn('[Zernio TikTok] Skipped: ZERNIO_API_KEY missing in .env');
    return null;
  }

  const targetAccounts = await resolveTargetAccounts();
  if (!targetAccounts.length) {
    console.warn('[Zernio TikTok] Skipped: no TikTok accounts found (connect one in the Zernio dashboard).');
    return null;
  }

  const mode = DRAFT_MODE ? 'Creator Inbox draft' : 'DIRECT POST (auto-publish)';
  try {
    let finalMediaUrl = videoUrl;

    if (!finalMediaUrl && videoBuffer) {
      console.log(`      [TikTok] Uploading video to Zernio storage (${mode}, ${targetAccounts.length} account${targetAccounts.length > 1 ? 's' : ''})...`);
      const presign = await getPresignedUrl('reel.mp4', 'video/mp4');
      await uploadVideoBuffer(presign.uploadUrl, videoBuffer, 'video/mp4');
      finalMediaUrl = presign.publicUrl;
      console.log('      [TikTok] Video uploaded successfully.');
    }

    if (!finalMediaUrl) {
      console.warn('      [TikTok] Skipped: No video buffer or video URL provided.');
      return null;
    }

    const content = clip(title || '');
    const postedIds = [];

    for (const accountId of targetAccounts) {
      let lastError = '';

      for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          console.log(`      [TikTok] Retry ${attempt}/${RETRY_ATTEMPTS} in ${Math.round(RETRY_WAIT_MS / 1000)}s...`);
          await sleep(RETRY_WAIT_MS);
        }

        console.log(`      [TikTok] Submitting post via Zernio (${mode})...`);
        let postId;
        try {
          postId = await createPost({ content, mediaUrl: finalMediaUrl, accountId });
        } catch (e) {
          console.warn('      [TikTok] Zernio post creation failed:', e.message);
          lastError = e.message;
          continue;
        }

        const verdict = await waitForPostStatus(postId, accountId);
        if (verdict.ok) {
          console.log(`      ✓ TikTok auto-published! ID: ${postId}`);
          postedIds.push(postId);
          break;
        }
        if (verdict.status === 'TIMEOUT') {
          // Undetermined — treat as accepted so the caller doesn't double-post
          console.log(`      ✓ TikTok post accepted (ID: ${postId}); delivery verdict pending on Zernio's side.`);
          postedIds.push(postId);
          break;
        }
        lastError = `${verdict.category} — ${verdict.error}`;
        console.warn(`      [TikTok] Attempt ${attempt + 1} failed: ${lastError}`);
      }

      if (postedIds.includes(accountId)) continue;

      // Direct-post capacity is full (TikTok throttles third-party apps by time
      // of day). Auto-publish the same post a few hours ahead via Zernio's
      // scheduler instead of dropping it — still zero manual work, still public.
      if (!DRAFT_MODE && RESCHEDULE_HOURS > 0) {
        const when = new Date(Date.now() + RESCHEDULE_HOURS * 3600 * 1000);
        console.log(`      [TikTok] Capacity full — rescheduling auto-publish for ${when.toISOString()}...`);
        try {
          const scheduledId = await createPost({ content, mediaUrl: finalMediaUrl, scheduledFor: when.toISOString(), accountId });
          console.log(`      ✓ TikTok post scheduled for auto-publish at ${when.toISOString()} (ID: ${scheduledId})`);
          postedIds.push(scheduledId);
          continue;
        } catch (e) {
          console.warn('      [TikTok] Reschedule failed:', e.message);
        }
      }

      console.warn('      [TikTok] All attempts failed for this account:', lastError);
    }

    if (!postedIds.length) return null;
    return postedIds.join(',');
  } catch (e) {
    console.warn('      [TikTok] Error publishing via Zernio:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('zernio-tiktok-publisher.mjs')) {
  const cmd = process.argv[2] || 'test';

  if (cmd === 'accounts' || cmd === 'test') {
    console.log(`Fetching connected accounts from Zernio (mode: ${DRAFT_MODE ? 'DRAFT' : 'DIRECT POST'})...`);
    listAccounts().then(data => {
      console.log('\n--- Connected Accounts ---');
      if (data.accounts && data.accounts.length) {
        data.accounts.forEach(acc => {
          console.log(`- Platform: ${acc.platform} | User: @${acc.username || acc.displayName} | ID: ${acc._id} | Status: ${acc.platformStatus}`);
        });
      } else {
        console.log('No accounts found:', data);
      }
    }).catch(err => console.error(err));
  } else if (cmd === 'post-all-qq') {
    // Post every produced QuoteQuarry reel from the outbox to TikTok (dedup by caption)
    const dir = 'fb-outbox/quotequarry';
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /-s[0-9]+[.]json([.][a-z-]+)*$/.test(f)) : [];
    console.log('  [debug] outbox:', fs.existsSync(dir) ? fs.readdirSync(dir) : 'DIR MISSING');
    const apiKey = envOf('ZERNIO_API_KEY');
    let existing = new Set();
    try {
      const res = await fetch(`${ZERNIO_API}/posts`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const d = await res.json();
      const posts = Array.isArray(d) ? d : (d.posts || d.data || []);
      for (const pp of posts) existing.add(String(pp.content || '').trim().toLowerCase());
    } catch (e) { console.log('  [warn] could not list existing posts:', String(e.message).slice(0, 80)); }
    const entries = files.map(f => ({ f, stamp: parseInt(f.split('-')[0], 10) || 0 })).sort((a, b) => a.stamp - b.stamp);
    let posted = 0;
    for (const e of entries) {
      let meta;
      try { meta = JSON.parse(fs.readFileSync(path.join(dir, e.f), 'utf8')); } catch (e2) { console.log('  parse failed:', e.f, String(e2.message).slice(0, 60)); continue; }
      const caption = clip(`${meta.title || ''} ${(meta.tags || []).map(t => '#' + String(t).replace(/\s+/g, '')).join(' ')}`);
      if (existing.has(caption.trim().toLowerCase())) { console.log('  skip (already on TikTok):', String(meta.title).slice(0, 40)); continue; }
      if (!meta.videoFile || !fs.existsSync(meta.videoFile)) { console.log('  skip (video missing):', e.f); continue; }
      try {
        await publishToTikTok({ videoBuffer: fs.readFileSync(meta.videoFile), title: caption });
        posted++;
      } catch (err) { console.log('  post failed:', String(err.message).slice(0, 120)); }
    }
    console.log(`[TikTok] posted ${posted} reel(s) for quotequarry`);
    process.exit(0);
  } else if (cmd === 'post') {
    const videoFile = process.argv[3];
    const caption = process.argv[4] || 'Test video from automated workflow';
    if (!videoFile || !fs.existsSync(videoFile)) {
      console.error('Usage: node zernio-tiktok-publisher.mjs post <video-file.mp4> [caption]');
      process.exit(1);
    }
    const buf = fs.readFileSync(videoFile);
    publishToTikTok({ videoBuffer: buf, title: caption }).then(res => {
      console.log('Result:', res);
      process.exit(res ? 0 : 1);
    });
  }
}
