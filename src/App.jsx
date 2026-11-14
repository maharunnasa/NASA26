import { useEffect, useMemo, useRef, useState } from "react";
import { parseGistemp, parseXY, createPlayer, valueToFreq, colorAt, toT, gradientCss } from "./sonify.js";
import Globe from "./Globe.jsx";
import "./App.css";

// Colour scales: [position 0..1, colour]. Pulse is centred on 0 °C (white).
const SCALES = {
  diverging: [[0, "#3b82ff"], [0.25, "#eaf2ff"], [1, "#ff4d3d"]],
  sequential: [[0, "#0b3a5b"], [0.5, "#2ee6c5"], [1, "#f6e05e"]],
  spectrum: [[0, "#1b2a6b"], [0.5, "#9b4fd0"], [1, "#ff9d4d"]],
};

export const EXPERIENCES = [
  {
    id: "pulse", tab: "Earth's Changing Pulse", title: "Hear how Earth's temperature has changed",
    file: "/data/gistemp.csv", parse: parseGistemp, xLabel: "Month", unit: "°C anomaly vs 1951–1980", scale: "diverging",
    source: "NASA GISS GISTEMP v4", url: "https://data.giss.nasa.gov/gistemp/",
    map: { minValue: -0.5, maxValue: 1.5, baseFreq: 220, octaves: 2 },
    periods: [{ name: "Period A: 1951–1980", from: 1951, to: 1980 }, { name: "Period B: 1995–2024", from: 1995, to: 2024 }],
    rule: "Warmer month → higher pitch and redder colour. Fixed range −0.5 to +1.5 °C = 220 to 880 Hz, identical for both periods.",
  },
  {
    id: "ocean", tab: "Ocean Chlorophyll", title: "Hear chlorophyll through ocean depth (ship measurements)",
    file: "/data/chlorophyll.csv", parse: parseXY, xLabel: "Depth (m)", unit: "total chlorophyll-a, mg/m³", scale: "sequential",
    source: "BCO-DMO dataset 3751, POWOW cruise TN277 (PI Z. Johnson, Duke). Ship bottle samples, not NASA satellite data. CC BY 4.0",
    url: "https://doi.org/10.1575/1912/bco-dmo.3751.3",
    map: { auto: true, baseFreq: 220, octaves: 2 },
    rule: "More chlorophyll → higher pitch and brighter colour. Played shallow to deep. x-axis is depth, not time. One cast only: one place and day, not a trend.",
    noteSec: 0.5,
    needs: "Add public/data/chlorophyll.csv (run convert-data.mjs ocean).",
  },
  {
    id: "exo", tab: "Earth vs Another World", title: "Hear light through an exoplanet's atmosphere",
    file: "/data/wasp96b.csv", parse: parseXY, xLabel: "Wavelength (µm)", unit: "Rp/R* (planet radius ÷ star radius), morning limb", scale: "spectrum",
    source: "JWST NIRISS/SOSS WASP-96 b transmission spectrum (R=50). Add the original paper or NASA page here",
    url: "https://science.nasa.gov/",
    map: { auto: true, baseFreq: 220, octaves: 2 },
    rule: "Larger Rp/R* → higher pitch and warmer colour. x-axis is wavelength, not time. Error bars are large at long wavelengths. Mapping differs from Earth data: do not compare the sounds directly.",
    noteSec: 0.15,
    needs: "Add public/data/wasp96b.csv (run convert-data.mjs wasp).",
  },
];

const fmt = (n) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(3));
const mean = (a) => a.reduce((s, d) => s + d.value, 0) / a.length;

