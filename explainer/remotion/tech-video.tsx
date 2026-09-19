import React, { useEffect } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender } from "remotion";

// ============ TECH VIDEO v3 — word-choreographed "Dark Mode Minimalist Tech" ============
// Every scene is staged BY THE NARRATION: word timings are split into sentence
// windows, and each sentence triggers the next visual event (lines type during
// their sentence, bars grow on their sentence, nodes light on their sentence).
// Ambient motion (breathing glows, marching dashes, drifting orbs, scan line)
// keeps every second alive between events.

const BG = "#000000";
const PANEL = "#111318";
const CYAN = "#22D3EE";
const GREEN = "#34D399";
const PURPLE = "#C084FC";
const YELLOW = "#FDE047";
const RED = "#F87171";
const WHITE = "#F8FAFC";
const DIM = "rgba(248,250,252,0.55)";
const SANS = "Inter, Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, 'DejaVu Sans Mono', monospace";
const ACCENTS = [CYAN, YELLOW, RED, GREEN, PURPLE, CYAN, GREEN, YELLOW];

const loadFonts = () => {
  useEffect(() => {
    const h = delayRender("tech fonts");
    Promise.all([
      ...[600, 800, 900].map((w) => new Promise<void>((res) => { const f = new FontFace("Inter", `url(${staticFile(`fonts/inter-${w}.ttf`)})`, { weight: String(w) }); f.load().then((l) => { document.fonts.add(l); res(); }).catch(() => res()); })),
      new Promise<void>((res) => { const f = new FontFace("JetBrains Mono", `url(${staticFile("fonts/jetbrains-mono.ttf")})`, { weight: "400 700" }); f.load().then((l) => { document.fonts.add(l); res(); }).catch(() => res()); }),
    ]).then(() => continueRender(h)).catch(() => continueRender(h));
  }, []);
};

const glow = (color: string, strength = 0.45) => ({ boxShadow: `0 0 24px ${color}${Math.round(strength * 255).toString(16).padStart(2, "0")}, 0 0 60px ${color}22`, borderColor: `${color}66` });

