// 出題の選び方とスコア計算。DOM には触らない。

export const SESSION_SIZE = 10;
export const TIME_LIMIT = 15; // 秒

const OK_REACTIONS = ['それな！', '天才か？', '秒で正解', '優勝🏆', '神', 'わかってるやん', 'ガチ勢', 'エグい', '完全に理解してる', 'つよ'];
const NG_REACTIONS = ['ドンマイ', '草', 'それは沼', 'ワンチャンなかった', 'おしい…？', '次いこ次', '伸びしろですねぇ'];
const TIMEOUT_REACTIONS = ['時間切れ⌛', '寝てた？', 'フリーズ草'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function reaction(kind) {
  return pick(kind === 'ok' ? OK_REACTIONS : kind === 'timeout' ? TIMEOUT_REACTIONS : NG_REACTIONS);
}

// 解いた回数が少ない問題を優先して出す（同じ回数ならランダム）
export function buildSession(pool, timesSeen, size = SESSION_SIZE) {
  const ranked = shuffle(pool)
    .map(q => ({ q, seen: timesSeen(q.id) }))
    .sort((a, b) => a.seen - b.seen)
    .slice(0, size)
    .map(x => x.q);
  return shuffle(ranked);
}

export function comboMultiplier(combo) {
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

// 正解時の獲得XP。combo は今回の正解を含めた連続数、remain は残り時間の割合(0..1)
export function scoreFor(combo, remain) {
  const base = Math.round(10 * comboMultiplier(combo));
  const speed = Math.round(5 * Math.max(0, Math.min(1, remain)));
  return { base, speed, total: base + speed };
}
