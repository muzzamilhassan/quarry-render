import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ============ CloudXBerry-style design kit ============
// The reference channel's grammar (dissection: how-dev-works docs/research/2026-09-26-cloudxberry-animation-dissection.md):
// statement headline with ONE keyword in the chapter accent, fake app windows, gradient
// method pills, rows that pop per sentence, a DB panel whose counter ticks and whose table
// grows as code lines land, selector rows with a moving highlight, matrices that fill
// cell-by-cell, big glowing chapter numbers. All choreography rides the narration beat-map:
// sentence k drives element k. Without a beat map every element falls back to fixed delays.

export const ACCENT_MAP: Record<string, string> = {
  purple: "#A78BFA", orange: "#FB923C", gold: "#FACC15", green: "#34D399",
  pink: "#F472B6", red: "#F87171", cyan: "#22D3EE", blue: "#60A5FA",
};
export const PALETTE = ["purple", "orange", "gold", "green", "pink"];

const WHITE = "#F8FAFC";
const DIM = "rgba(248,250,252,0.5)";
const PANEL = "#121418";
const SANS = "Inter, Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, 'DejaVu Sans Mono', monospace";

const glow = (color: string, strength = 0.4) => ({
  boxShadow: `0 0 26px ${color}${Math.round(strength * 255).toString(16).padStart(2, "0")}, 0 0 70px ${color}18`,
});

// "design around *resources*" → [{t:"design around "},{t:"resources",accent:true},...]
export function splitKeyword(headline: string): Array<{ t: string; accent: boolean }> {
  const m = String(headline || "").match(/\*(.+?)\*/);
  if (!m) return [{ t: String(headline || ""), accent: false }];
  return [
    { t: String(headline).slice(0, m.index || 0), accent: false },
    { t: m[1], accent: true },
    { t: String(headline).slice((m.index || 0) + m[0].length), accent: false },
  ];
}

export const useBeatClock = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f, fps, ms: (f / fps) * 1000 };
};

// entrance helper: sentence k of the scene (or legacy delay when no beat data)
export const enterAt = (beat: any, k: number, n: number, fps: number, legacy: number): number => {
  const sents = beat?.sentences;
  if (!sents || !sents.length) return legacy;
  const frac = n <= 1 ? 0 : k / (n - 1);
  const t0 = sents[0].t0, t1 = sents[sents.length - 1].t1;
  const target = t0 + frac * (t1 - t0);
  let best = sents[0];
  for (const s of sents) if (Math.abs(s.t0 - target) < Math.abs(best.t0 - target)) best = s;
  return Math.round((best.t0 / 1000) * fps);
};

export const sentenceIndexNow = (beat: any, ms: number): number => {
  const sents = beat?.sentences;
  if (!sents || !sents.length) return -1;
  const i = sents.findIndex((s: any) => ms >= s.t0 - 80 && ms < s.t1 + 450);
  return i;
};

// ---------------- chrome ----------------

// statement headline, top-center, ONE keyword in the chapter accent (their signature)
export const Headline: React.FC<{ headline: string; accent: string; delay?: number }> = ({ headline, accent, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", top: 92, left: 120, right: 120, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 26}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 78, color: WHITE, lineHeight: 1.14 }}>
        {splitKeyword(headline).map((part, i) => (
          <span key={i} style={part.accent ? { color: accent, textShadow: `0 0 34px ${accent}66` } : undefined}>{part.t}</span>
        ))}
      </div>
    </div>
  );
};