// ---- sentence choreography helpers ----
type Word = { w: string; t0: number; t1: number };
type Sent = { t0: number; t1: number };
const sentencesOf = (words: Word[]): Sent[] => {
  const out: Sent[] = [];
  let cur: Sent | null = null;
  for (const w of words || []) {
    if (!cur) cur = { t0: w.t0, t1: w.t1 };
    cur.t1 = w.t1;
    if (/[.!?…]["')\]]?$/i.test(w.w)) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.length ? out : ((words || []).length ? [{ t0: words[0].t0, t1: words[words.length - 1].t1 }] : []);
};
const sentAt = (ms: number, sents: Sent[]) => {
  for (let i = sents.length - 1; i >= 0; i--) if (ms >= sents[i].t0 - 80) return i;
  return -1;
};
const sentProg = (ms: number, s: Sent, pad = 250) =>
  interpolate(ms, [s.t0, s.t1 + pad], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const cueAt = (f: number, fps: number, sents: Sent[], k: number) => {
  if (k >= sents.length) return 0;
  const trigger = (sents[k].t0 / 1000) * fps;
  return spring({ frame: f - trigger, fps, config: { damping: 12, stiffness: 170 } });
};
const breathe = (f: number, speed = 9) => 0.8 + 0.2 * Math.sin(f / speed);

const SceneLabel: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 100, fontFamily: MONO, fontSize: 24, color: DIM, letterSpacing: "0.3em", textAlign: "center" }}>{text}</div>
);

// ambient: drifting glow orbs + scan line — motion every second, in every scene
const Ambient: React.FC<{ accent: string }> = ({ accent }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x1 = 300 + Math.sin(f / 90) * 220;
  const y1 = 260 + Math.cos(f / 110) * 140;
  const x2 = 1500 + Math.sin(f / 120 + 2) * 200;
  const y2 = 700 + Math.cos(f / 95 + 1) * 130;
  const scanY = ((f / Math.max(durationInFrames, 1)) * 1300) % 1300 - 60;
  return (
    <>
      <div style={{ position: "absolute", left: x1, top: y1, width: 420, height: 420, borderRadius: 999, background: `radial-gradient(circle, ${accent}14, transparent 65%)` }} />
      <div style={{ position: "absolute", left: x2, top: y2, width: 500, height: 500, borderRadius: 999, background: `radial-gradient(circle, ${PURPLE}0e, transparent 65%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 2, background: `linear-gradient(90deg, transparent, ${accent}26, transparent)` }} />
    </>
  );
};

const BigCenter: React.FC<{ headline: string; sub?: string; accent?: string }> = ({ headline, sub, accent = CYAN }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = headline.split(" ");
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 1500 }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 96, color: WHITE, lineHeight: 1.15 }}>
          {words.map((w, i) => {
            const wp = spring({ frame: f - 2 - i * 3, fps, config: { damping: 200 } });
            return <span key={i} style={{ display: "inline-block", opacity: wp, transform: `translateY(${(1 - wp) * 30}px)`, marginRight: 18 }}>{w}</span>;
          })}
        </div>
        {sub ? <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 28, color: accent, letterSpacing: "0.22em", opacity: spring({ frame: f - 14, fps, config: { damping: 200 } }) }}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const Terminal: React.FC<{ title: string; w: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, w, color = CYAN, children, style }) => {
  const f = useCurrentFrame();
  const sGlow = glow(color, 0.3 + 0.15 * Math.sin(f / 8));
  return (
    <div style={{ position: "absolute", width: w, ...style }}>
      <div style={{ background: PANEL, border: "1.5px solid", borderRadius: 14, overflow: "hidden", ...sGlow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FEBC2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
          <div style={{ marginLeft: 10, fontFamily: MONO, fontSize: 18, color: DIM }}>{title}</div>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
};

// typing driven by sentence progress: line k fills during sentence k
const SentTyping: React.FC<{ text: string; sents: Sent[]; ms: number; k: number; color?: string; size?: number }> = ({ text, sents, ms, k, color = GREEN, size = 26 }) => {
  const s = sents[k];
  const prog = s ? sentProg(ms, s) : 0;
  const chars = Math.max(0, Math.floor(text.length * prog));
  const done = prog >= 1;
  return (
    <div style={{ fontFamily: MONO, fontSize: size, color, whiteSpace: "pre-wrap", minHeight: size * 1.4 }}>
      {chars > 0 ? text.slice(0, chars) : <span style={{ opacity: 0.25 }}>{text.replace(/[^ ]/g, "·")}</span>}
      {!done ? <span style={{ color: DIM }}>▌</span> : null}
    </div>
  );
};

const Counter: React.FC<{ values: number[]; si: number; color?: string; size?: number }> = ({ values, si, color = CYAN, size = 64 }) => {
  const f = useCurrentFrame();
  const idx = Math.min(values.length - 1, Math.max(0, si));
  const tickP = interpolate(f % 24, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, color, textAlign: "center" }}>
      <span style={{ color: DIM, fontSize: size * 0.42, display: "block", marginBottom: 4 }}>ID</span>
      <span key={idx} style={{ display: "inline-block", transform: `translateY(${(1 - tickP) * 12}px)`, opacity: tickP }}>{values[idx]}</span>
    </div>
  );
};

const FlowLine: React.FC<{ x1: number; y1: number; x2: number; y2: number; progress: number; color?: string }> = ({ x1, y1, x2, y2, progress, color = RED }) => {
  const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 70;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
      <circle cx={x1} cy={y1} r={6 * progress} fill={color} />
      <circle cx={x2} cy={y2} r={6 * progress} fill={color} />
    </svg>
  );
};

const SizeBar: React.FC<{ label: string; v: number; max: number; color: string; shown: boolean; text: string }> = ({ label, v, max, color, shown, text }) => {
  const f = useCurrentFrame();
  const w = shown ? interpolate(f % 600, [0, 30], [0, (v / max) * 900], { extrapolateRight: "clamp" }) : 8;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 34 }}>
      <div style={{ width: 260, fontFamily: MONO, fontSize: 30, color: shown ? WHITE : DIM, textAlign: "right" }}>{label}</div>
      <div style={{ height: 58, width: Math.max(w, 8), borderRadius: 10, background: shown ? `${color}22` : "rgba(255,255,255,0.03)", border: `1.5px solid ${shown ? color : "rgba(255,255,255,0.12)"}`, boxShadow: shown ? `0 0 24px ${color}44` : "none", display: "flex", alignItems: "center", paddingLeft: 20 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: shown ? color : "transparent" }}>{text}</span>
      </div>
    </div>
  );
};

const WarnBadge: React.FC<{ text: string; shown: boolean; f: number }> = ({ text, shown, f }) => {
  if (!shown) return null;
  const pulse = 0.78 + 0.22 * Math.sin(f / 5);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 750, display: "flex", justifyContent: "center", transform: `scale(${pulse})` }}>
      <div style={{ border: `2px solid ${RED}`, borderRadius: 14, padding: "14px 42px", fontFamily: MONO, fontWeight: 700, fontSize: 38, color: RED, background: "rgba(248,113,113,0.08)", ...glow(RED, 0.5) }}>
        ⚠ {text}
      </div>
    </div>
  );
};

const UuidGrid: React.FC<{ progress: number; color?: string }> = ({ progress, color = CYAN }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 44px)", gap: 8, justifyContent: "center" }}>
      {Array.from({ length: 32 }).map((_, i) => {
        const on = interpolate(progress * 32 - i, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            width: 44, height: 44, borderRadius: 8,
            background: on ? `${color}22` : "rgba(255,255,255,0.03)",
            border: `1.5px solid ${on ? color : "rgba(255,255,255,0.12)"}`,
            boxShadow: on ? `0 0 12px ${color}44` : "none",
            opacity: 0.35 + 0.65 * on,
          }} />
        );
      })}
    </div>
  );
};

// ---------------- scene renderers (sentence-choreographed) ----------------
const STitle: React.FC<{ s: any }> = ({ s }) => <BigCenter headline={s.headline} sub={s.sub} />;
const SEnd: React.FC<{ s: any }> = ({ s }) => <BigCenter headline={s.headline} sub={s.sub} accent={GREEN} />;

const STerminal: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const lines: string[] = s.lines || [];
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <Terminal title={s.termTitle || "terminal"} w={s.wide ? 1180 : 900} color={accent} style={{ left: s.wide ? 370 : 510, top: 290 }}>
        {lines.map((ln, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <SentTyping text={ln} sents={sents} ms={ms} k={i} color={i % 2 === 0 ? GREEN : PURPLE} size={s.wide ? 28 : 26} />
          </div>
        ))}
        <div style={{ minHeight: 8 }} />
        {si >= lines.length && s.caption ? (
          <div style={{ fontFamily: MONO, fontSize: 25, color: accent, opacity: breathe(f, 7) }}>{s.caption}</div>
        ) : null}
      </Terminal>
    </>
  );
};

const SCounter: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const pop = cueAt(f, fps, sents, 0);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <div style={{ position: "absolute", left: 700, top: 280, transform: `scale(${Math.max(pop, 0.01)})`, transformOrigin: "center" }}>
        <Terminal title={s.nodeTitle || "database"} w={520} color={accent}>
          {s.sub ? <div style={{ fontFamily: MONO, fontSize: 18, color: DIM, marginBottom: 14 }}>{s.sub}</div> : null}
          <Counter values={s.values && s.values.length ? s.values : [1, 2, 3]} si={si} color={accent} />
        </Terminal>
      </div>
      {si >= 1 && s.caption ? (
        <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 28, color: DIM, opacity: breathe(f, 7) }}>{s.caption}</div>
      ) : null}
    </>
  );
};

const SBars: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const bars = (s.bars || []).slice(0, 4);
  const max = Math.max(...bars.map((b: any) => Number(b.v) || 1), 1);
  const bigPop = cueAt(f, fps, sents, bars.length);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <div style={{ position: "absolute", top: 230, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {bars.map((b: any, i: number) => (
          <SizeBar key={i} label={b.label} v={Number(b.v) || 1} max={max} color={ACCENTS[i % ACCENTS.length]} shown={si >= i} text={b.text} />
        ))}
      </div>
      {s.caption ? (
        <div style={{ position: "absolute", top: 620, left: 300, right: 300, textAlign: "center", fontFamily: MONO, fontSize: 28, color: DIM, opacity: si >= bars.length ? 1 : 0 }}>{s.caption}</div>
      ) : null}
      {s.big ? (
        <div style={{ position: "absolute", top: 740, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${Math.max(bigPop, 0.01)})` }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 72, color: accent, textShadow: `0 0 40px ${accent}55` }}>{s.big}</div>
        </div>
      ) : null}
    </>
  );
};

