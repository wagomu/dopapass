import * as P from './progress.js';
import * as S from './sfx.js';
import { buildSession, scoreFor, reaction, TIME_LIMIT, SESSION_SIZE } from './quiz.js';

const $ = (id) => document.getElementById(id);
const KANA = ['ア', 'イ', 'ウ', 'エ'];
const FIELD_NAME = { strategy: 'ストラテジ', management: 'マネジメント', technology: 'テクノロジ' };

const data = { past: [], original: [] };
const ui = { mode: 'mix', field: 'all' };
let session = null;

// ---------- 起動 ----------
init();

async function init() {
  S.setMuted(P.get().muted);
  bindHome();
  bindQuiz();
  renderHome();
  const [past, original] = await Promise.all([loadJson('data/past.json'), loadJson('data/original.json')]);
  data.past = past;
  data.original = original;
  renderHome();
  // localhost では開発しやすいよう SW を使わない（?sw=1 で強制的に有効化）
  const devHost = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw=1');
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !devHost) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function loadJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function show(screen) {
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === `screen-${screen}`));
  window.scrollTo(0, 0);
}

// ---------- ホーム ----------
function poolFor(mode, field) {
  let pool;
  if (mode === 'past') pool = data.past;
  else if (mode === 'original') pool = data.original;
  else if (mode === 'mix') pool = [...data.past, ...data.original];
  else {
    const weak = new Set(P.summary().weakIds);
    pool = [...data.past, ...data.original].filter(q => weak.has(q.id));
  }
  return field === 'all' ? pool : pool.filter(q => q.field === field);
}

function renderHome() {
  const s = P.summary();
  $('home-level').textContent = s.level;
  $('home-title').textContent = s.title;
  $('home-xp').textContent = s.xpInLevel;
  $('home-xpnext').textContent = s.xpLevelSpan;
  $('home-xpfill').style.width = `${(s.xpInLevel / s.xpLevelSpan) * 100}%`;
  $('home-streak').textContent = s.streak;
  $('home-acc').textContent = s.accuracy == null ? '-' : `${s.accuracy}%`;
  $('home-best').textContent = s.bestCombo;
  $('home-cleared').textContent = s.cleared;
  $('btn-mute').textContent = P.get().muted ? '🔇' : '🔊';

  for (const mode of ['past', 'original', 'mix', 'weak']) {
    $(`cnt-${mode}`).textContent = `${poolFor(mode, ui.field).length}問`;
  }
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === ui.mode));
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.field === ui.field));

  const n = poolFor(ui.mode, ui.field).length;
  $('btn-start').disabled = n === 0;
  $('btn-start').textContent = `スタート ▶ ${Math.min(n, SESSION_SIZE) || ''}問`;
  $('home-msg').textContent = n === 0
    ? (ui.mode === 'weak' ? '苦手な問題はまだないよ。強すぎ。' : 'この条件の問題がないっぽい')
    : '';
}

function bindHome() {
  $('mode-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.mode-btn');
    if (!b) return;
    S.unlock(); S.tap();
    ui.mode = b.dataset.mode;
    renderHome();
  });
  $('field-chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    S.unlock(); S.tap();
    ui.field = b.dataset.field;
    renderHome();
  });
  $('btn-mute').addEventListener('click', () => {
    const m = !P.get().muted;
    P.setMuted(m);
    S.setMuted(m);
    S.unlock();
    renderHome();
  });
  $('btn-start').addEventListener('click', () => { S.unlock(); startSession(); });
}

// ---------- 出題 ----------
function startSession() {
  const pool = poolFor(ui.mode, ui.field);
  if (!pool.length) return;
  session = {
    questions: buildSession(pool, P.timesSeen),
    index: 0,
    combo: 0,
    maxCombo: 0,
    xp: 0,
    results: [], // { q, ok, time }
    timer: null,
  };
  renderDots();
  show('quiz');
  showQuestion();
}

function renderDots() {
  const dots = $('progress-dots');
  dots.innerHTML = '';
  session.questions.forEach((_, i) => {
    const d = document.createElement('i');
    const r = session.results[i];
    if (r) d.className = r.ok ? 'ok' : 'ng';
    else if (i === session.index) d.className = 'now';
    dots.appendChild(d);
  });
}

