/* =============================================================
   Bassoon Ensemble Library — App logic 
   ============================================================= */

'use strict';

// ---------- Configuration ---------------------------------------

var CONFIG = {
  dataPath: 'data/ensemble-scores.xlsx',
  sheetName: 'Scores',

  // Optional client-side password gate.
  // NOTE: UI obscurance only — the xlsx file itself is still downloadable via direct URL.
  // For real privacy use Private GitHub Pages (GitHub Pro) or Cloudflare Access.
  requirePassword: false,
  password: '',
  authStorageKey: 'bel_auth_v1'
};

// ---------- Column mapping --------------------------------------

var COLUMNS = {
  people:       '編成人数',
  ensemble:     '編成',
  title:        'タイトル',
  composer:     '作曲者',
  composerBorn: '作曲者_生年',
  composerDied: '作曲者_没年',
  arranger:     '編曲者',
  arrangerBorn: '編曲者_生年',
  arrangerDied: '編曲者_没年',
  publisher:    '出版社',
  pubNumber:    '出版番号',
  pubYear:      '出版年',
  ismn:         'ISMN',
  isbn:         'ISBN',
  duration:     '時間',
  description:  '説明',
  program:      '曲目',
  skill:        'スキルレベル',
  image:        '画像'
};

// ---------- State ------------------------------------------------

var state = {
  all: [],
  filtered: [],
  filters: { ensemble:new Set(), players:new Set(), skill:new Set(), publisher:new Set() },
  search: '',
  sort: 'title',
  view: 'table'
};

// ---------- Utilities -------------------------------------------

function $(s, r) { return (r||document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function normalize(v) { if (v===null||v===undefined) return ''; return String(v).trim(); }
function escapeHTML(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function parseYear(v) { if (!v) return null; var n=parseInt(String(v).replace(/[^\d]/g,''),10); return isFinite(n)?n:null; }
function formatDates(b,d) { var y1=parseYear(b), y2=parseYear(d); if(y1&&y2) return y1+'–'+y2; if(y1) return 'b. '+y1; if(y2) return 'd. '+y2; return ''; }
function debounce(fn, w) { var t; return function(){ var a=arguments, ctx=this; clearTimeout(t); t=setTimeout(function(){fn.apply(ctx,a);}, w||200); }; }

// ---------- Auth gate -------------------------------------------

function initAuth() {
  if (!CONFIG.requirePassword) { showApp(); return; }
  var granted = sessionStorage.getItem(CONFIG.authStorageKey) === 'ok';
  if (granted) { showApp(); return; }
  var gate = $('#auth-gate');
  gate.hidden = false;
  $('#auth-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var input = $('#auth-input');
    var err = $('#auth-error');
    if (input.value === CONFIG.password) {
      sessionStorage.setItem(CONFIG.authStorageKey, 'ok');
      gate.hidden = true;
      showApp();
    } else {
      err.hidden = false;
      input.value = '';
      input.focus();
    }
  });
}

function showApp() { $('#app').hidden = false; loadData(); }

// ---------- Data loading ----------------------------------------

function loadData() {
  fetch(CONFIG.dataPath)
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + CONFIG.dataPath + ' が読み込めませんでした');
      return res.arrayBuffer();
    })
    .then(function(buf) {
      var wb = XLSX.read(buf, { type: 'array' });
      var sheet = CONFIG.sheetName && wb.Sheets[CONFIG.sheetName]
        ? wb.Sheets[CONFIG.sheetName]
        : wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      state.all = rows.map(normalizeRow);
      onDataReady();
    })
    .catch(function(err) {
      console.error(err);
      showError(err.message || String(err));
    });
}

function normalizeRow(r, i) {
  return {
    _id: i,
    people:       normalize(r[COLUMNS.people]),
    ensemble:     normalize(r[COLUMNS.ensemble]),
    title:        normalize(r[COLUMNS.title]),
    composer:     normalize(r[COLUMNS.composer]),
    composerBorn: normalize(r[COLUMNS.composerBorn]),
    composerDied: normalize(r[COLUMNS.composerDied]),
    arranger:     normalize(r[COLUMNS.arranger]),
    arrangerBorn: normalize(r[COLUMNS.arrangerBorn]),
    arrangerDied: normalize(r[COLUMNS.arrangerDied]),
    publisher:    normalize(r[COLUMNS.publisher]),
    pubNumber:    normalize(r[COLUMNS.pubNumber]),
    pubYear:      normalize(r[COLUMNS.pubYear]),
    ismn:         normalize(r[COLUMNS.ismn]),
    isbn:         normalize(r[COLUMNS.isbn]),
    duration:     normalize(r[COLUMNS.duration]),
    description:  normalize(r[COLUMNS.description]),
    program:      normalize(r[COLUMNS.program]),
    skill:        normalize(r[COLUMNS.skill]),
    image:        normalize(r[COLUMNS.image])
  };
}