const SClash: React.FC<{ s: any; words: Word[] }> = ({ s, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const val = s.value ?? 1001;
  const pA = cueAt(f, fps, sents, 0);
  const pB = cueAt(f, fps, sents, 1);
  const lineP = si >= 2 && sents[2] ? sentProg(ms, sents[2]) : 0;
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <div style={{ position: "absolute", top: 320, left: 230, transform: `scale(${Math.max(pA, 0.01)})`, transformOrigin: "center" }}>
        <Terminal title={s.a || "node-A"} w={520} color={CYAN}>
          <Counter values={[val]} si={si >= 1 ? 1 : 0} color={CYAN} />
        </Terminal>
      </div>
      <div style={{ position: "absolute", top: 320, left: 1170, transform: `scale(${Math.max(pB, 0.01)})`, transformOrigin: "center" }}>
        <Terminal title={s.b || "node-B"} w={520} color={PURPLE}>
          <Counter values={[val]} si={si >= 1 ? 1 : 0} color={PURPLE} />
        </Terminal>
      </div>
      {si >= 2 && sents[2] ? <FlowLine x1={760} y1={470} x2={1160} y2={470} progress={lineP} color={RED} /> : null}
      <WarnBadge text={s.warn || "COLLISION"} shown={si >= 3 || (si === 2 && lineP > 0.9)} f={f} />
    </>
  );
};

