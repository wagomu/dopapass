// プレイヤーの進捗（XP・レベル・連続日数・苦手問題）を localStorage に保存する。
// プライベートブラウズ等で storage が使えなくてもメモリ上で動くようにする。

const KEY = 'dopapass.v1';

const TITLES = [
  [1, 'ITの赤ちゃん👶'],
  [3, 'ググれる人'],
  [5, 'Excelつよつよ'],
  [8, '情シス見習い'],
  [12, 'パケットと会話できる'],
  [16, 'セキュリティの民'],
  [20, 'iパス完全に理解した'],
  [25, '歩くシラバス'],
  [30, 'IT神'],
];

function blank() {
  return {
    xp: 0,
    bestCombo: 0,
    answered: 0,
    correct: 0,
    streak: 0,
    lastDay: null,
    muted: false,
    // id -> { c: 正解数, w: 不正解数 }
    record: {},
    // 苦手リスト: id -> true
    weak: {},
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch { /* storage 不可 */ }
  return blank();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage 不可 */ }
}

// レベル L に到達するのに必要な累計XP: 50 * L * (L - 1)
export function levelFromXp(xp) {
  let lv = 1;
  while (xp >= 50 * (lv + 1) * lv) lv++;
  return lv;
}
export function xpForLevel(lv) { return 50 * lv * (lv - 1); }

export function titleFor(lv) {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (lv >= min) t = name;
  return t;
}

export function nextTitleLevel(lv) {
  const next = TITLES.find(([min]) => min > lv);
  return next ? next[0] : null;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function get() { return state; }

export function summary() {
  const lv = levelFromXp(state.xp);
  const base = xpForLevel(lv);
  const next = xpForLevel(lv + 1);
  const streakAlive = state.lastDay === today() || state.lastDay === yesterday();
  return {
    level: lv,
    title: titleFor(lv),
    xpInLevel: state.xp - base,
    xpLevelSpan: next - base,
    streak: streakAlive ? state.streak : 0,
    accuracy: state.answered ? Math.round((state.correct / state.answered) * 100) : null,
    bestCombo: state.bestCombo,
    cleared: Object.values(state.record).filter(r => r.c > 0).length,
    weakIds: Object.keys(state.weak),
  };
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function recordAnswer(id, ok) {
  const r = state.record[id] || { c: 0, w: 0 };
  if (ok) r.c++; else r.w++;
  state.record[id] = r;
  state.answered++;
  if (ok) {
    state.correct++;
    delete state.weak[id];
  } else {
    state.weak[id] = true;
  }
  save();
}

// セッション終了時に呼ぶ。レベルアップしたら新レベルを返す。
export function finishSession(gainedXp, maxCombo) {
  const before = levelFromXp(state.xp);
  state.xp += gainedXp;
  state.bestCombo = Math.max(state.bestCombo, maxCombo);
  const t = today();
  if (state.lastDay !== t) {
    state.streak = state.lastDay === yesterday() ? state.streak + 1 : 1;
    state.lastDay = t;
  }
  save();
  const after = levelFromXp(state.xp);
  return after > before ? after : null;
}

export function timesSeen(id) {
  const r = state.record[id];
  return r ? r.c + r.w : 0;
}

export function setMuted(m) { state.muted = m; save(); }
