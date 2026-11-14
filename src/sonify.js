export function parseGistemp(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const h = lines.findIndex((l) => l.startsWith("Year"));
  const out = [];
  for (const line of lines.slice(h + 1)) {
    const c = line.split(",");
    const year = Number(c[0]);
    if (!year) continue;
    for (let m = 1; m <= 12; m++) {
      const raw = c[m], value = Number(raw);
      if (!raw || raw.includes("*") || Number.isNaN(value)) continue;
      out.push({ label: `${year}-${String(m).padStart(2, "0")}`, year, value });
    }
  }
  return out;
}

export function parseXY(csv) {
  return csv.trim().split(/\r?\n/).map((l) => l.split(",")).filter((c) => c.length >= 2 && !Number.isNaN(Number(c[0])) && !Number.isNaN(Number(c[1])))
    .map((c) => ({ label: c[0].trim(), value: Number(c[1]) }));
}

export function valueToFreq(v, m) {
  const t = Math.min(1, Math.max(0, (v - m.minValue) / (m.maxValue - m.minValue || 1)));
  return m.baseFreq * Math.pow(2, m.octaves * t);
}

// ---- colour mapping: same scale drives chart, legend and 3D globe ----
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function colorAt(t, stops) {
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
  const f = p1 === p0 ? 0 : Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
  const a = hex(c0), b = hex(c1);
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",")})`;
}
export const toT = (v, m) => (v - m.minValue) / (m.maxValue - m.minValue || 1);
export const gradientCss = (stops) => `linear-gradient(90deg, ${stops.map(([p, c]) => `${c} ${p * 100}%`).join(", ")})`;

export function createPlayer(points, mapping, { noteSec = 0.12, volume = 0.15, onStep, onEnd } = {}) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = volume; // constant loudness: volume never encodes the data
  master.connect(ctx.destination);
  let t0 = 0, raf = 0, nodes = [];
  const halt = () => { cancelAnimationFrame(raf); nodes.forEach((o) => { try { o.stop(); } catch (e) {} }); nodes = []; };
  const tick = () => {
    const i = Math.floor((ctx.currentTime - t0) / noteSec);
    if (i >= points.length) { onEnd && onEnd(); return; }
    if (i >= 0) onStep && onStep(i);
    raf = requestAnimationFrame(tick);
  };
  return {
    async play() {
      await ctx.resume();
      halt();
      t0 = ctx.currentTime + 0.05;
      points.forEach((p, i) => {
        const t = t0 + i * noteSec, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = valueToFreq(p.value, mapping);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.01);
        g.gain.linearRampToValueAtTime(0, t + noteSec * 0.9);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + noteSec);
        nodes.push(o);
      });
      raf = requestAnimationFrame(tick);
    },
    setVolume(v) { master.gain.value = v; },
    stop() { halt(); ctx.close(); },
  };
}
