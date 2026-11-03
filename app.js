const $ = id => document.getElementById(id);
const key = 'yohaku.v1';
const state = JSON.parse(localStorage.getItem(key) || '{"plans":{},"tasks":{},"templates":[]}');
const save = () => localStorage.setItem(key, JSON.stringify(state));
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-');
};
const items = (kind, date) => state[kind][date] ||= [];
const ordered = date => [...items('plans', date)].sort((a,b) => a.start.localeCompare(b.start));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const minutes = time => time.split(':').reduce((h,m) => +h * 60 + +m);
const title = name => '<h1>' + name + '</h1>';
const blankTask = '何もしない';
const nameInput = placeholder => '<label>内容<input name="name" required maxlength="100" placeholder="' +
  placeholder + '"></label><label>よく使う項目<select data-presets><option value="">登録済みの項目を選ぶ</option>' +
  [blankTask, ...state.templates.filter(t => t !== blankTask)].map(t =>
    '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('') + '</select></label>';

function bindPresets(form) {
  const select = form.querySelector('[data-presets]');
  select.onchange = () => {
    if (select.value) form.elements.name.value = select.value;
    select.selectedIndex = 0;
  };
}

const range = p => p.start + '–' + p.end;
const remove = '<button type="button" data-remove aria-label="削除">×</button>';
let tab = 'Home';

function render() {
  const now = new Date();
  const time = now.getHours() * 60 + now.getMinutes();
  const date = day();
  $('date').textContent = new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(now);
  $('templates').hidden = tab !== 'Home';
  document.querySelectorAll('nav button').forEach(b => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  const plans = ordered(date);
  if (tab === 'Home') {
    const current = plans.find(p => minutes(p.start) <= time && time < minutes(p.end));
    const next = plans.find(p => minutes(p.start) > time);
    $('view').innerHTML = title('Home') + '<section class="feature"><small>いま</small><strong>' +
      (current ? esc(current.name) : '予定なし') + '</strong>' +
      (current ? '<p>' + current.end + ' まで</p>' : '') + '</section><section class="next"><small>次の予定</small><p>' +
      (next ? next.start + '　' + esc(next.name) : '今日の予定はここまで') + '</p></section>';
  } else if (tab === 'Today') {
    $('view').innerHTML = title('Today') + (plans.map(p => '<div class="row ' +
      (p.weight === 'small' ? 'compact' : 'large') + '"><small>' + range(p) + '</small><span>' + esc(p.name) + '</span></div>').join('') ||
      '<p class="muted">今日の予定はありません</p>');
  } else {
    const tasks = items('tasks',date);
    $('view').innerHTML = title('Task') + '<form id="task-form">' + nameInput('今日やること') +
      '<button class="primary">追加</button></form>' + tasks.map((t,i) =>
        '<div class="row" data-index="' + i + '"><label style="display:flex;align-items:center"><input type="checkbox" ' +
        (t.done ? 'checked' : '') + '><span class="' + (t.done ? 'done' : '') + '">' + esc(t.name) + '</span></label>' + remove + '</div>').join('');
    bindPresets($('task-form'));
    $('task-form').onsubmit = event => {
      event.preventDefault();
      const name = event.target.elements.name.value.trim();
      if (name) { tasks.push({name,done:false}); save(); render(); }
    };
    $('view').querySelectorAll('[data-index]').forEach((row,i) => {
      row.querySelector('input').onchange = event => { tasks[i].done = event.target.checked; save(); render(); };
      row.querySelector('button').onclick = () => { tasks.splice(i,1); save(); render(); };
    });
  }
}

function openEditor(heading, content) {
  $('heading').textContent = heading;
  $('editor').innerHTML = content;
  if (!$('dialog').open) $('dialog').showModal();
}
function drawClock(plans, draft) {
  const point = m => {
    const angle = m / 1440 * 2 * Math.PI;
    return [80 + 56 * Math.sin(angle),80 - 56 * Math.cos(angle)];
  };
  const arc = (p,color,radius) => {
    const a = minutes(p.start), b = minutes(p.end);
    if (!(a < b)) return '';
    return '<path d="M ' + point(a).join(' ') + ' A 56 56 0 ' + Number(b-a > 720) +
      ' 1 ' + point(b).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="' + radius + '"/>';
  };
  $('clock').innerHTML = '<circle cx="80" cy="80" r="56" fill="none" stroke="#d7d6cc" stroke-width="8"/>' +
    plans.map(p => arc(p,p.weight === 'small' ? '#a1a38a' : '#526857',p.weight === 'small' ? 5 : 9)).join('') +
    arc(draft,'#a86e55',4) +
    '<g text-anchor="middle" font-size="10" fill="#62685e"><text x="80" y="15">0</text><text x="147" y="84">6</text><text x="80" y="154">12</text><text x="13" y="84">18</text><text x="80" y="84">24時間</text></g>';
}

function planEditor(date, index = -1) {
  const plans = items('plans',date);
  const edit = plans[index];
  openEditor('明日の予定', '<small>' + date + '</small><svg id="clock" class="clock" viewBox="0 0 160 160" role="img" aria-label="24時間の予定配置"></svg>' +
    '<form id="plan-form">' + nameInput('予定名を入力または選択') +
    '<div class="inputs"><label>開始<input name="start" type="time" required></label><label>終了<input name="end" type="time" required></label></div>' +
    '<label>ウェイト<select name="weight"><option value="small">小 · 家事など</option><option value="large">大 · 勉強など</option></select></label>' +
    '<p id="error" class="status" role="alert"></p><button class="primary">' + (edit ? '変更を保存' : '予定を追加') + '</button></form>' +
    ordered(date).map(p => '<div class="row" data-index="' + plans.indexOf(p) + '"><small>' + range(p) + '</small><span>' + esc(p.name) +
      '</span><div><button type="button" data-edit>編集</button>' + remove + '</div></div>').join(''));
  const form = $('plan-form');
  bindPresets(form);
  if (edit) for (const field of ['name','start','end','weight']) form.elements[field].value = edit[field];
  const draft = () => Object.fromEntries(new FormData(form));
  const preview = () => drawClock(plans.filter((_,i) => i !== index),draft());
  form.oninput = preview;
  preview();
  form.onsubmit = event => {
    event.preventDefault();
    const p = draft();
    p.name = p.name.trim();
    if (!p.name) { $('error').textContent = '予定名を入力してください。'; return; }
    if (p.start >= p.end) { $('error').textContent = '終了は開始より後にしてください。'; return; }
    if (plans.some((other,i) => i !== index && p.start < other.end && other.start < p.end)) {
      $('error').textContent = 'ほかの予定と時間が重なっています。'; return;
    }
    if (edit) plans[index] = p;
    else plans.push(p);
    save();
    planEditor(date);
  };
  $('editor').querySelectorAll('[data-index]').forEach(row => {
    const i = Number(row.dataset.index);
    row.querySelector('[data-edit]').onclick = () => planEditor(date,i);
    row.querySelector('[data-remove]').onclick = () => { plans.splice(i,1); save(); planEditor(date); };
  });
}

function templateEditor(index = -1) {
  openEditor('よく使う項目', '<form id="template-form"><label>項目名<input name="name" required maxlength="100"></label>' +
    '<button class="primary">' + (index < 0 ? '追加' : '変更を保存') + '</button></form>' +
    state.templates.map((t,i) => '<div class="row" data-index="' + i + '"><span>' + esc(t) +
      '</span><div><button data-edit>編集</button>' + remove + '</div></div>').join(''));
  const form = $('template-form');
  if (index >= 0) form.elements.name.value = state.templates[index];
  form.onsubmit = event => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;
    if (state.templates.some((t,i) => t === name && i !== index)) {
      form.elements.name.setCustomValidity('同じ項目が登録されています。');
      form.elements.name.reportValidity();
      return;
    }
    if (index < 0) state.templates.push(name);
    else state.templates[index] = name;
    save();
    templateEditor();
  };
  form.elements.name.oninput = () => form.elements.name.setCustomValidity('');
  $('editor').querySelectorAll('[data-index]').forEach(row => {
    const i = Number(row.dataset.index);
    row.querySelector('[data-edit]').onclick = () => templateEditor(i);
    row.querySelector('[data-remove]').onclick = () => { state.templates.splice(i,1); save(); templateEditor(); };
  });
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
$('plan').onclick = () => planEditor(day(1));
$('templates').onclick = () => templateEditor();
$('close').onclick = () => $('dialog').close();
$('dialog').onclose = render;
let renderedDay = day();
setInterval(() => {
  const date = day();
  if (tab === 'Home' || renderedDay !== date) render();
  renderedDay = date;
}, 5000);
render();
