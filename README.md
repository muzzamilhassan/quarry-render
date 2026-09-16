# Quarry Render — long-form documentary render pipeline

Renders 10+ minute documentary videos for the Quarry Studio channels,
fully on GitHub Actions (free for public repos). **No uploads, no tokens,
no private data live here** — this repo only renders. The private
`automation` repo downloads the finished artifacts and uploads them.

## Flow (per channel, one video/day)
1. AI picks a fresh story topic (deduped vs `state/longform-<channel>.json`)
2. AI writes the 10-min script (Gemini -> Groq fallback)
3. Microsoft Edge-TTS narration (free)
4. Pexels + Pixabay photos, one approved music track (see `longvideo/approved-music.json`)
5. Remotion renders 1920x1080@24fps with karaoke captions
6. Wikipedia persona photo + Remotion still = thumbnail
7. Emits `lf-meta-<channel>.json` (title, chapters, publish time, credits)

## Channels
investors-compass (navy/gold) | money-rulebook (cream vox) |
debt-free-doctrine (black/neon) | quotequarry (cream vox)

## Licenses / credits
- Music: Kevin MacLeod (incompetech.com), CC BY 4.0 — credited per video description
- Photos: Pexels / Pixabay free licenses; persona images from Wikipedia/Wikimedia (CC)

Manual run: Actions -> Long-form Render -> Run workflow
(channel = blank for all 4, minutes = 10)