// fake app window with traffic lights + title (optionally a URL bar)
export const Window: React.FC<{ title: string; w: number; accent: string; delay?: number; url?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({ title, w, accent, delay = 0, url = false, style, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 150 } });
  return (
    <div style={{ position: "absolute", width: w, transform: `scale(${Math.max(s, 0.01)})`, transformOrigin: "center", ...style }}>
      <div style={{ background: "#0E1013", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 18, overflow: "hidden", ...glow(accent, 0.22) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: url ? "13px 16px" : "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 11, height: 11, borderRadius: 6, background: "#FF5F57" }} />
          <div style={{ width: 11, height: 11, borderRadius: 6, background: "#FEBC2E" }} />
          <div style={{ width: 11, height: 11, borderRadius: 6, background: "#28C840" }} />
          {url ? (
            <div style={{ marginLeft: 12, flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.045)", borderRadius: 9, padding: "6px 14px" }}>
              <span style={{ color: accent, fontSize: 16 }}>⛅</span>
              <span style={{ fontFamily: MONO, fontSize: 17, color: DIM }}>{title}</span>
            </div>
          ) : (
            <div style={{ marginLeft: 10, fontFamily: MONO, fontSize: 17, color: DIM }}>{title}</div>
          )}
        </div>
        <div style={{ padding: "22px 26px" }}>{children}</div>
      </div>
    </div>
  );
};

// gradient pill (method chips, tags) — their POST/GET look
export const Pill: React.FC<{ text: string; accent: string; small?: boolean; active?: boolean }> = ({ text, accent, small = false, active = true }) => (
  <span style={{
    display: "inline-block", fontFamily: MONO, fontWeight: 700,
    fontSize: small ? 17 : 21, color: active ? "#0B0D10" : DIM,
    background: active ? `linear-gradient(180deg, ${accent}, ${accent}99)` : "rgba(255,255,255,0.05)",
    border: active ? "none" : "1.5px solid rgba(255,255,255,0.12)",
    borderRadius: 999, padding: small ? "5px 16px" : "8px 22px",
    boxShadow: active ? `0 0 22px ${accent}55` : "none", whiteSpace: "nowrap",
  }}>{text}</span>
);

// tiny tag chip on a row's right side (NOUN / VERB / WORKS / PREDICTED)
export const Tag: React.FC<{ text: string; accent: string; ok?: boolean }> = ({ text, accent, ok = true }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontWeight: 700, fontSize: 16,
    color: ok ? accent : DIM, background: ok ? `${accent}1E` : "rgba(255,255,255,0.04)",
    border: `1.5px solid ${ok ? accent : "rgba(255,255,255,0.14)"}`, borderRadius: 9, padding: "6px 14px", whiteSpace: "nowrap",
  }}>{ok ? "✓" : "✗"} {text}</span>
);

// big glowing chapter number (01, 02 …)
export const ChapterNum: React.FC<{ num: string; accent: string; delay?: number }> = ({ num, accent, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 12, stiffness: 170 } });
  return (
    <div style={{ opacity: p, transform: `scale(${Math.max(p, 0.01)})`, transformOrigin: "left center" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 120, lineHeight: 1, color: accent, textShadow: `0 0 44px ${accent}77` }}>{num}</div>
    </div>
  );
};

// odometer that ticks to `value` when frame passes `atFrame`
export const Odometer: React.FC<{ value: string | number; atFrame: number; accent: string; size?: number }> = ({ value, atFrame, accent, size = 74 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - atFrame, fps, config: { damping: 11, stiffness: 210 } });
  return (
    <span style={{ display: "inline-block", fontFamily: MONO, fontWeight: 700, fontSize: size, color: "#0B0D10", transform: `translateY(${(1 - Math.max(p, 0)) * 14}px)`, opacity: Math.max(p, 0) }}>{value}</span>
  );
};

// self-drawing connector line with a labeled callout box at the end
export const Callout: React.FC<{ x: number; y: number; label: string; accent: string; delay: number; from?: { x: number; y: number } }> = ({ x, y, label, accent, delay, from }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = spring({ frame: f - delay, fps, config: { damping: 200 } });
  const box = spring({ frame: f - delay - 10, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <>
      {from ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <path d={`M ${from.x} ${from.y} L ${from.x} ${y} L ${x} ${y}`} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeDasharray={1} pathLength={1} strokeDashoffset={1 - line} opacity={0.9} />
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: x, top: y, transform: `scale(${Math.max(box, 0.01)})`, transformOrigin: "center", opacity: Math.max(box, 0) }}>
        <div style={{ background: "#0E1013", border: `1.5px solid ${accent}66`, borderRadius: 14, padding: "18px 30px", textAlign: "center", ...glow(accent, 0.25) }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color: accent }}>{label}</div>
        </div>
      </div>
    </>
  );
};

// ---------------- scenes ----------------