function onDataReady() {
  $('#loading').hidden = true;
  if (state.all.length === 0) { $('#empty').hidden = false; return; }
  $('#total-count').textContent = state.all.length;
  buildFilters();
  bindEvents();
  applyFiltersAndRender();
}

function showError(msg) {
  $('#loading').hidden = true;
  $('#error-message').textContent = msg;
  $('#error-state').hidden = false;
}

// ---------- Filter UI -------------------------------------------

function uniqueSorted(vs) {
  var set = {}, out = [];
  for (var i=0; i<vs.length; i++) { var v=vs[i]; if (v!=='' && !set[v]) { set[v]=1; out.push(v); } }
  out.sort(function(a,b){ return String(a).localeCompare(String(b),'ja'); });
  return out;
}

function countBy(field) {
  var m = {};
  state.all.forEach(function(r){ var v=r[field]; if (v==='') return; m[v] = (m[v]||0) + 1; });
  return m;
}

function buildFilters() {
  var ens = uniqueSorted(state.all.map(function(r){return r.ensemble;}));
  renderChipFilter($('#filter-ensemble'), ens, countBy('ensemble'), 'ensemble');
  var ppl = uniqueSorted(state.all.map(function(r){return r.people;})).sort(function(a,b){return Number(a)-Number(b);});
  renderChipFilter($('#filter-players'), ppl, countBy('people'), 'players');
  var sk = uniqueSorted(state.all.map(function(r){return r.skill;}));
  renderChipFilter($('#filter-skill'), sk, countBy('skill'), 'skill');
  var pb = uniqueSorted(state.all.map(function(r){return r.publisher;}));
  renderCheckboxFilter($('#filter-publisher'), pb, countBy('publisher'), 'publisher');
}

function renderChipFilter(container, values, counts, stateKey) {
  if (!values.length) { container.innerHTML = '<p style="font-size:11px;color:var(--ink-faint);margin:0;">（該当なし）</p>'; return; }
  container.innerHTML = values.map(function(v){
    return '<button class="chip" data-value="'+escapeHTML(v)+'">'+escapeHTML(v)+'<span class="chip-count">'+(counts[v]||0)+'</span></button>';
  }).join('');
  container.addEventListener('click', function(e){
    var btn = e.target.closest('.chip');
    if (!btn) return;
    var v = btn.getAttribute('data-value');
    var s = state.filters[stateKey];
    if (s.has(v)) s['delete'](v); else s.add(v);
    btn.classList.toggle('active');
    applyFiltersAndRender();
  });
}

function renderCheckboxFilter(container, values, counts, stateKey) {
  if (!values.length) { container.innerHTML = '<p style="font-size:11px;color:var(--ink-faint);margin:0;">（該当なし）</p>'; return; }
  container.innerHTML = values.map(function(v){
    return '<label class="checkbox-item"><input type="checkbox" value="'+escapeHTML(v)+'"><span>'+escapeHTML(v)+'</span><span class="item-count">'+(counts[v]||0)+'</span></label>';
  }).join('');
  container.addEventListener('change', function(e){
    var cb = e.target;
    if (cb.type !== 'checkbox') return;
    var s = state.filters[stateKey];
    if (cb.checked) s.add(cb.value); else s['delete'](cb.value);
    applyFiltersAndRender();
  });
}

function clearAllFilters() {
  Object.keys(state.filters).forEach(function(k){ state.filters[k].clear(); });
  state.search = '';
  $('#search-input').value = '';
  $('#search-clear').hidden = true;
  $$('.chip.active').forEach(function(c){ c.classList.remove('active'); });
  $$('.checkbox-item input:checked').forEach(function(cb){ cb.checked = false; });
  applyFiltersAndRender();
}

// ---------- Events ----------------------------------------------

function bindEvents() {
  var si = $('#search-input'), sc = $('#search-clear');
  si.addEventListener('input', debounce(function(e){
    state.search = e.target.value.trim().toLowerCase();
    sc.hidden = state.search === '';
    applyFiltersAndRender();
  }, 120));
  sc.addEventListener('click', function(){
    si.value = ''; state.search = ''; sc.hidden = true; applyFiltersAndRender(); si.focus();
  });
  $('#sort-select').addEventListener('change', function(e){ state.sort = e.target.value; applyFiltersAndRender(); });
  $$('.view-btn').forEach(function(b){
    b.addEventListener('click', function(){
      $$('.view-btn').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      state.view = b.getAttribute('data-view');
      render();
    });
  });
  $('#clear-filters').addEventListener('click', clearAllFilters);
  $('#detail-close').addEventListener('click', closeDetail);
  $('#detail-overlay').addEventListener('click', function(e){ if (e.target.id === 'detail-overlay') closeDetail(); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      if (!$('#skill-info-overlay').hidden) closeSkillInfo();
      else if (!$('#detail-overlay').hidden) closeDetail();
    }
  });

  // Skill info popover — delegated for dynamic buttons
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-skill-info]');
    if (btn) { e.stopPropagation(); openSkillInfo(); }
  });
  $('#skill-info-close').addEventListener('click', closeSkillInfo);
  $('#skill-info-overlay').addEventListener('click', function(e){ if (e.target.id === 'skill-info-overlay') closeSkillInfo(); });
}