function Chart({ pts, idx, map, stops, onSeek }) {
  const W = 600, H = 180, P = 10;
  const x = (i) => P + (i / Math.max(1, pts.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - Math.min(1, Math.max(0, toT(v, map))) * (H - 2 * P);
  const z = y(Math.max(map.minValue, Math.min(map.maxValue, 0)));
  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    onSeek(Math.round(Math.min(1, Math.max(0, (f * W - P) / (W - 2 * P))) * (pts.length - 1)));
  };
  const key = (e) => {
    if (e.key === "ArrowRight") onSeek(Math.min(pts.length - 1, (idx ?? 0) + 1));
    if (e.key === "ArrowLeft") onSeek(Math.max(0, (idx ?? 0) - 1));
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" tabIndex="0" role="slider" aria-valuemin="0" aria-valuemax={pts.length - 1}
      aria-valuenow={idx ?? 0} aria-label="Data chart. Click, drag, or use arrow keys to jump to a point"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); }}
      onPointerMove={(e) => e.buttons && seek(e)} onKeyDown={key}>
      <line x1={P} x2={W - P} y1={z} y2={z} className="zero" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={pts.length > 150 ? 1.8 : 3.5} fill={colorAt(toT(p.value, map), stops)} opacity={idx != null && i > idx ? 0.35 : 1} />)}
      {idx != null && <><line x1={x(idx)} x2={x(idx)} y1={P} y2={H - P} className="cursor" /><circle cx={x(idx)} cy={y(pts[idx].value)} r="6" className="dot" /></>}
    </svg>
  );
}