const SCode: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const big = String(s.big || "");
  const span = Math.max(sents[0]?.t1 || 1, 1);
  const lit = Math.floor(interpolate(ms, [sents[0]?.t0 || 0, span + 800], [0, big.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const gridProg = s.grid && sents.length > 2 ? sentProg(ms, { t0: sents[1]?.t0 || 0, t1: sents[sents.length - 1]?.t1 || 1 }) : (s.grid ? 1 : 0);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <div style={{ position: "absolute", top: 200, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: big.length > 40 ? 40 : 54, color: WHITE, padding: "0 120px" }}>
        {big.split("").map((ch, i) => (
          <span key={i} style={{ color: i < lit ? accent : DIM, textShadow: i < lit ? `0 0 18px ${accent}55` : "none" }}>{ch}</span>
        ))}
      </div>
      {s.caption ? (
        <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 27, color: accent, opacity: si >= 1 ? breathe(f, 7) : 0 }}>
          {s.caption}
        </div>
      ) : null}
      {s.grid ? (
        <div style={{ position: "absolute", top: 430, left: 0, right: 0 }}>
          <UuidGrid progress={gridProg} color={accent} />
        </div>
      ) : null}
      {s.lines && s.lines.length ? (
        <div style={{ position: "absolute", left: 530, top: s.grid ? 640 : 540, width: 860 }}>
          <Terminal title={s.termTitle || "terminal"} w={860} color={GREEN}>
            {s.lines.map((ln: string, i: number) => (
              <SentTyping key={i} text={ln} sents={sents} ms={ms} k={Math.min(sents.length - 1, (s.grid ? 2 : 1) + i)} color={GREEN} />
            ))}
          </Terminal>
        </div>
      ) : null}
    </>
  );
};

