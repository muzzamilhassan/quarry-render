import React, { useEffect } from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender, Easing } from "remotion";

// ============ TEACHER — Vox-style editorial teaching explainer ============
// Paper collage + cutout photo cards + hand-drawn doodles + drawn diagrams +
// big serif statements. Narration teaches directly ("you", "let me show you").
// Safe zones same as DocV2: content y=130..930, x=150; furniture bands outside.

const PAPER = "#FAF5EE";
const INK = "#1F1B16";
const RED = "#C1272D";
const GOLD = "#E8B84B";
const TEAL = "#1D6F5C";
const SERIF = "'Playfair Display', Georgia, serif";
const GROT = "Inter, Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, monospace";

export type TBeat = {
  layout: "hook" | "say" | "board" | "cutout" | "quote" | "end";
  kicker?: string; headline?: string; sub?: string;
  big?: string; label?: string;
  quote?: string; persona?: string; personaCredit?: string;
  photos?: string[]; credits?: string[];
  curve?: { from: number; to: number; years: number; labelA: string; labelB: string };
  text: string; audio?: string | null;
  words?: Array<{ w: string; t0: number; t1: number }>;
  startMs: number; ms: number; i: number;
};

export type TDoc = { title: string; brand?: string; eyebrow?: string; music?: string; beats: TBeat[]; totalMs: number; fps: number; width?: number; height?: number };

const loadFonts = () => {
  useEffect(() => {
    const h = delayRender("teacher fonts");
    Promise.all([
      new Promise<void>((res) => { const f = new FontFace("Playfair Display", `url(${staticFile("fonts/playfair-display.ttf")})`, { weight: "400 900" }); f.load().then((l) => { document.fonts.add(l); res(); }).catch(() => res()); }),
      ...[800, 900].map((w) => new Promise<void>((res) => { const f = new FontFace("Inter", `url(${staticFile(`fonts/inter-${w}.ttf`)})`, { weight: String(w) }); f.load().then((l) => { document.fonts.add(l); res(); }).catch(() => res()); })),
      new Promise<void>((res) => { const f = new FontFace("JetBrains Mono", `url(${staticFile("fonts/jetbrains-mono.ttf")})`, { weight: "400 700" }); f.load().then((l) => { document.fonts.add(l); res(); }).catch(() => res()); }),
    ]).then(() => continueRender(h)).catch(() => continueRender(h));
  }, []);
};

const stepped = (f: number, step = 2) => Math.floor(f / step) * step;

const Content: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fade = durationInFrames > 24
    ? interpolate(f, [0, 5, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return <AbsoluteFill style={{ opacity: fade }}>{children}</AbsoluteFill>;
};

const Furniture: React.FC<{ beat: TBeat; total: number }> = ({ beat, total }) => (
  <>
    <div style={{ position: "absolute", top: 52, left: 130, fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.28em", color: RED }}>
      {"THE 5-MINUTE LESSON"}
    </div>
    <div style={{ position: "absolute", top: 52, right: 130, display: "flex", gap: 10 }}>
      {(() => {
        const shown = Math.min(total, 16);
        const filled = total <= shown ? beat.i + 1 : Math.round(((beat.i + 1) / total) * shown);
        return Array.from({ length: shown }).map((_, i) => (
          <div key={i} style={{ width: 26, height: 5, borderRadius: 3, background: i < filled ? RED : "rgba(31,27,22,0.2)" }} />
        ));
      })()}
    </div>
    <div style={{ position: "absolute", bottom: 46, left: 130, right: 130, height: 2, background: "rgba(31,27,22,0.16)" }} />
    <div style={{ position: "absolute", bottom: 30, left: 130, fontFamily: MONO, fontWeight: 700, fontSize: 19, letterSpacing: "0.26em", color: "rgba(31,27,22,0.6)" }}>
      {"THE 5-MINUTE LESSON"}
    </div>
  </>
);

const Grain: React.FC = () => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05, mixBlendMode: "multiply", pointerEvents: "none" }}>
    <filter id="tgrain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" /></filter>
    <rect width="100%" height="100%" filter="url(#tgrain)" />
  </svg>
);