export function Experience({ cfg }) {
  const [all, setAll] = useState(null);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState(0);
  const [idx, setIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(cfg.noteSec ?? 0.12);
  const [vol, setVol] = useState(0.15);
  const [guess, setGuess] = useState(null);
  const player = useRef(null);
  const stops = SCALES[cfg.scale];

  useEffect(() => {
    setAll(null); setErr(""); setIdx(null); setPlaying(false); setGuess(null); setPeriod(0); setSpeed(cfg.noteSec ?? 0.12);
    fetch(cfg.file).then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((t) => { const d = cfg.parse(t); if (!d.length) throw new Error(); setAll(d); })
      .catch(() => setErr(cfg.needs || `Could not load ${cfg.file}`));
    return () => player.current?.stop();
  }, [cfg]);

  const pts = useMemo(() => {
    if (!all) return [];
    const p = cfg.periods?.[period];
    return p ? all.filter((d) => d.year >= p.from && d.year <= p.to) : all;
  }, [all, cfg, period]);

  const map = useMemo(() => {
    if (!cfg.map.auto) return cfg.map;
    const v = (all || []).map((d) => d.value);
    return { ...cfg.map, minValue: Math.min(...v), maxValue: Math.max(...v) };
  }, [all, cfg]);

  const stats = useMemo(() => {
    if (!pts.length) return null;
    const v = pts.map((d) => d.value);
    return { n: v.length, mean: mean(pts), min: Math.min(...v), max: Math.max(...v) };
  }, [pts]);

  function stop() { player.current?.stop(); player.current = null; setPlaying(false); }
  function play(from = 0, sec = speed) {
    stop(); setPlaying(true);
    player.current = createPlayer(pts.slice(from), map, { noteSec: sec, volume: vol, onStep: (i) => setIdx(from + i), onEnd: () => setPlaying(false) });
    player.current.play();
  }
  const atEnd = idx != null && idx >= pts.length - 1;
  const toggle = () => (playing ? stop() : play(idx != null && !atEnd ? idx : 0));
  const seek = (i) => { stop(); setIdx(i); };
  const pick = (i) => { stop(); setPeriod(i); setIdx(null); };

  if (err) return <p className="notice" role="alert">{err}</p>;
  if (!all) return <p className="notice">Loading data…</p>;
  const cur = idx != null ? pts[idx] : null;
  const curColor = cur ? colorAt(toT(cur.value, map), stops) : "#2255aa";
  const mA = cfg.periods && mean(all.filter((d) => d.year >= cfg.periods[0].from && d.year <= cfg.periods[0].to));
  const mB = cfg.periods && mean(all.filter((d) => d.year >= cfg.periods[1].from && d.year <= cfg.periods[1].to));

  return (
    <div className="exp">
      <h2>{cfg.title}</h2>
      {cfg.periods && (
        <div className="seg" role="group" aria-label="Choose a period">
          {cfg.periods.map((p, i) => <button key={p.name} aria-pressed={period === i} onClick={() => pick(i)}>{p.name}</button>)}
        </div>
      )}
      <div className="stage">
        <div>
          <Globe color={curColor} active={playing} />
          <p className="hint">Drag the globe to rotate. Its colour shows the current note on the scale below. It is a visual cue, not a map.</p>
        </div>
        <div>
          <Chart pts={pts} idx={idx} map={map} stops={stops} onSeek={seek} />
          <div className="legend" aria-label="Colour scale">
            <span>{fmt(map.minValue)}</span><i style={{ background: gradientCss(stops) }} /><span>{fmt(map.maxValue)}</span>
          </div>
          <p className="hint">Colour and pitch use the same scale ({cfg.unit}). Click or drag the chart to jump; arrow keys step one point.</p>
        </div>
      </div>

      <div className="controls">
        <button className="primary" onClick={toggle}>{playing ? "Pause" : idx != null && !atEnd ? "Resume" : "Play sound"}</button>
        <label>Speed
          <input type="range" min="0.05" max="0.8" step="0.01" value={0.85 - speed}
            onChange={(e) => { const s = Math.round((0.85 - Number(e.target.value)) * 100) / 100; setSpeed(s); if (playing) play(idx ?? 0, s); }} />
        </label>
        <label>Volume
          <input type="range" min="0" max="0.4" step="0.01" value={vol}
            onChange={(e) => { const v = Number(e.target.value); setVol(v); player.current?.setVolume(v); }} />
        </label>
      </div>
      <p className="readout" aria-live="polite">
        {cur ? `${cfg.xLabel}: ${cur.label} · ${fmt(cur.value)} · ${Math.round(valueToFreq(cur.value, map))} Hz` : "Press play, or click the chart to inspect a point."}
      </p>

      {cfg.periods && (
        <section className="guess" aria-label="Listen and guess">
          <h3>Listen first, then guess</h3>
          <p>Play both periods. Which one was warmer on average?</p>
          <div className="seg">
            {["A", "B"].map((k) => <button key={k} disabled={guess != null} onClick={() => setGuess(k)}>Period {k}</button>)}
          </div>
          {guess && (
            <p role="status">Period A averaged {fmt(mA)} °C and Period B {fmt(mB)} °C. {(mB > mA ? "B" : "A") === guess ? "Your guess matches the data." : "The data says otherwise."}{" "}
              <button className="link" onClick={() => setGuess(null)}>Try again</button></p>
          )}
        </section>
      )}

      <section className="evidence" aria-label="Evidence">
        <h3>Evidence and how the sound is made</h3>
        <dl>
          <dt>Source</dt><dd><a href={cfg.url} target="_blank" rel="noreferrer">{cfg.source}</a></dd>
          <dt>Unit</dt><dd>{cfg.unit}</dd>
          <dt>Mapping rule</dt><dd>{cfg.rule}</dd>
          <dt>Pitch range</dt><dd>{fmt(map.minValue)} to {fmt(map.maxValue)} → {map.baseFreq} to {map.baseFreq * 2 ** map.octaves} Hz</dd>
          <dt>This selection</dt><dd>{stats.n} points · mean {fmt(stats.mean)} · min {fmt(stats.min)} · max {fmt(stats.max)}</dd>
        </dl>
        <p className="caveat">The sound and colours are a designed representation of the data, not a recording or photo of Earth or another world. Listening alone does not explain the data: use the chart and numbers. This tool aims to widen who can explore the data; it does not replace scientific analysis.</p>
      </section>
    </div>
  );
}

// Not used when main.jsx imports Shell.jsx, but kept so App.jsx still works on its own.
export default function App() {
  return <main className="page"><Experience cfg={EXPERIENCES[0]} /></main>;
}