// chapter opener: big 0N + statement headline (their "One: design around resources")
export const SChapter: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent }) => {
  return (
    <>
      <div style={{ position: "absolute", top: 360, left: 220 }}>
        <ChapterNum num={s.num || "01"} accent={accent} delay={4} />
        <div style={{ marginTop: 18, fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.32em", color: WHITE, maxWidth: 420, lineHeight: 1.5 }}>
          {String(s.headline || "").replace(/\*/g, "").toUpperCase()}
        </div>
      </div>
      <Headline headline={s.headline} accent={accent} delay={10} />
    </>
  );
};

// showcase intro: numbered gradient cards pop (fast stagger), odometer counts up, progress bar fills
export const SShowcase: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items: Array<{ icon?: string; label?: string }> = (s.items || []).slice(0, 8);
  const n = items.length;
  const total = Number(s.count) || n;
  const shown = Math.min(n, Math.max(0, Math.floor((f - 14) / 9))); // one card every ~9 frames
  const colors = [ACCENT_MAP.orange, ACCENT_MAP.gold, "#A3E635", ACCENT_MAP.green, ACCENT_MAP.pink, "#38BDF8", ACCENT_MAP.blue, "#C084FC"];
  const countP = spring({ frame: f - 14 - Math.min(shown, n) * 9, fps, config: { damping: 200 } });
  const barW = interpolate(Math.min(shown, n), [0, n], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      <div style={{ position: "absolute", top: 300, left: 240 }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 150, color: WHITE, lineHeight: 1 }}>
          <span style={{ display: "inline-block", transform: `translateY(${(1 - countP) * 16}px)`, opacity: Math.max(countP, 0) }}>{Math.min(shown, total)}</span>
        </div>
        <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: DIM }}>{s.sub || ""}</div>
      </div>
      <div style={{ position: "absolute", top: 270, left: 640, right: 200, display: "flex", gap: 18, flexWrap: "wrap" }}>
        {items.map((it, i) => {
          const on = i < shown;
          const c = colors[i % colors.length];
          return (
            <div key={i} style={{
              width: 132, height: 210, borderRadius: 16, padding: "20px 0", textAlign: "center",
              background: on ? `linear-gradient(180deg, ${c}, ${c}77)` : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${on ? c : "rgba(255,255,255,0.1)"}`,
              boxShadow: on ? `0 0 30px ${c}44` : "none", opacity: on ? 1 : 0.25,
              transform: `scale(${on ? 1 : 0.9})`, transition: "none",
            }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: on ? "#0B0D10" : DIM }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ marginTop: 22, fontSize: 40 }}>{it.icon || "▸"}</div>
              <div style={{ marginTop: 18, fontFamily: MONO, fontWeight: 700, fontSize: 15, color: on ? "#0B0D10" : DIM, padding: "0 10px", lineHeight: 1.35 }}>{it.label || ""}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 640, left: 640, right: 260 }}>
        <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.07)" }}>
          <div style={{ height: 10, borderRadius: 6, width: `${barW}%`, background: `linear-gradient(90deg, ${ACCENT_MAP.orange}, ${ACCENT_MAP.gold})`, boxShadow: `0 0 18px ${ACCENT_MAP.orange}66` }} />
        </div>
      </div>
    </>
  );
};

// rows: [method pill + code text + verdict tag] popping per sentence (their endpoints/rules look)
export const SRows: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent, beat }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows: Array<any> = (s.rows || []).slice(0, 5);
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      <Window title={s.window || "api.local"} url={s.url !== false} w={980} accent={accent} delay={6} style={{ left: 470, top: 250 }}>
        {rows.map((r, i) => {
          const at = enterAt(beat, i, rows.length, fps, 10 + i * 12);
          const p = spring({ frame: f - at, fps, config: { damping: 200 } });
          const chars = Math.max(0, Math.floor((f - at) * 1.4));
          const text = String(r.text || "");
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18, opacity: Math.max(p, 0), transform: `translateY(${(1 - Math.max(p, 0)) * 18}px)` }}>
              <Pill text={r.pill || "GET"} accent={r.ok === false ? "#6B7280" : accent} small />
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 27, color: r.ok === false ? DIM : WHITE }}>
                {text.split("").map((ch, j) => (
                  <span key={j} style={{ opacity: j < chars ? 1 : 0.25 }}>{ch}</span>
                ))}
              </span>
              <span style={{ flex: 1 }} />
              {r.tag ? <Tag text={r.tag} accent={r.ok === false ? "#F87171" : accent} ok={r.ok !== false} /> : null}
            </div>
          );
        })}
      </Window>
      {s.foot ? (
        <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 30, color: accent }}>{s.foot}</div>
      ) : null}
    </>
  );
};

// data simulation: code lines land on the left, the DB counter ticks + table rows pop on the right
export const SSim: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent, beat }) => {
  const { f, fps, ms } = useBeatClock();
  const lines: string[] = s.lines || [];
  const names: string[] = s.customers || [];
  const start = Number(s.start) || 1001;
  const done = (() => {
    const sents = beat?.sentences;
    if (!sents || !sents.length) return Math.min(lines.length, Math.max(0, Math.floor((f - 16) / 26)));
    return Math.min(lines.length, sents.filter((sn: any) => ms >= sn.t1).length + (ms >= (sents[0]?.t0 ?? 0) ? 1 : 0));
  })();
  const shown = Math.min(lines.length, Math.max(0, done));
  const seq = start + Math.max(0, shown - 1);
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      <Window title={s.service || "orders-service"} w={640} accent={accent} delay={4} style={{ left: 240, top: 280 }}>
        {lines.map((ln, i) => {
          const at = enterAt(beat, i, lines.length, fps, 16 + i * 26);
          const chars = Math.max(0, Math.floor((f - at) * 1.5));
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 19, color: i % 2 ? ACCENT_MAP.gold : ACCENT_MAP.green, marginBottom: 14, whiteSpace: "nowrap" }}>
              {ln.slice(0, chars)}{chars < ln.length && chars > 0 ? <span style={{ color: DIM }}>▌</span> : null}
            </div>
          );
        })}
      </Window>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <path d="M 900 500 L 1060 500" stroke={accent} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="10 8" strokeDashoffset={-(f * 1.8)} opacity={shown > 0 ? 0.9 : 0.15} />
      </svg>
      <Window title={s.db || "cloudberry-db"} w={560} accent={accent} delay={12} style={{ left: 1060, top: 250 }}>
        <div style={{ background: `${accent}1A`, border: `1.5px solid ${accent}55`, borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: 18, color: DIM }}>{s.seq || "id_seq"}</span>
          <Odometer value={seq} atFrame={8} accent={accent} size={58} />
        </div>
        <div style={{ marginTop: 18 }}>
          {(names || []).map((nm, i) => {
            const at = enterAt(beat, i, lines.length, fps, 30 + i * 26);
            const p = spring({ frame: f - at - 14, fps, config: { damping: 200 } });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, opacity: Math.max(p, 0) }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, color: accent, background: `${accent}22`, border: `1.5px solid ${accent}`, borderRadius: 8, padding: "4px 12px" }}>{start + i}</span>
                <span style={{ fontFamily: MONO, fontSize: 22, color: WHITE }}>{nm}</span>
              </div>
            );
          })}
        </div>
      </Window>
      {s.foot ? (
        <div style={{ position: "absolute", top: 800, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ border: `2px solid ${accent}`, borderRadius: 12, padding: "10px 34px", fontFamily: MONO, fontWeight: 700, fontSize: 26, color: accent, background: `${accent}14` }}>{s.foot}</div>
        </div>
      ) : null}
    </>
  );
};

// selector: one URL, method row with a moving highlight + status pill (their "One URL, every method")
export const SSelector: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent, beat }) => {
  const { fps, ms } = useBeatClock();
  const methods: string[] = s.methods || ["GET", "POST", "PUT", "DELETE"];
  const statuses: string[] = s.statuses || [];
  const f = useCurrentFrame();
  const sents = beat?.sentences;
  // monotonic: highest sentence that has STARTED — holds during pauses, never snaps back
  const idx = (() => {
    if (!sents || !sents.length) return Math.max(0, Math.min(methods.length - 1, Math.floor((f - 30) / 40)));
    let k = -1;
    for (let i = 0; i < sents.length; i++) if (ms >= sents[i].t0) k = i;
    return Math.max(0, Math.min(methods.length - 1, k));
  })();
  const active = sents ? (ms >= (sents[0]?.t0 ?? 1e9) ? idx : -1) : f > 30 ? idx : -1;
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      <div style={{ position: "absolute", top: 270, left: 240, right: 240 }}>
        <div style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: 16, padding: "26px 36px", display: "flex", alignItems: "center", gap: 20, ...glow(accent, 0.3) }}>
          <span style={{ fontSize: 30 }}>{s.icon || "🛒"}</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 34, color: "#0B0D10" }}>{s.url || "/orders"}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 22, color: "#0B0D10", opacity: 0.75 }}>{s.meta || ""}</span>
        </div>
        <div style={{ marginTop: 18, background: "#0E1013", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "14px 20px", display: "flex", gap: 12 }}>
          {methods.map((m, i) => (
            <span key={i} style={{
              flex: 1, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 24, padding: "14px 0", borderRadius: 10,
              color: i === active ? accent : WHITE,
              background: i === active ? `${accent}14` : "transparent",
              border: i === active ? `2px solid ${accent}` : "2px solid transparent",
              boxShadow: i === active ? `0 0 26px ${accent}44` : "none",
            }}>{m}</span>
          ))}
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginTop: 14 }}>
          <div style={{ height: 6, borderRadius: 4, width: `${((active + 1) / methods.length) * 100}%`, background: accent, boxShadow: `0 0 14px ${accent}88` }} />
        </div>
        {active >= 0 && statuses[active] ? (
          <div style={{ marginTop: 26, display: "flex", justifyContent: "center" }}>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, letterSpacing: "0.18em", color: accent, background: `${accent}12`, border: `1.5px solid ${accent}55`, borderRadius: 12, padding: "16px 60px", ...glow(accent, 0.2) }}>{statuses[active]}</div>
          </div>
        ) : null}
      </div>
    </>
  );
};

// matrix: columns pop, then cells fill row-by-row (their "Resources plus HTTP methods")
export const SMatrix: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent, beat }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols: string[] = (s.cols || []).slice(0, 4);
  const rowNames: string[] = (s.rowNames || []).slice(0, 4);
  const cell: string = s.cell || "";
  const colAt = (k: number) => enterAt(beat, k, cols.length, fps, 14 + k * 14);
  const cellsAt = enterAt(beat, Math.max(cols.length - 1, 0), Math.max(cols.length, 1), fps, 14 + cols.length * 14) + 20;
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      <div style={{ position: "absolute", top: 300, left: 240, right: 240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
          <div style={{ width: 280 }} />
          {cols.map((c, k) => {
            const colOn = f >= colAt(k);
            return (
              <div key={`h${k}`} style={{ flex: 1, textAlign: "center", opacity: colOn ? 1 : 0 }}>
                <Pill text={c} accent={accent} small />
              </div>
            );
          })}
        </div>
        {rowNames.map((rn, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
            <div style={{ width: 280, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: WHITE, textAlign: "right" }}>{rn}</div>
            {cols.map((c, k) => {
              const colOn = f >= colAt(k);
              const cellOn = colOn && f >= cellsAt + (r * cols.length + k) * 6;
              return (
                <div key={k} style={{
                  flex: 1, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 19, padding: "18px 0", borderRadius: 10,
                  color: cellOn ? accent : "transparent",
                  background: cellOn ? `${accent}14` : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${colOn ? `${accent}55` : "rgba(255,255,255,0.07)"}`,
                  opacity: colOn ? 1 : 0.25,
                }}>{cell || "·"}</div>
              );
            })}
          </div>
        ))}
      </div>
      {s.foot ? (
        <div style={{ position: "absolute", top: 780, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 27, color: DIM }}>{s.foot}</div>
      ) : null}
    </>
  );
};

