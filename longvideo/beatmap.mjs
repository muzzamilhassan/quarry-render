// Narration beat-map: derives per-scene sentence boundaries + word timings from the
// edge-tts word boundaries edge_batch.py already produces. tech-video.tsx reads this
// so scene elements reveal in narration order — the screen becomes a puppet controlled
// by the voice (CloudXBerry-style choreography). Null-safe: scenes without TTS word
// data are omitted, and every renderer falls back to its legacy fixed delays.
//
// Sentence boundary = word ends with . ! ? (rare in TTS boundaries) OR a pause gap
// > 350ms to the next word (calm teaching voice has clear pauses — house style).

export function buildBeatmap(scenes, byI) {
  const out = {};
  for (let i = 0; i < scenes.length; i++) {
    const d = byI.get(i);
    if (!d || !Array.isArray(d.words) || !d.words.length) continue;
    const words = d.words.map((w) => ({
      w: w.w,
      t0: Math.round(w.s * 1000),
      t1: Math.round((w.s + w.d) * 1000),
    }));
    const sentences = [];
    let cur = null;
    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      if (!cur) cur = { t0: w.t0, t1: w.t1, words: [] };
      cur.words.push(w);
      cur.t1 = w.t1;
      const nxt = words[j + 1];
      const boundary = /[.!?…]["')]*$/.test(w.w) || (nxt ? nxt.t0 - w.t1 > 350 : true);
      if (boundary) {
        sentences.push({
          id: sentences.length,
          t0: cur.t0,
          t1: cur.t1,
          text: cur.words.map((x) => x.w).join(" "),
        });
        cur = null;
      }
    }
    if (sentences.length) out[i] = { sentences, words };
  }
  return Object.keys(out).length ? out : null;
}