const MiniNode: React.FC<{ text: string; color: string; active: boolean; x: number; y: number; w?: number }> = ({ text, color, active, x, y, w = 380 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `scale(${active ? 1 + 0.03 * Math.sin(f / 6) : 1})` }}>
      <div style={{ background: active ? color : PANEL, border: `1.5px solid ${active ? color : "rgba(255,255,255,0.18)"}`, borderRadius: 14, padding: "22px 18px", textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 26, color: active ? "#000" : WHITE, boxShadow: active ? `0 0 30px ${color}88` : "none", transition: "background 0.25s, color 0.25s" }}>
        {text}
      </div>
    </div>
  );
};

const SFlow: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const nodes: string[] = (s.nodes || []).slice(0, 4);
  const n = nodes.length;
  const boxW = n === 2 ? 460 : 380;
  const gap = (1920 - 200 - n * boxW) / Math.max(n - 1, 1);
  const active = Math.max(0, si % n);
  const cue = cueAt(f, fps, sents, 0);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      {nodes.map((txt, i) => (
        <MiniNode key={i} text={txt} color={accent} active={i === active} x={100 + i * (boxW + gap)} y={370} w={boxW} />
      ))}
      {nodes.slice(0, -1).map((_, i) => (
        <svg key={`a${i}`} width={gap + 20} height={40} style={{ position: "absolute", left: 100 + boxW + i * (boxW + gap) - 10, top: 445, opacity: si > i ? 1 : 0.25 }}>
          <line x1="0" y1="20" x2={gap - 8} y2="20" stroke={accent} strokeWidth={3} strokeDasharray="8 8" strokeDashoffset={-f * 1.5} />
          <path d={`M ${gap - 16} 10 L ${gap - 4} 20 L ${gap - 16} 30`} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" />
        </svg>
      ))}
      {s.loop ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: cue }}>
          <path d={`M ${100 + n * boxW + (n - 1) * gap - boxW / 2} 560 Q 960 760 100 + ${boxW / 2} 560`}
            fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round"
            strokeDasharray="16 14" strokeDashoffset={-f * 2.2} opacity={0.85} />
          <text x="960" y="740" textAnchor="middle" fill={accent} fontFamily={MONO} fontSize={26} letterSpacing="0.25em">EVENT LOOP — REPEAT FOREVER</text>
        </svg>
      ) : null}
      {s.caption ? (
        <div style={{ position: "absolute", top: s.loop ? 810 : 660, left: 260, right: 260, textAlign: "center", fontFamily: MONO, fontSize: 28, color: DIM, opacity: si >= 1 ? 1 : 0.4 }}>{s.caption}</div>
      ) : null}
    </>
  );
};

const SSteps: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const si = sentAt(ms, sents);
  const items: string[] = (s.items || []).slice(0, 5);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <div style={{ position: "absolute", top: 230, left: 420, right: 280 }}>
        {items.map((it, i) => {
          const cue = cueAt(f, fps, sents, i);
          const active = si === i;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, marginBottom: 42, opacity: cue, transform: `translateX(${(1 - cue) * 60}px)` }}>
              <div style={{ minWidth: 64, height: 64, borderRadius: 14, background: active ? accent : `${accent}22`, border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: 30, color: active ? "#000" : accent, boxShadow: active ? `0 0 26px ${accent}77` : "none", transition: "background 0.25s,color 0.25s" }}>{i + 1}</div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: active ? accent : WHITE, transition: "color 0.25s" }}>{it}</div>
            </div>
          );
        })}
      </div>
      {s.caption ? (
        <div style={{ position: "absolute", top: 830, left: 260, right: 260, textAlign: "center", fontFamily: MONO, fontSize: 26, color: DIM, opacity: si >= items.length ? breathe(f, 7) : 0 }}>{s.caption}</div>
      ) : null}
    </>
  );
};

