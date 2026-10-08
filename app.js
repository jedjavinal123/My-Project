(() => {
  'use strict';

  const STORAGE_KEY = 'poe2-build-tracker:v1';
  const UI_KEY = 'poe2-build-tracker:ui';
  const TABS = ['Overview', 'Skills', 'Gear', 'Goals', 'Progress'];
  const RES_CAP = 75;
  const { classes, gearSlots, statuses, snapshotFields } = window.POE2;

  const state = {
    builds: load(STORAGE_KEY, []),
    ...load(UI_KEY, { selectedId: null, tab: 'Overview', chartField: 'life' }),
    filter: '',
  };

  // ---------- persistence ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.builds));
      localStorage.setItem(UI_KEY, JSON.stringify({
        selectedId: state.selectedId, tab: state.tab, chartField: state.chartField,
      }));
    } catch (err) {
      console.error('Could not save to localStorage', err);
    }
  }

  // ---------- helpers ----------

  const $ = (sel) => document.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const today = () => new Date().toISOString().slice(0, 10);

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    if (n === '' || n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString();
  }

  function newBuild(overrides = {}) {
    return {
      id: uid(),
      name: 'New build',
      cls: 'Warrior',
      ascendancy: '',
      level: 1,
      league: '',
      status: 'Planning',
      mainSkill: '',
      treeUrl: '',
      guideUrl: '',
      pobCode: '',
      notes: '',
      skills: [],
      gear: {},
      goals: [],
      snapshots: [],
      created: Date.now(),
      updated: Date.now(),
      ...overrides,
    };
  }

  // Fill in any fields missing from builds saved by older versions or imported.
  function normalize(build) {
    const base = newBuild();
    const b = { ...base, ...build };
    b.id = b.id || uid();
    b.skills = Array.isArray(b.skills) ? b.skills : [];
    b.skills.forEach((s) => { s.supports = Array.isArray(s.supports) ? s.supports : []; s.id = s.id || uid(); });
    b.gear = b.gear && typeof b.gear === 'object' ? b.gear : {};
    b.goals = Array.isArray(b.goals) ? b.goals : [];
    b.goals.forEach((g) => { g.id = g.id || uid(); });
    b.snapshots = Array.isArray(b.snapshots) ? b.snapshots : [];
    b.snapshots.forEach((s) => { s.id = s.id || uid(); });
    return b;
  }

  state.builds = state.builds.map(normalize);

  const current = () => state.builds.find((b) => b.id === state.selectedId) || null;

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let target = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (target[k] == null) target[k] = {};
      target = target[k];
    }
    target[keys[keys.length - 1]] = value;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'build';

  // ---------- rendering ----------

  function render() {
    renderSidebar();
    renderMain();
    save();
  }

  function renderSidebar() {
    const f = state.filter.toLowerCase();
    const builds = [...state.builds]
      .sort((a, b) => b.updated - a.updated)
      .filter((b) => !f || [b.name, b.cls, b.ascendancy, b.league, b.mainSkill].join(' ').toLowerCase().includes(f));

    $('#build-list').innerHTML = builds.length
      ? builds.map((b) => `
        <li data-action="select" data-id="${esc(b.id)}" class="${b.id === state.selectedId ? 'active' : ''}">
          <div class="name">${esc(b.name || 'Untitled')}</div>
          <div class="meta">Lv ${esc(b.level)} ${esc(b.ascendancy || b.cls)} · <span class="badge status-${esc(b.status)}">${esc(b.status)}</span></div>
        </li>`).join('')
      : `<li class="muted">${state.builds.length ? 'No matches' : 'No builds yet'}</li>`;
  }

  function renderMain() {
    const b = current();
    if (!b) {
      $('#main').innerHTML = `
        <div class="empty">
          <p>Track your Path of Exile 2 characters: skills, gear, upgrade goals and stat progress.</p>
          <button data-action="new-build" class="btn btn-primary">Create your first build</button>
        </div>`;
      return;
    }

    $('#ascendancy-options').innerHTML = (classes[b.cls] || [])
      .map((a) => `<option value="${esc(a)}">`).join('');

    const tabBody = {
      Overview: renderOverview,
      Skills: renderSkills,
      Gear: renderGear,
      Goals: renderGoals,
      Progress: renderProgress,
    }[state.tab] || renderOverview;

    $('#main').innerHTML = `
      <div class="build-header">
        <div>
          <h2>${esc(b.name || 'Untitled')}</h2>
          <div class="sub">Level ${esc(b.level)} ${esc(b.ascendancy || b.cls)}${b.league ? ` · ${esc(b.league)}` : ''}${b.mainSkill ? ` · ${esc(b.mainSkill)}` : ''}</div>
        </div>
        <div class="actions">
          <button data-action="duplicate" class="btn">Duplicate</button>
          <button data-action="export-one" class="btn">Export</button>
          <button data-action="delete-build" class="btn btn-danger">Delete</button>
        </div>
      </div>
      <nav class="tabs">
        ${TABS.map((t) => `<button class="tab ${t === state.tab ? 'active' : ''}" data-action="tab" data-tab="${t}">${t}${tabCount(b, t)}</button>`).join('')}
      </nav>
      <section>${tabBody(b)}</section>`;
  }

  function tabCount(b, tab) {
    if (tab === 'Skills' && b.skills.length) return ` (${b.skills.length})`;
    if (tab === 'Goals' && b.goals.length) return ` (${b.goals.filter((g) => g.done).length}/${b.goals.length})`;
    if (tab === 'Progress' && b.snapshots.length) return ` (${b.snapshots.length})`;
    return '';
  }

  function field(label, path, value, { type = 'text', placeholder = '', attrs = '' } = {}) {
    return `<label class="field"><span>${esc(label)}</span>
      <input class="input" type="${type}" data-bind="${esc(path)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}></label>`;
  }

  function textarea(label, path, value, placeholder = '') {
    return `<label class="field"><span>${esc(label)}</span>
      <textarea data-bind="${esc(path)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }

  function select(label, path, value, options, extra = '') {
    return `<label class="field"><span>${esc(label)}</span>
      <select data-bind="${esc(path)}" ${extra}>
        ${options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select></label>`;
  }

  function link(url, text) {
    return /^https?:\/\//i.test(url || '')
      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`
      : '';
  }

  function renderOverview(b) {
    const doneGoals = b.goals.filter((g) => g.done).length;
    const latest = b.snapshots[b.snapshots.length - 1];
    return `
      <div class="card">
        <h3>Character</h3>
        <div class="grid">
          ${field('Build name', 'name', b.name, { attrs: 'data-rerender="header"' })}
          ${select('Class', 'cls', b.cls, Object.keys(classes), 'data-rerender="all"')}
          ${field('Ascendancy', 'ascendancy', b.ascendancy, { placeholder: 'Pick or type…', attrs: 'list="ascendancy-options" data-rerender="header"' })}
          ${field('Level', 'level', b.level, { type: 'number', attrs: 'min="1" max="100" data-rerender="header"' })}
          ${field('League', 'league', b.league, { placeholder: 'e.g. Standard, HC…', attrs: 'data-rerender="header"' })}
          ${select('Status', 'status', b.status, statuses, 'data-rerender="sidebar"')}
          ${field('Main skill', 'mainSkill', b.mainSkill, { placeholder: 'e.g. Lightning Arrow', attrs: 'data-rerender="header"' })}
        </div>
      </div>

      <div class="card">
        <h3>Links</h3>
        <div class="grid-2">
          <div>${field('Passive tree URL', 'treeUrl', b.treeUrl, { type: 'url', placeholder: 'https://…' })}
            <div class="hint">${link(b.treeUrl, 'Open passive tree')}</div></div>
          <div>${field('Guide / video URL', 'guideUrl', b.guideUrl, { type: 'url', placeholder: 'https://…' })}
            <div class="hint">${link(b.guideUrl, 'Open guide')}</div></div>
        </div>
        <div style="margin-top:12px">${textarea('Path of Building code', 'pobCode', b.pobCode, 'Paste your PoB2 export code here')}</div>
        <div class="row" style="margin-top:6px">
          <button class="btn btn-sm" data-action="copy-pob">Copy PoB code</button>
        </div>
      </div>

      <div class="card">
        <h3>Snapshot</h3>
        <div class="stat-tiles">
          <div class="stat-tile"><div class="label">Skills tracked</div><div class="value">${b.skills.length}</div></div>
          <div class="stat-tile"><div class="label">Gear slots filled</div><div class="value">${gearSlots.filter((s) => b.gear[s]?.name).length}/${gearSlots.length}</div></div>
          <div class="stat-tile"><div class="label">Goals done</div><div class="value">${doneGoals}/${b.goals.length}</div></div>
          <div class="stat-tile"><div class="label">Latest life</div><div class="value">${fmtNum(latest?.life)}</div></div>
          <div class="stat-tile"><div class="label">Latest DPS</div><div class="value">${fmtNum(latest?.dps)}</div></div>
        </div>
      </div>

      <div class="card">
        ${textarea('Notes', 'notes', b.notes, 'Leveling plan, bossing tips, things to remember…')}
      </div>`;
  }

  function renderSkills(b) {
    const cards = b.skills.map((s, i) => `
      <div class="card">
        <div class="row">
          <input class="input grow" data-bind="skills.${i}.name" value="${esc(s.name)}" placeholder="Skill gem name">
          <label class="muted">Lv</label><input class="input input-sm" type="number" min="1" max="40" data-bind="skills.${i}.level" value="${esc(s.level)}">
          <label class="muted">Q%</label><input class="input input-sm" type="number" min="0" max="23" data-bind="skills.${i}.quality" value="${esc(s.quality)}">
          <button class="btn-icon" title="Move up" data-action="move-skill" data-index="${i}" data-dir="-1">↑</button>
          <button class="btn-icon" title="Move down" data-action="move-skill" data-index="${i}" data-dir="1">↓</button>
          <button class="btn-icon" title="Remove skill" data-action="remove-skill" data-index="${i}">✕</button>
        </div>
        <div class="supports">
          ${s.supports.map((sup, j) => `
            <div class="row">
              <span class="muted">↳</span>
              <input class="input grow" data-bind="skills.${i}.supports.${j}" value="${esc(sup)}" placeholder="Support gem">
              <button class="btn-icon" title="Remove support" data-action="remove-support" data-index="${i}" data-sub="${j}">✕</button>
            </div>`).join('')}
          <div class="row">
            <button class="btn btn-sm" data-action="add-support" data-index="${i}" ${s.supports.length >= 5 ? 'disabled' : ''}>+ Support (${s.supports.length}/5)</button>
          </div>
        </div>
        <div style="margin-top:8px">
          <input class="input" data-bind="skills.${i}.note" value="${esc(s.note)}" placeholder="Note (e.g. weapon swap, aura, 5-link target)">
        </div>
      </div>`).join('');

    return `
      ${cards || '<p class="muted">No skills yet. Add your skill gems and their supports.</p>'}
      <button class="btn btn-primary" data-action="add-skill">+ Add skill gem</button>`;
  }

  function renderGear(b) {
    return `
      <div class="grid-2">
        ${gearSlots.map((slot) => {
          const g = b.gear[slot] || {};
          const p = `gear.${slot}`;
          return `
            <div class="card">
              <div class="card-head"><h3 style="margin:0">${esc(slot)}</h3>
                <select data-bind="${esc(p)}.rarity" style="width:auto">
                  ${['', 'Normal', 'Magic', 'Rare', 'Unique'].map((r) => `<option value="${r}" ${r === (g.rarity || '') ? 'selected' : ''}>${r || 'Rarity'}</option>`).join('')}
                </select>
              </div>
              <input class="input" data-bind="${esc(p)}.name" value="${esc(g.name)}" placeholder="Item name / base">
              <div style="margin-top:8px"><textarea data-bind="${esc(p)}.mods" placeholder="Mods">${esc(g.mods)}</textarea></div>
              <div style="margin-top:8px"><input class="input" data-bind="${esc(p)}.upgrade" value="${esc(g.upgrade)}" placeholder="Upgrade target (e.g. +2 proj, 30% move speed)"></div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function renderGoals(b) {
    const done = b.goals.filter((g) => g.done).length;
    const pct = b.goals.length ? Math.round((done / b.goals.length) * 100) : 0;
    return `
      <div class="card">
        <div class="card-head"><h3 style="margin:0">Goals & upgrades</h3><span class="muted">${done}/${b.goals.length} · ${pct}%</span></div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        ${b.goals.map((g, i) => `
          <div class="goal ${g.done ? 'done' : ''}">
            <input type="checkbox" data-action="toggle-goal" data-index="${i}" ${g.done ? 'checked' : ''}>
            <input class="input grow goal-text" data-bind="goals.${i}.text" value="${esc(g.text)}" placeholder="Goal">
            <input class="input" style="width:140px" data-bind="goals.${i}.cost" value="${esc(g.cost)}" placeholder="Cost (e.g. 3 div)">
            <button class="btn-icon" title="Remove goal" data-action="remove-goal" data-index="${i}">✕</button>
          </div>`).join('') || '<p class="muted">No goals yet.</p>'}
        <form class="row" data-form="add-goal" style="margin-top:12px">
          <input class="input grow" name="text" placeholder="New goal, e.g. Cap resistances, Kill Arbiter of Ash" required>
          <input class="input" style="width:140px" name="cost" placeholder="Cost">
          <button class="btn btn-primary">Add</button>
        </form>
        ${done ? '<div class="row" style="margin-top:8px"><button class="btn btn-sm" data-action="clear-done-goals">Clear completed</button></div>' : ''}
      </div>`;
  }

  const isRes = (key) => ['fire', 'cold', 'lightning', 'chaos'].includes(key);
  const hasValue = (v) => v !== '' && v != null;

  function resClass(key, value) {
    if (!isRes(key) || !hasValue(value)) return '';
    if (Number(value) >= RES_CAP) return 'res-capped';
    return Number(value) < 0 ? 'res-low' : '';
  }

  function renderProgress(b) {
    const snaps = b.snapshots;
    const latest = snaps[snaps.length - 1] || {};
    const prev = snaps[snaps.length - 2];

    const tiles = snapshotFields.map(({ key, label }) => {
      const v = latest[key];
      let delta = '';
      if (prev && v !== '' && v != null && prev[key] !== '' && prev[key] != null) {
        const d = Number(v) - Number(prev[key]);
        if (d) delta = `<div class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d.toLocaleString()}</div>`;
      }
      return `<div class="stat-tile"><div class="label">${esc(label)}</div>
        <div class="value ${resClass(key, v)}">${fmtNum(v)}${isRes(key) && hasValue(v) ? '%' : ''}</div>${delta}</div>`;
    }).join('');

    const formFields = snapshotFields.map(({ key, label }) => `
      <label class="field"><span>${esc(label)}</span>
        <input class="input" type="number" name="${key}" value="${esc(key === 'level' ? b.level : latest[key] ?? '')}"></label>`).join('');

    return `
      <div class="card">
        <h3>Latest stats</h3>
        ${snaps.length ? `<div class="stat-tiles">${tiles}</div>` : '<p class="muted">Record a snapshot to start tracking how your character grows.</p>'}
      </div>

      ${snaps.length > 1 ? `
        <div class="card">
          <div class="chart-controls">
            <h3 style="margin:0">Over time</h3>
            <select data-action="chart-field">
              ${snapshotFields.map(({ key, label }) => `<option value="${key}" ${key === state.chartField ? 'selected' : ''}>${esc(label)}</option>`).join('')}
            </select>
          </div>
          ${renderChart(snaps, state.chartField)}
        </div>` : ''}

      <div class="card">
        <h3>Record snapshot</h3>
        <form data-form="add-snapshot">
          <div class="grid">
            <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${today()}"></label>
            ${formFields}
          </div>
          <div class="grid" style="margin-top:12px"><label class="field" style="grid-column:1/-1"><span>Note</span>
            <input class="input" name="note" placeholder="What changed? e.g. New bow, respecced into crit"></label></div>
          <div class="row" style="margin-top:12px"><button class="btn btn-primary">Save snapshot</button>
            <span class="hint">Pre-filled from your last snapshot. Saving also updates the build's level.</span></div>
        </form>
      </div>

      ${snaps.length ? `
        <div class="card">
          <h3>History</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Date</th>${snapshotFields.map((f) => `<th>${esc(f.label)}</th>`).join('')}<th>Note</th><th></th></tr></thead>
            <tbody>
              ${[...snaps].map((s, i) => ({ s, i })).reverse().map(({ s, i }) => `
                <tr><td>${esc(s.date)}</td>
                  ${snapshotFields.map(({ key }) => `<td class="${resClass(key, s[key])}">${fmtNum(s[key])}</td>`).join('')}
                  <td class="muted">${esc(s.note)}</td>
                  <td><button class="btn-icon" title="Delete snapshot" data-action="remove-snapshot" data-index="${i}">✕</button></td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>` : ''}`;
  }

  function renderChart(snaps, key) {
    const points = snaps
      .map((s, i) => ({ i, v: s[key], date: s.date }))
      .filter((p) => p.v !== '' && p.v != null && !Number.isNaN(Number(p.v)))
      .map((p) => ({ ...p, v: Number(p.v) }));
    if (points.length < 2) return '<p class="muted">Not enough data for this stat yet.</p>';

    const W = 600, H = 180, pad = { l: 50, r: 12, t: 12, b: 24 };
    const vals = points.map((p) => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const x = (idx) => pad.l + (idx / (points.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
    const path = points.map((p, idx) => `${idx ? 'L' : 'M'}${x(idx).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(key)} over time">
        <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(max)}" y2="${y(max)}" stroke="var(--border)" />
        <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(min)}" y2="${y(min)}" stroke="var(--border)" />
        <text x="${pad.l - 6}" y="${y(max) + 4}" fill="var(--muted)" font-size="11" text-anchor="end">${esc(max.toLocaleString())}</text>
        <text x="${pad.l - 6}" y="${y(min) + 4}" fill="var(--muted)" font-size="11" text-anchor="end">${esc(min.toLocaleString())}</text>
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
        ${points.map((p, idx) => `<circle cx="${x(idx)}" cy="${y(p.v)}" r="3" fill="var(--accent)"><title>${esc(p.date)}: ${esc(p.v.toLocaleString())}</title></circle>`).join('')}
        <text x="${pad.l}" y="${H - 6}" fill="var(--muted)" font-size="11">${esc(points[0].date)}</text>
        <text x="${W - pad.r}" y="${H - 6}" fill="var(--muted)" font-size="11" text-anchor="end">${esc(points[points.length - 1].date)}</text>
      </svg>`;
  }

  // ---------- actions ----------

  function touch(b) { b.updated = Date.now(); }

  function selectBuild(id) {
    state.selectedId = id;
    render();
  }

  const actions = {
    'new-build'() {
      const b = newBuild();
      state.builds.push(b);
      state.tab = 'Overview';
      selectBuild(b.id);
      $('#main input[data-bind="name"]')?.select();
    },
    select(el) { selectBuild(el.dataset.id); },
    tab(el) { state.tab = el.dataset.tab; render(); },
    duplicate(_, b) {
      const copy = normalize(JSON.parse(JSON.stringify(b)));
      copy.id = uid();
      copy.name = `${b.name} (copy)`;
      copy.created = copy.updated = Date.now();
      state.builds.push(copy);
      selectBuild(copy.id);
    },
    'delete-build'(_, b) {
      if (!confirm(`Delete "${b.name}"? This cannot be undone (export it first if you want a backup).`)) return;
      state.builds = state.builds.filter((x) => x.id !== b.id);
      state.selectedId = state.builds[0]?.id ?? null;
      render();
    },
    'export-one'(_, b) { download(`poe2-${slug(b.name)}.json`, { version: 1, builds: [b] }); },
    'export-all'() { download(`poe2-builds-${today()}.json`, { version: 1, builds: state.builds }); },
    'copy-pob'(el, b) {
      if (!b.pobCode) return;
      navigator.clipboard?.writeText(b.pobCode).then(() => {
        el.textContent = 'Copied!';
        setTimeout(() => { el.textContent = 'Copy PoB code'; }, 1200);
      });
    },

    'add-skill'(_, b) { b.skills.push({ id: uid(), name: '', level: 1, quality: 0, supports: [], note: '' }); },
    'remove-skill'(el, b) { b.skills.splice(+el.dataset.index, 1); },
    'move-skill'(el, b) {
      const i = +el.dataset.index, j = i + +el.dataset.dir;
      if (j < 0 || j >= b.skills.length) return;
      [b.skills[i], b.skills[j]] = [b.skills[j], b.skills[i]];
    },
    'add-support'(el, b) {
      const s = b.skills[+el.dataset.index];
      if (s.supports.length < 5) s.supports.push('');
    },
    'remove-support'(el, b) { b.skills[+el.dataset.index].supports.splice(+el.dataset.sub, 1); },

    'toggle-goal'(el, b) { const g = b.goals[+el.dataset.index]; g.done = !g.done; },
    'remove-goal'(el, b) { b.goals.splice(+el.dataset.index, 1); },
    'clear-done-goals'(_, b) { b.goals = b.goals.filter((g) => !g.done); },

    'remove-snapshot'(el, b) {
      if (confirm('Delete this snapshot?')) b.snapshots.splice(+el.dataset.index, 1);
    },
  };

  // Actions that only change UI state or handle their own rendering.
  const NO_RERENDER = new Set(['new-build', 'select', 'tab', 'duplicate', 'delete-build', 'export-one', 'export-all', 'copy-pob']);

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const name = el.dataset.action;
    const fn = actions[name];
    if (!fn) return;
    const b = current();
    fn(el, b);
    if (!NO_RERENDER.has(name) && b) {
      touch(b);
      render();
    }
  });

  // Two-way binding: inputs with data-bind write straight into the current build.
  // We avoid re-rendering the whole tab on every keystroke so focus isn't lost.
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'build-filter') {
      state.filter = el.value;
      renderSidebar();
      return;
    }
    const path = el.dataset?.bind;
    const b = current();
    if (!path || !b) return;

    let value = el.value;
    if (el.type === 'number') value = value === '' ? '' : Number(value);
    setPath(b, path, value);
    touch(b);
    save();

    const mode = el.dataset.rerender;
    if (mode === 'all') render();
    else if (mode === 'header' || mode === 'sidebar') {
      renderSidebar();
      const sub = $('.build-header .sub');
      const title = $('.build-header h2');
      if (title) title.textContent = b.name || 'Untitled';
      if (sub) sub.textContent = `Level ${b.level} ${b.ascendancy || b.cls}${b.league ? ` · ${b.league}` : ''}${b.mainSkill ? ` · ${b.mainSkill}` : ''}`;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset?.action === 'chart-field') {
      state.chartField = el.value;
      render();
    } else if (el.dataset?.bind === 'treeUrl' || el.dataset?.bind === 'guideUrl') {
      render(); // refresh the "open" links
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    const b = current();
    if (!kind || !b) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (kind === 'add-goal') {
      if (!data.text.trim()) return;
      b.goals.push({ id: uid(), text: data.text.trim(), cost: data.cost.trim(), done: false });
    } else if (kind === 'add-snapshot') {
      const snap = { id: uid(), date: data.date || today(), note: data.note || '' };
      snapshotFields.forEach(({ key }) => { snap[key] = data[key] === '' ? '' : Number(data[key]); });
      b.snapshots.push(snap);
      b.snapshots.sort((x, y) => String(x.date).localeCompare(String(y.date)));
      if (snap.level !== '') b.level = snap.level;
    }
    touch(b);
    render();
    if (kind === 'add-goal') $('[data-form="add-goal"] input[name="text"]')?.focus();
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.builds;
      if (!Array.isArray(incoming)) throw new Error('No builds found in file');
      const existing = new Set(state.builds.map((b) => b.id));
      const imported = incoming.map((raw) => {
        const b = normalize(raw);
        if (existing.has(b.id)) b.id = uid(); // never overwrite an existing build
        return b;
      });
      state.builds.push(...imported);
      state.selectedId = imported[0]?.id ?? state.selectedId;
      render();
      alert(`Imported ${imported.length} build${imported.length === 1 ? '' : 's'}.`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  });

  if (!current()) state.selectedId = state.builds[0]?.id ?? null;
  render();
})();