// cutout photo card: white border, rotation, drop shadow, tape corners
const Cutout: React.FC<{ file: string; x: number; y: number; w: number; rot: number; delay?: number; kb?: boolean; credit?: string }> = ({ file, x, y, w, rot, delay = 0, kb = true, credit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 140 } });
  const kbf = kb ? interpolate(f, [0, 120], [1, 1.12], { extrapolateRight: "extend" }) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `rotate(${rot}deg) scale(${Math.max(s, 0.01)})`, transformOrigin: "center" }}>
      <div style={{ background: "#FFFFFF", padding: 16, boxShadow: "0 24px 50px rgba(31,27,22,0.28)" }}>
        <div style={{ overflow: "hidden", height: w * 0.72 }}>
          <Img src={staticFile(file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kbf})` }} />
        </div>
        {credit ? (
          <div style={{ paddingTop: 8, fontFamily: MONO, fontSize: 15, color: "rgba(31,27,22,0.55)" }}>{credit}</div>
        ) : null}
      </div>
      <div style={{ position: "absolute", top: -14, left: "12%", width: 90, height: 28, background: "rgba(232,184,75,0.65)", transform: "rotate(-6deg)" }} />
      <div style={{ position: "absolute", top: -12, right: "10%", width: 90, height: 28, background: "rgba(232,184,75,0.65)", transform: "rotate(5deg)" }} />
    </div>
  );
};

// hand-drawn grease circle that draws itself
const GreaseCircle: React.FC<{ delay?: number; size?: number; style?: React.CSSProperties }> = ({ delay = 0, size = 260, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  const C = 2 * Math.PI * (size / 2);
  return (
    <svg width={size * 1.15} height={size * 1.15} viewBox={`0 0 ${size * 1.15} ${size * 1.15}`} style={{ position: "absolute", ...style, pointerEvents: "none" }}>
      <ellipse cx={size * 0.575} cy={size * 0.575} rx={size / 2} ry={size * 0.44}
        fill="none" stroke={RED} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={`${C * 1.02} ${C}`}
        strokeDashoffset={C * (1 - p)}
        transform={`rotate(-8 ${size * 0.575} ${size * 0.575})`} />
    </svg>
  );
};

// hand-drawn arrow (draws in)
const GreaseArrow: React.FC<{ delay?: number; w?: number; style?: React.CSSProperties; flip?: boolean }> = ({ delay = 0, w = 220, style, flip }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  const L = w * 1.4;
  return (
    <svg width={w} height={w * 0.45} viewBox={`0 0 ${w} ${w * 0.45}`} style={{ position: "absolute", ...style, pointerEvents: "none", transform: flip ? "scaleX(-1)" : undefined }}>
      <path d={`M 8 ${w * 0.3} C ${w * 0.35} ${w * 0.05}, ${w * 0.65} ${w * 0.42}, ${w - 26} ${w * 0.18}`}
        fill="none" stroke={TEAL} strokeWidth={7} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
      <path d={`M ${w - 34} ${w * 0.04} L ${w - 8} ${w * 0.18} L ${w - 38} ${w * 0.34}`}
        fill="none" stroke={TEAL} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={60} strokeDashoffset={60 * (1 - Math.max(0, p - 0.7) / 0.3)} />
    </svg>
  );
};

// highlighter bar behind text
const Marked: React.FC<{ children: React.ReactNode; color?: string; delay?: number }> = ({ children, color = GOLD, delay = 8 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", left: -8, right: -8, top: "12%", bottom: "8%", background: color, transform: `scaleX(${p})`, transformOrigin: "left center", borderRadius: 6, zIndex: 0 }} />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};

// ---------------- scenes ----------------
const Hook: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qIn = spring({ frame: f - 2, fps, config: { damping: 200 } });
  return (
    <Content>
      <div style={{ position: "absolute", top: 250, left: 150, width: 1000, fontFamily: SERIF, fontWeight: 800, fontSize: 96, lineHeight: 1.12, color: INK, opacity: qIn, transform: `translateY(${(1 - qIn) * 40}px)` }}>
        {b.headline}
      </div>
      {b.photos?.[0] ? (
        <Cutout file={b.photos[0]} x={1210} y={230} w={520} rot={3} delay={10} credit={b.credits?.[0]} />
      ) : null}
      <GreaseCircle delay={26} size={330} style={{ left: 1180, top: 520 }} />
      <div style={{ position: "absolute", bottom: 220, left: 150, width: 900, fontFamily: GROT, fontWeight: 600, fontSize: 38, color: "rgba(31,27,22,0.75)", opacity: qIn }}>
        {b.sub}
      </div>
    </Content>
  );
};

const Say: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tIn = spring({ frame: f - 4, fps, config: { damping: 200 } });
  return (
    <Content>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 28, letterSpacing: "0.3em", color: TEAL }}>
        {b.kicker || "HERE IS THE IDEA"}
      </div>
      <div style={{ position: "absolute", top: 400, left: 190, right: 190, textAlign: "center", fontFamily: SERIF, fontWeight: 800, fontSize: 92, lineHeight: 1.18, color: INK, opacity: tIn, transform: `translateY(${(1 - tIn) * 36}px)` }}>
        <Marked>{b.headline}</Marked>
      </div>
      {b.sub ? (
        <div style={{ position: "absolute", top: 720, left: 320, right: 320, textAlign: "center", fontFamily: GROT, fontWeight: 600, fontSize: 40, color: "rgba(31,27,22,0.72)" }}>
          {b.sub}
        </div>
      ) : null}
    </Content>
  );
};

// the whiteboard: hand-drawn growth curves + labels + big numbers
const Board: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = spring({ frame: f - 6, fps, config: { damping: 200 }, durationInFrames: 70 });
  const c = b.curve || { from: 100, to: 300, years: 30, labelA: "SAVE", labelB: "INVEST" };
  const W = 1250, H = 560, X0 = 240, Y0 = 880;
  const straight = (p: number) => Y0 - (H * 0.55) * p;
  const curve = (p: number) => Y0 - H * 0.92 * Math.pow(p, 1.9);
  const path = (fn: (p: number) => number) => {
    let d = "";
    for (let i = 0; i <= 50; i++) {
      const p = (i / 50) * draw;
      d += `${i === 0 ? "M" : "L"} ${X0 + (W - 60) * p} ${fn(p)} `;
    }
    return d;
  };
  const endPop = spring({ frame: f - 62, fps, config: { damping: 12, stiffness: 170 } });
  return (
    <Content>
      <div style={{ position: "absolute", top: 160, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 28, letterSpacing: "0.3em", color: TEAL }}>
        {b.kicker || "WATCH WHAT HAPPENS"}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={X0} y1={Y0} x2={X0 + W - 40} y2={Y0} stroke="rgba(31,27,22,0.5)" strokeWidth={3} />
        <line x1={X0} y1={Y0} x2={X0} y2={Y0 - H - 20} stroke="rgba(31,27,22,0.5)" strokeWidth={3} />
        <path d={path(straight)} fill="none" stroke="rgba(31,27,22,0.55)" strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
        <path d={path(curve)} fill="none" stroke={RED} strokeWidth={9} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 300, top: straight(1) - 60, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: "rgba(31,27,22,0.6)" }}>{c.labelA}</div>
      <div style={{ position: "absolute", left: X0 + (W - 60) - 420, top: Math.min(curve(1) - 90, 200), fontFamily: GROT, fontWeight: 900, fontSize: 54, color: RED, transform: `scale(${Math.max(endPop, 0.01)})`, transformOrigin: "left bottom" }}>
        {b.big || c.to + "K"}
      </div>
      <div style={{ position: "absolute", left: X0 + (W - 60) - 420, top: Math.min(curve(1) - 26, 260), width: 430, fontFamily: GROT, fontWeight: 600, fontSize: 30, color: INK, opacity: endPop }}>
        {b.label}
      </div>
      <div style={{ position: "absolute", left: X0, top: Y0 + 22, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: "rgba(31,27,22,0.6)" }}>0 YEARS</div>
      <div style={{ position: "absolute", left: X0 + (W - 60) - 200, top: Y0 + 22, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: "rgba(31,27,22,0.6)" }}>{c.years} YEARS</div>
    </Content>
  );
};

// collage of 2 cutouts + statement
const Collage: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tIn = spring({ frame: f - 4, fps, config: { damping: 200 } });
  return (
    <Content>
      {b.photos?.[0] ? <Cutout file={b.photos[0]} x={170} y={210} w={600} rot={-3} delay={2} credit={b.credits?.[0]} /> : null}
      {b.photos?.[1] ? <Cutout file={b.photos[1]} x={1150} y={430} w={600} rot={2.5} delay={14} credit={b.credits?.[1]} /> : null}
      <div style={{ position: "absolute", top: 330, left: 820, width: 900, textAlign: "center", fontFamily: SERIF, fontWeight: 800, fontSize: 74, lineHeight: 1.2, color: INK, opacity: tIn, transform: `translateY(${(1 - tIn) * 30}px)` }}>
        {b.headline}
      </div>
      {b.sub ? (
        <div style={{ position: "absolute", top: 700, left: 870, width: 700, textAlign: "center", fontFamily: GROT, fontWeight: 600, fontSize: 36, color: "rgba(31,27,22,0.72)" }}>
          {b.sub}
        </div>
      ) : null}
      <GreaseArrow delay={20} w={230} style={{ left: 760, top: 480 }} />
    </Content>
  );
};

// famous persona cutout + quote
const Quote: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 15, stiffness: 130 } });
  return (
    <Content>
      {b.persona ? (
        <div style={{ position: "absolute", left: 170, top: 190, width: 560, transform: `rotate(-2deg) scale(${Math.max(s, 0.01)})`, transformOrigin: "center" }}>
          <div style={{ background: "#FFF", padding: 16, boxShadow: "0 26px 55px rgba(31,27,22,0.3)" }}>
            <div style={{ overflow: "hidden", height: 620 }}>
              <Img src={staticFile(b.persona)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
            </div>
            <div style={{ paddingTop: 8, fontFamily: MONO, fontSize: 15, color: "rgba(31,27,22,0.55)" }}>{b.personaCredit || ""}</div>
          </div>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 830, top: 300, width: 950 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 78, lineHeight: 1.25, color: INK }}>
          <Marked color="rgba(232,184,75,0.75)" delay={10}>{b.quote}</Marked>
        </div>
        <div style={{ marginTop: 46, fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: TEAL }}>
          {b.label || ""}
        </div>
      </div>
      <GreaseCircle delay={26} size={300} style={{ left: 1120, top: 620 }} />
    </Content>
  );
};

const End: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 160 } });
  return (
    <Content>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ transform: `scale(${Math.max(s, 0.01)})` }}>
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 96, color: INK }}>
            <Marked delay={12}>{b.headline || "Now you know."}</Marked>
          </div>
          <div style={{ marginTop: 40, fontFamily: GROT, fontWeight: 600, fontSize: 40, color: "rgba(31,27,22,0.7)" }}>
            {b.sub || "Follow for the next 5-minute lesson."}
          </div>
        </div>
      </AbsoluteFill>
    </Content>
  );
};

// ---------------- captions (locked style 2) ----------------
const CapWindow = 4;
const Captions: React.FC<{ b: TBeat }> = ({ b }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const words = b.words || [];
  if (!words.length) return null;
  const idx = words.findIndex((w) => ms >= w.t0 - 40 && ms < w.t1 + 150);
  if (idx < 0) return null;
  const winStart = Math.max(0, Math.min(idx - 1, words.length - CapWindow));
  const win = words.slice(winStart, Math.min(winStart + CapWindow, words.length));
  const pop = spring({ frame: f - (words[idx].t0 / 1000) * fps, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", bottom: 170, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", alignItems: "baseline", whiteSpace: "nowrap" }}>
        {win.map((w, i) => {
          const gi = winStart + i;
          const active = gi === idx;
          return (
            <span key={i} style={{
              fontFamily: GROT, fontWeight: 900, fontSize: 58, lineHeight: 1.1,
              color: gi < idx ? RED : active ? "#FFFFFF" : "rgba(31,27,22,0.45)",
              background: active ? RED : "transparent",
              borderRadius: active ? 14 : 0,
              padding: active ? "4px 20px" : 0,
              transform: `scale(${active ? 1 + 0.06 * Math.max(pop, 0) : 1})`,
              transformOrigin: "center bottom", display: "inline-block",
              textShadow: active ? "none" : "0 3px 14px rgba(250,245,238,0.85)",
            }}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- composition ----------------
export const Teacher: React.FC<any> = (input) => {
  const doc = input?.teacher?.beats?.length ? input.teacher : (Array.isArray(input?.beats) && input.beats.length ? input : null);
  loadFonts();
  const { fps, durationInFrames } = useVideoConfig();
  if (!doc) return <AbsoluteFill style={{ background: PAPER }} />;
  const total = doc.beats.length;
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Grain />
      <AbsoluteFill style={doc.width && doc.width !== 1920 ? { width: 1920, height: 1080, transform: `scale(${doc.width / 1920})`, transformOrigin: "top left" } : undefined}>
        {doc.beats.map((b: TBeat) => {
          const from = Math.round((b.startMs / 1000) * fps);
          const dur = Math.max(Math.ceil((b.ms / 1000) * fps), 2);
          const comp = b.layout === "hook" ? <Hook b={b} />
            : b.layout === "board" ? <Board b={b} />
            : b.layout === "cutout" ? <Collage b={b} />
            : b.layout === "quote" ? <Quote b={b} />
            : b.layout === "end" ? <End b={b} />
            : <Say b={b} />;
          return (
            <Sequence key={`t${b.i}`} from={from} durationInFrames={dur} name={`t${b.i}-${b.layout}`}>
              {comp}
              <Furniture beat={b} total={total} />
              <Captions b={b} />
            </Sequence>
          );
        })}
        {doc.beats.filter((b: TBeat) => b.audio).map((b: TBeat) => (
          <Sequence key={`ta${b.i}`} from={Math.round((b.startMs / 1000) * fps)} durationInFrames={Math.ceil((b.ms / 1000) * fps)}>
            <Audio src={staticFile(b.audio!)} />
          </Sequence>
        ))}
        {doc.music ? (
          <Audio src={staticFile(doc.music)} loop
            volume={(f: number) => interpolate(f, [0, 30, durationInFrames - 45, durationInFrames - 1], [0, 0.15, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