// compare: two panels building in lockstep (their "Developers say use UUIDs")
export const SCompare: React.FC<{ s: any; accent: string; beat?: any }> = ({ s, accent, beat }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const L = s.left || {}; const R = s.right || {};
  const linesL: string[] = L.lines || []; const linesR: string[] = R.lines || [];
  const total = Math.max(linesL.length, linesR.length, 1);
  const panel = (side: "l" | "r", title: string, lines: string[], x: number, col: string, base: number) => (
    <Window title={title} w={700} accent={col} delay={base} style={{ left: x, top: 300 }}>
      {lines.map((ln, i) => {
        const at = enterAt(beat, Math.min(i * 2 + (side === "r" ? 1 : 0), total - 1), total * 2, fps, 14 + i * 22 + (side === "r" ? 10 : 0));
        const chars = Math.max(0, Math.floor((f - at) * 1.6));
        return (
          <div key={i} style={{ fontFamily: MONO, fontSize: 20, color: side === "l" ? WHITE : accent, marginBottom: 16, whiteSpace: "nowrap" }}>
            {ln.slice(0, chars)}{chars > 0 && chars < ln.length ? <span style={{ color: DIM }}>▌</span> : null}
          </div>
        );
      })}
    </Window>
  );
  return (
    <>
      <Headline headline={s.headline} accent={accent} />
      {panel("l", L.title || "LEFT", linesL, 200, WHITE, 4)}
      {panel("r", R.title || "RIGHT", linesR, 1020, accent, 12)}
      {s.foot ? (
        <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 30, color: accent }}>{s.foot}</div>
      ) : null}
    </>
  );
};