function openSkillInfo() { $('#skill-info-overlay').hidden = false; }
function closeSkillInfo() { $('#skill-info-overlay').hidden = true; }

// ---------- Filter / sort / render ------------------------------

function applyFiltersAndRender() {
  var f = state.filters, search = state.search;
  state.filtered = state.all.filter(function(r){
    if (f.ensemble.size && !f.ensemble.has(r.ensemble)) return false;
    if (f.players.size && !f.players.has(r.people)) return false;
    if (f.skill.size && !f.skill.has(r.skill)) return false;
    if (f.publisher.size && !f.publisher.has(r.publisher)) return false;
    if (search) {
      var hay = [r.title, r.composer, r.arranger, r.publisher, r.ensemble, r.description, r.program, r.pubNumber, r.ismn, r.isbn].join(' ').toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });
  sortFiltered();
  render();
}

function sortFiltered() {
  var s = state.sort;
  function by(get, dir) {
    dir = dir || 1;
    return function(a,b){
      var va=get(a), vb=get(b);
      if (va===vb) return 0;
      if (va==='' || va==null) return 1;
      if (vb==='' || vb==null) return -1;
      return dir * String(va).localeCompare(String(vb), 'ja');
    };
  }
  function byYear(dir) {
    return function(a,b){
      var ya=parseYear(a.pubYear), yb=parseYear(b.pubYear);
      if (ya===null && yb===null) return 0;
      if (ya===null) return 1;
      if (yb===null) return -1;
      return dir * (ya - yb);
    };
  }
  var map = {
    'title': by(function(r){return r.title;}),
    'title-desc': by(function(r){return r.title;}, -1),
    'composer': by(function(r){return r.composer || r.arranger;}),
    'arranger': by(function(r){return r.arranger || r.composer;}),
    'publisher': by(function(r){return r.publisher;}),
    'year': byYear(-1),
    'year-asc': byYear(1)
  };
  state.filtered.sort(map[s] || map['title']);
}

function render() {
  $('#showing-count').textContent = state.filtered.length;
  var empty = state.filtered.length === 0;
  $('#empty').hidden = !empty;
  $('#view-table').hidden = empty || state.view !== 'table';
  $('#view-card').hidden = empty || state.view !== 'card';
  if (empty) return;
  if (state.view === 'table') renderTable(); else renderCards();
}

function imageTag(url, small, title) {
  if (url && /^https?:\/\//i.test(url)) return '<img src="'+escapeHTML(url)+'" alt="" loading="lazy">';
  return small
    ? '<div class="row-cover-placeholder">—</div>'
    : '<div class="card-cover-placeholder">'+(escapeHTML((title||'').slice(0,1)) || '♪')+'</div>';
}

function renderTable() {
  var tb = $('#table-body');
  tb.innerHTML = state.filtered.map(function(r){
    return '<tr data-id="'+r._id+'">' +
      '<td><div class="row-cover">'+imageTag(r.image,true)+'</div></td>' +
      '<td><div class="row-title">'+(escapeHTML(r.title)||'—')+'</div>'+(r.duration?'<div class="row-subtitle">'+escapeHTML(r.duration)+'</div>':'')+'</td>' +
      '<td>'+(r.ensemble?'<span class="row-ensemble">'+escapeHTML(r.ensemble)+'</span>':'')+'</td>' +
      '<td><div class="row-people">'+(escapeHTML(r.people)||'—')+'</div></td>' +
      '<td><div class="row-composer">'+(escapeHTML(r.composer)||'—')+'</div></td>' +
      '<td><div class="row-arranger">'+(escapeHTML(r.arranger)||'—')+'</div></td>' +
      '<td><div class="row-publisher">'+(escapeHTML(r.publisher)||'—')+'</div>'+(r.pubNumber?'<div class="row-pub-number">'+escapeHTML(r.pubNumber)+'</div>':'')+'</td>' +
      '<td>'+(r.skill?'<span class="row-skill">'+escapeHTML(r.skill)+'</span>':'')+'</td>' +
    '</tr>';
  }).join('');
  $$('tr', tb).forEach(function(tr){
    tr.addEventListener('click', function(){
      var id = Number(tr.getAttribute('data-id'));
      openDetail(state.all.filter(function(r){return r._id===id;})[0]);
    });
  });
}

function renderCards() {
  var c = $('#view-card');
  c.innerHTML = state.filtered.map(function(r){
    return '<article class="card" data-id="'+r._id+'">' +
      '<div class="card-cover">'+imageTag(r.image,false,r.title)+(r.ensemble?'<div class="card-cover-ensemble">'+escapeHTML(r.ensemble)+'</div>':'')+'</div>' +
      '<div class="card-body">' +
        '<h3 class="card-title">'+(escapeHTML(r.title)||'—')+'</h3>' +
        '<div class="card-meta">' +
          (r.composer?'<div><span class="card-meta-label">Comp.</span>'+escapeHTML(r.composer)+'</div>':'') +
          (r.arranger?'<div><span class="card-meta-label">Arr.</span>'+escapeHTML(r.arranger)+'</div>':'') +
        '</div>' +
        '<div class="card-footer">' +
          '<div class="card-publisher">'+(escapeHTML(r.publisher)||'')+'</div>' +
          (r.skill?'<span class="card-skill">'+escapeHTML(r.skill)+'</span>':'') +
        '</div>' +
      '</div>' +
    '</article>';
  }).join('');
  $$('.card', c).forEach(function(el){
    el.addEventListener('click', function(){
      var id = Number(el.getAttribute('data-id'));
      openDetail(state.all.filter(function(r){return r._id===id;})[0]);
    });
  });
}

// ---------- Detail panel ----------------------------------------

function openDetail(r) {
  if (!r) return;
  var cD = formatDates(r.composerBorn, r.composerDied);
  var aD = formatDates(r.arrangerBorn, r.arrangerDied);

  var metaChips = [];
  if (r.ensemble) metaChips.push('<div class="detail-meta-chip"><span class="chip-label">編成</span><span class="chip-value">'+escapeHTML(r.ensemble)+'</span></div>');
  if (r.people) metaChips.push('<div class="detail-meta-chip"><span class="chip-label">人数</span><span class="chip-value">'+escapeHTML(r.people)+'</span></div>');
  if (r.skill) metaChips.push('<div class="detail-meta-chip is-skill"><span class="chip-label">スキル</span><span class="chip-value">'+escapeHTML(r.skill)+'</span><button class="skill-info-btn" data-skill-info aria-label="スキルレベルについて">i</button></div>');
  var el = metaChips.join('');

  var mr = [];
  if (r.publisher) mr.push(['Publisher', escapeHTML(r.publisher)]);
  if (r.pubNumber) mr.push(['Cat. No.', '<code>'+escapeHTML(r.pubNumber)+'</code>']);
  if (r.pubYear) mr.push(['Year', escapeHTML(r.pubYear)]);
  if (r.ismn) mr.push(['ISMN', '<code>'+escapeHTML(r.ismn)+'</code>']);
  if (r.isbn) mr.push(['ISBN', '<code>'+escapeHTML(r.isbn)+'</code>']);
  if (r.duration) mr.push(['Duration', escapeHTML(r.duration)]);

  $('#detail-body').innerHTML =
    '<div class="detail-ensemble-line">'+el+'</div>' +
    '<h2 class="detail-title">'+(escapeHTML(r.title)||'—')+'</h2>' +
    (r.image && /^https?:\/\//i.test(r.image) ? '<div class="detail-cover"><img src="'+escapeHTML(r.image)+'" alt=""></div>' : '') +
    (r.composer ? '<div class="detail-section"><div class="detail-section-label">作曲 Composer</div><p class="detail-person">'+escapeHTML(r.composer)+(cD?'<span class="detail-person-dates">'+escapeHTML(cD)+'</span>':'')+'</p></div>' : '') +
    (r.arranger ? '<div class="detail-section"><div class="detail-section-label">編曲 Arranger</div><p class="detail-person">'+escapeHTML(r.arranger)+(aD?'<span class="detail-person-dates">'+escapeHTML(aD)+'</span>':'')+'</p></div>' : '') +
    (mr.length ? '<div class="detail-section"><div class="detail-section-label">出版情報 Publication</div><dl class="detail-grid">'+mr.map(function(kv){return '<dt>'+kv[0]+'</dt><dd>'+kv[1]+'</dd>';}).join('')+'</dl></div>' : '') +
    (r.description ? '<div class="detail-section"><div class="detail-section-label">説明 Description</div><p class="detail-description">'+escapeHTML(r.description)+'</p></div>' : '') +
    (r.program ? '<div class="detail-section"><div class="detail-section-label">曲目 Program</div><p class="detail-description">'+escapeHTML(r.program)+'</p></div>' : '');

  $('#detail-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  $('#detail-overlay').hidden = true;
  document.body.style.overflow = '';
}

// ---------- Boot ------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