function showQuestion() {
  const q = session.questions[session.index];
  $('q-text').textContent = q.q;
  renderTable(q.table);
  $('quiz-meta').innerHTML = '';
  $('quiz-meta').append(
    `${session.index + 1}/${session.questions.length}`,
    Object.assign(document.createElement('span'), { className: `fld ${q.field}`, textContent: FIELD_NAME[q.field] || q.field }),
  );
  $('q-credit').textContent = creditText(q);
  $('quiz-xp').textContent = session.xp;
  renderCombo(false);

  const box = $('choices');
  box.innerHTML = '';
  q.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.dataset.i = i;
    b.innerHTML = `<span class="kana">${KANA[i]}</span><span class="ctext"></span>`;
    b.querySelector('.ctext').textContent = c;
    box.appendChild(b);
  });
  $('feedback').className = 'feedback hidden';
  window.scrollTo(0, 0);
  renderDots();
  startTimer();
}

function creditText(q) {
  if (!q.credit) return '';
  return q.modified ? `${q.credit}（改変あり）` : q.credit;
}

function renderTable(table) {
  const wrap = $('q-table');
  wrap.innerHTML = '';
  if (!Array.isArray(table) || !table.length) return;
  const t = document.createElement('table');
  table.forEach((row, ri) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const c = document.createElement(ri === 0 ? 'th' : 'td');
      c.textContent = cell;
      tr.appendChild(c);
    });
    t.appendChild(tr);
  });
  wrap.appendChild(t);
}

function renderCombo(bump) {
  const el = $('combo-label');
  el.textContent = session.combo >= 2 ? `${session.combo} COMBO🔥` : '';
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

function startTimer() {
  stopTimer();
  const fill = $('timer-fill');
  const start = performance.now();
  let lastTick = TIME_LIMIT;
  const loop = (now) => {
    const remain = Math.max(0, TIME_LIMIT - (now - start) / 1000);
    const ratio = remain / TIME_LIMIT;
    fill.style.transform = `scaleX(${ratio})`;
    fill.className = 'timer-fill' + (remain <= 3 ? ' danger' : remain <= 7 ? ' warn' : '');
    if (remain <= 3 && Math.ceil(remain) < lastTick) {
      lastTick = Math.ceil(remain);
      if (remain > 0) S.tick();
    }
    session.remain = ratio;
    if (remain <= 0) {
      session.timer = null;
      answer(-1);
      return;
    }
    session.timer = requestAnimationFrame(loop);
  };
  session.startedAt = start;
  session.timer = requestAnimationFrame(loop);
}

function stopTimer() {
  if (session && session.timer) cancelAnimationFrame(session.timer);
  if (session) session.timer = null;
}

function bindQuiz() {
  $('choices').addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (!b || b.disabled) return;
    answer(Number(b.dataset.i));
  });
  $('btn-next').addEventListener('click', () => {
    S.tap();
    session.index++;
    if (session.index >= session.questions.length) finishSession();
    else showQuestion();
  });
  $('btn-quit').addEventListener('click', () => {
    stopTimer();
    if (session && session.results.length) P.finishSession(session.xp, session.maxCombo);
    session = null;
    renderHome();
    show('home');
  });
  $('btn-again').addEventListener('click', () => { S.unlock(); startSession(); });
  $('btn-home').addEventListener('click', () => { renderHome(); show('home'); });
  $('btn-lu-ok').addEventListener('click', () => { $('levelup').classList.add('hidden'); });
}