const SStatement: React.FC<{ s: any; accent: string; words: Word[] }> = ({ s, accent, words }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const sents = sentencesOf(words);
  const sweep = sents[0] ? sentProg(ms, sents[0]) : 0;
  const subP = cueAt(f, fps, sents, 1);
  return (
    <>
      {s.label ? <SceneLabel text={s.label} /> : null}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "0 160px" }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 100, color: WHITE, lineHeight: 1.15 }}>
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", left: -14, right: -14, top: "10%", bottom: "6%", background: `${accent}55`, transform: `scaleX(${sweep})`, transformOrigin: "left center", borderRadius: 10 }} />
              <span style={{ position: "relative" }}>{s.headline}</span>
            </span>
          </div>
          {s.sub ? (
            <div style={{ marginTop: 44, fontFamily: MONO, fontSize: 32, color: accent, letterSpacing: "0.2em", opacity: subP, transform: `translateY(${(1 - subP) * 20}px)` }}>{s.sub}</div>
          ) : null}
        </div>
      </AbsoluteFill>
    </>
  );
};

// ---------------- captions (locked style 2) ----------------
const CapWindow = 4;
const Captions: React.FC<{ words: Word[]; accent: string }> = ({ words, accent }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  if (!words.length) return null;
  const idx = words.findIndex((w) => ms >= w.t0 - 40 && ms < w.t1 + 150);
  if (idx < 0) return null;
  const winStart = Math.max(0, Math.min(idx - 1, words.length - CapWindow));
  const win = words.slice(winStart, Math.min(winStart + CapWindow, words.length));
  const pop = spring({ frame: f - (words[idx].t0 / 1000) * fps, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", bottom: 110, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", alignItems: "baseline", whiteSpace: "nowrap" }}>
        {win.map((w, i) => {
          const gi = winStart + i;
          const active = gi === idx;
          return (
            <span key={i} style={{
              fontFamily: SANS, fontWeight: 900, fontSize: 52, lineHeight: 1.1,
              color: gi < idx ? accent : active ? "#000000" : "rgba(248,250,252,0.5)",
              background: active ? accent : "transparent",
              borderRadius: active ? 12 : 0, padding: active ? "4px 18px" : 0,
              transform: `scale(${active ? 1 + 0.06 * Math.max(pop, 0) : 1})`,
              transformOrigin: "center bottom", display: "inline-block",
              textShadow: active ? "none" : "0 2px 12px rgba(0,0,0,0.85)",
            }}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- renderers registry ----------------
const RENDERERS: Record<string, React.FC<any>> = {
  title: STitle,
  terminal: STerminal,
  counter: SCounter,
  bars: SBars,
  clash: SClash,
  code: SCode,
  flow: SFlow,
  steps: SSteps,
  statement: SStatement,
  end: SEnd,
};

// ---------------- orchestrator ----------------
export const TechVideo: React.FC<any> = (props) => {
  loadFonts();
  const { fps, durationInFrames } = useVideoConfig();
  const u = (s: number) => Math.round(s * fps);
  const scenes: any[] = props?.scenes || [];
  const starts: number[] = props?.starts || [];
  const durs: number[] = props?.durs || [];
  const words: Array<Array<Word>> = props?.sceneWords || [];
  const audio: Array<string | null> = props?.sceneAudio || [];
  const MUSIC: string | null = props?.music || null;
  return (
    <AbsoluteFill style={{ background: BG }}>
      {scenes.map((s, i) => {
        const R = RENDERERS[s.t] || STitle;
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <Sequence key={`s${i}`} from={u(starts[i] || 0)} durationInFrames={u(durs[i] || 4)}>
            <AbsoluteFill>
              <Ambient accent={accent} />
              <R s={s} accent={accent} words={words[i] || []} />
              <Captions words={words[i] || []} accent={accent} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {audio.map((a, i) => a ? (
        <Sequence key={`a${i}`} from={u(starts[i] || 0)} durationInFrames={u(durs[i] || 4)}>
          <Audio src={staticFile(a)} />
        </Sequence>
      ) : null)}
      {MUSIC ? (
        <Audio src={staticFile(MUSIC)} loop
          volume={(f: number) => interpolate(f, [0, 25, durationInFrames - 40, durationInFrames - 2], [0, 0.10, 0.10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      ) : null}
    </AbsoluteFill>
  );
};
