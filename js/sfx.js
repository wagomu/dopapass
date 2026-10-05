// 効果音は Web Audio で生成する（音声ファイル不要）。
// iOS は最初のユーザー操作で AudioContext を resume しないと鳴らない。

let ctx = null;
let muted = false;

export function setMuted(m) { muted = m; }

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, start, dur, { type = 'square', vol = 0.12, slideTo = null } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// コンボが伸びるほど音程が上がる
export function correct(combo = 1) {
  const up = Math.min(combo - 1, 12);
  const base = 523.25 * Math.pow(2, up / 12);
  tone(base, 0, 0.09);
  tone(base * 1.26, 0.07, 0.09);
  tone(base * 1.5, 0.14, 0.18);
  if (combo >= 5) tone(base * 2, 0.22, 0.25, { type: 'triangle', vol: 0.1 });
  vibrate(30);
}

export function wrong() {
  tone(180, 0, 0.32, { type: 'sawtooth', vol: 0.1, slideTo: 90 });
  tone(120, 0.02, 0.32, { type: 'square', vol: 0.06, slideTo: 70 });
  vibrate([60, 40, 60]);
}

export function tick() {
  tone(1200, 0, 0.04, { type: 'sine', vol: 0.06 });
}

export function tap() {
  tone(880, 0, 0.03, { type: 'sine', vol: 0.05 });
}

export function levelUp() {
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, i * 0.09, i === notes.length - 1 ? 0.5 : 0.12, { vol: 0.1 }));
  vibrate([40, 30, 40, 30, 120]);
}

export function finish() {
  [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.08, 0.2, { type: 'triangle', vol: 0.1 }));
}