function answer(choice) {
  if (!session || $('feedback').className.indexOf('hidden') < 0) return;
  stopTimer();
  const q = session.questions[session.index];
  const ok = choice === q.answer;
  const timeout = choice === -1;
  const elapsed = (performance.now() - session.startedAt) / 1000;

  document.querySelectorAll('.choice').forEach(b => {
    const i = Number(b.dataset.i);
    b.disabled = true;
    if (i === q.answer) b.classList.add('correct');
    else if (i === choice) b.classList.add('wrong');
    else b.classList.add('dim');
  });

  let head;
  if (ok) {
    session.combo++;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    const sc = scoreFor(session.combo, session.remain ?? 0);
    session.xp += sc.total;
    const r = reaction('ok');
    head = `⭕ ${r}<small>+${sc.base} XP${sc.speed ? ` / スピードボーナス +${sc.speed}` : ''}</small>`;
    S.correct(session.combo);
    burst(session.combo);
    popup(session.combo >= 3 ? `${session.combo} COMBO!!` : r, false);
    flash('rgba(182,255,59,.5)');
  } else {
    const hadCombo = session.combo;
    session.combo = 0;
    const r = reaction(timeout ? 'timeout' : 'ng');
    head = `❌ ${r}<small>正解は「${KANA[q.answer]}」${hadCombo >= 3 ? `　${hadCombo}コンボ途切れた…` : ''}</small>`;
    S.wrong();
    popup(r, true);
    flash('rgba(255,77,77,.5)');
    shake();
  }
  P.recordAnswer(q.id, ok);
  session.results[session.index] = { q, ok, time: Math.min(elapsed, TIME_LIMIT) };

  $('quiz-xp').textContent = session.xp;
  renderCombo(ok);
  renderDots();
  $('fb-head').innerHTML = head;
  $('fb-explain').innerHTML = formatExplain(q.explain || '');
  $('btn-next').textContent = session.index + 1 >= session.questions.length ? '結果を見る 🏁' : '次へ ▶';
  const fb = $('feedback');
  fb.className = `feedback ${ok ? 'ok' : 'ng'}`;
  fb.scrollTop = 0;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// **太字** だけ対応
function formatExplain(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// ---------- 結果 ----------
function finishSession() {
  const s = session;
  const correct = s.results.filter(r => r.ok).length;
  const total = s.questions.length;
  // パーフェクトボーナス
  if (correct === total) s.xp += 50;
  const newLevel = P.finishSession(s.xp, s.maxCombo);

  const rate = correct / total;
  $('res-head').textContent =
    rate === 1 ? '🏆 パーフェクト！！ +50XP' :
    rate >= 0.8 ? '🔥 つよすぎ' :
    rate >= 0.6 ? '😎 合格ライン' :
    rate >= 0.4 ? '🤔 伸びしろ' : '💀 苦手つぶしいこ';
  $('res-correct').textContent = correct;
  $('res-correct').nextElementSibling.textContent = `/ ${total}`;
  $('res-xp').textContent = s.xp;
  $('res-combo').textContent = s.maxCombo;
  $('res-time').textContent = (s.results.reduce((a, r) => a + r.time, 0) / total).toFixed(1);

  const list = $('res-list');
  list.innerHTML = '';
  s.results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'res-item';
    item.innerHTML = `<span class="mark">${r.ok ? '⭕' : '❌'}</span><span class="rq"></span>`;
    item.querySelector('.rq').textContent = r.q.q;
    list.appendChild(item);
  });

  show('result');
  S.finish();
  if (rate >= 0.8) setTimeout(() => burst(12), 200);
  if (newLevel) {
    setTimeout(() => {
      $('lu-level').textContent = newLevel;
      const t = P.titleFor(newLevel);
      const next = P.nextTitleLevel(newLevel);
      $('lu-title').textContent = t !== P.titleFor(newLevel - 1)
        ? `新称号「${t}」GET！`
        : next ? `次の称号まであと ${next - newLevel} レベル` : `称号「${t}」`;
      $('levelup').classList.remove('hidden');
      S.levelUp();
      burst(15);
    }, 700);
  }
}

// ---------- エフェクト ----------
function burst(power) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = $('fx-layer');
  const colors = ['#ff2e93', '#19e3ff', '#b6ff3b', '#ffd23f', '#b77bff'];
  const n = Math.min(14 + power * 4, 70);
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.4;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.background = colors[i % colors.length];
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    layer.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * (120 + power * 10);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 60;
    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => p.remove();
  }
}

function popup(text, ng) {
  const el = document.createElement('div');
  el.className = `popup${ng ? ' ng' : ''}`;
  el.textContent = text;
  $('fx-layer').appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function flash(color) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = color;
  $('fx-layer').appendChild(el);
  setTimeout(() => el.remove(), 400);
}

function shake() {
  const app = $('app');
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
}
