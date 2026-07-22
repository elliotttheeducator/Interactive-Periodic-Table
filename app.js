'use strict';

// ---------- Grid model ----------
const GRID = {};
for (const e of ELEMENTS) {
  if (e.group) {
    GRID[e.period] = GRID[e.period] || {};
    GRID[e.period][e.group] = e;
  }
}
const LANTHANIDES = ELEMENTS.filter(e => e.category === 'lanthanide').sort((a, b) => a.z - b.z);
const ACTINIDES = ELEMENTS.filter(e => e.category === 'actinide').sort((a, b) => a.z - b.z);

const state = {
  z: 14, // default: Silicon
  transitionMetalsOn: false,
};

function isActive(e) {
  return !TRANSITION_CATEGORIES.has(e.category) || state.transitionMetalsOn;
}

function parseMassNumber(massStr) {
  const clean = massStr.replace('(', '').replace(')', '');
  return Math.round(parseFloat(clean));
}

// ---------- Movement (pure; reads state, does not mutate) ----------
function moveHorizontal(dir) {
  const cur = ELEMENTS_BY_Z[state.z];

  if (cur.category === 'lanthanide' || cur.category === 'actinide') {
    const arr = cur.category === 'lanthanide' ? LANTHANIDES : ACTINIDES;
    const idx = arr.findIndex(e => e.z === cur.z);
    const newIdx = idx + dir;
    const parentPeriod = cur.category === 'lanthanide' ? 6 : 7;
    if (newIdx >= 0 && newIdx < arr.length) return arr[newIdx].z;
    if (newIdx < 0) return GRID[parentPeriod][3].z;
    return GRID[parentPeriod][4].z;
  }

  const hasFooter = (cur.period === 6 || cur.period === 7);
  if (state.transitionMetalsOn && hasFooter) {
    if (cur.group === 3 && dir === 1) {
      return (cur.period === 6 ? LANTHANIDES : ACTINIDES)[0].z;
    }
    if (cur.group === 4 && dir === -1) {
      const arr = cur.period === 6 ? LANTHANIDES : ACTINIDES;
      return arr[arr.length - 1].z;
    }
  }

  let g = cur.group + dir;
  while (g >= 1 && g <= 18) {
    const cell = GRID[cur.period] && GRID[cur.period][g];
    if (!cell || !isActive(cell)) { g += dir; continue; }
    return cell.z;
  }
  return null;
}

function moveVertical(dir) {
  const cur = ELEMENTS_BY_Z[state.z];

  if (cur.category === 'lanthanide' || cur.category === 'actinide') {
    const arr = cur.category === 'lanthanide' ? LANTHANIDES : ACTINIDES;
    const idx = arr.findIndex(e => e.z === cur.z);
    if (cur.category === 'lanthanide' && dir === 1) return ACTINIDES[idx].z;
    if (cur.category === 'actinide' && dir === -1) return LANTHANIDES[idx].z;
    return null;
  }

  const newPeriod = cur.period + dir;
  const cell = GRID[newPeriod] && GRID[newPeriod][cur.group];
  if (!cell || !isActive(cell)) return null;
  return cell.z;
}

// ---------- Rendering: periodic table ----------
const gridEl = document.getElementById('periodic-grid');

function buildGrid() {
  gridEl.innerHTML = '';
  for (const e of ELEMENTS) {
    if (!e.group) continue; // f-block handled separately
    const tile = makeTile(e, e.period, e.group);
    gridEl.appendChild(tile);
  }
  [LANTHANIDES, ACTINIDES].forEach((arr, seriesIdx) => {
    const row = 9 + seriesIdx;
    arr.forEach((e, i) => {
      const tile = makeTile(e, row, i + 4);
      gridEl.appendChild(tile);
    });
  });
  refreshGrid();
}

function makeTile(e, row, col) {
  const btn = document.createElement('button');
  btn.className = 'tile';
  btn.dataset.z = e.z;
  btn.style.gridRow = row;
  btn.style.gridColumn = col;
  btn.style.setProperty('--tile-color', CATEGORY_META[e.category].color);
  btn.innerHTML = `
    <span class="tile-z">${e.z}</span>
    <span class="tile-symbol">${e.symbol}</span>
    <span class="tile-mass">${e.mass}</span>
  `;
  btn.addEventListener('click', () => trySelect(e.z));
  return btn;
}

function refreshGrid() {
  for (const btn of gridEl.children) {
    const e = ELEMENTS_BY_Z[btn.dataset.z];
    const active = isActive(e);
    btn.classList.toggle('inactive', !active);
    btn.classList.toggle('current', Number(btn.dataset.z) === state.z);
  }
}

function trySelect(z) {
  const e = ELEMENTS_BY_Z[z];
  if (!isActive(e)) return;
  goTo(z, null);
}

// ---------- Move + toast orchestration ----------
function attemptMove(axis, dir) {
  const nextZ = axis === 'h' ? moveHorizontal(dir) : moveVertical(dir);
  if (nextZ === null) return;
  goTo(nextZ, { axis, dir });
}

function goTo(nextZ, moveInfo) {
  const prevZ = state.z;
  state.z = nextZ;
  refreshGrid();
  renderInfoPanel(nextZ);
  renderBohr(nextZ);
  updateDpad();
  if (moveInfo) showMoveToast(prevZ, nextZ, moveInfo);
}

// ---------- Info panel ----------
function renderInfoPanel(z) {
  const e = ELEMENTS_BY_Z[z];
  const shells = shellConfig(z);
  const meta = CATEGORY_META[e.category];
  const panel = document.getElementById('info-panel');
  panel.style.setProperty('--accent', meta.color);
  panel.innerHTML = `
    <div class="info-header">
      <div class="info-symbol">${e.symbol}</div>
      <div class="info-titles">
        <div class="info-name">${e.name}</div>
        <div class="info-category">${meta.label}</div>
      </div>
    </div>
    <dl class="info-facts">
      <div><dt>Atomic number</dt><dd>${e.z}</dd></div>
      <div><dt>Mass number</dt><dd>${e.mass}</dd></div>
      <div><dt>Electrons</dt><dd>${shells.join(', ')} (shells)</dd></div>
      <div><dt>Metallic character</dt><dd>${metallicCharacter(e.category)}</dd></div>
      <div><dt>Reactivity</dt><dd>${reactivityLabel(e.category)}</dd></div>
      <div><dt>Electronegativity</dt><dd>${e.en !== null ? e.en.toFixed(2) : '—'}</dd></div>
    </dl>
  `;
}

// ---------- Bohr model (SVG) ----------
const SVG_NS = 'http://www.w3.org/2000/svg';
const bohrSvg = document.getElementById('bohr-svg');
const VIEW = 440;
const CENTER = VIEW / 2;

function spiralPoints(n, maxRadius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = maxRadius * Math.sqrt((i + 0.5) / n);
    const theta = i * golden;
    pts.push([CENTER + r * Math.cos(theta), CENTER + r * Math.sin(theta)]);
  }
  return pts;
}

function renderBohr(z) {
  const e = ELEMENTS_BY_Z[z];
  const shells = shellConfig(z);
  const protons = e.z;
  const neutrons = parseMassNumber(e.mass) - protons;
  const total = protons + neutrons;

  let html = '';

  // Nucleus
  const nucleusRadius = 26;
  if (total <= 40) {
    const order = [];
    let pCount = 0, nCount = 0;
    while (pCount < protons || nCount < neutrons) {
      if (pCount / Math.max(protons, 1) <= nCount / Math.max(neutrons, 1) && pCount < protons) {
        order.push('p'); pCount++;
      } else if (nCount < neutrons) {
        order.push('n'); nCount++;
      } else if (pCount < protons) {
        order.push('p'); pCount++;
      }
    }
    const pts = spiralPoints(order.length, nucleusRadius);
    order.forEach((kind, i) => {
      const [x, y] = pts[i];
      html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" class="nucleon ${kind === 'p' ? 'proton' : 'neutron'}" data-kind="${kind}"></circle>`;
    });
  } else {
    const r = Math.min(40, nucleusRadius + Math.sqrt(total) * 0.6);
    html += `<circle cx="${CENTER}" cy="${CENTER}" r="${r}" class="nucleus-blob"></circle>`;
    html += `<text x="${CENTER}" y="${CENTER - 4}" class="nucleus-label proton">${protons}p</text>`;
    html += `<text x="${CENTER}" y="${CENTER + 12}" class="nucleus-label neutron">${neutrons}n</text>`;
  }

  // Shells + electrons
  const ringGap = 34;
  shells.forEach((count, i) => {
    const radius = nucleusRadius + ringGap * (i + 1.6);
    html += `<circle cx="${CENTER}" cy="${CENTER}" r="${radius}" class="shell-ring" data-shell="${i + 1}"></circle>`;
    let dots = '';
    for (let k = 0; k < count; k++) {
      const angle = (2 * Math.PI * k) / count;
      const x = (radius * Math.cos(angle)).toFixed(1);
      const y = (radius * Math.sin(angle)).toFixed(1);
      dots += `<circle cx="${x}" cy="${y}" r="4.6" class="electron" data-shell="${i + 1}"></circle>`;
    }
    const dur = (10 + i * 4).toFixed(1);
    const dir = i % 2 === 0 ? 1 : -1;
    html += `<g class="electron-group" style="transform-origin:${CENTER}px ${CENTER}px; animation-duration:${dur}s; animation-direction:${dir === 1 ? 'normal' : 'reverse'}">${dots}</g>`;
  });

  bohrSvg.innerHTML = html;
}

// ---------- D-pad ----------
const dpadCurrent = document.getElementById('dpad-current');
function updateDpad() {
  const e = ELEMENTS_BY_Z[state.z];
  dpadCurrent.textContent = e.symbol;
  document.querySelectorAll('.dpad button[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;
    let enabled;
    if (dir === 'up') enabled = moveVertical(-1) !== null;
    else if (dir === 'down') enabled = moveVertical(1) !== null;
    else if (dir === 'left') enabled = moveHorizontal(-1) !== null;
    else enabled = moveHorizontal(1) !== null;
    btn.disabled = !enabled;
  });
}

document.querySelectorAll('.dpad button[data-dir]').forEach(btn => {
  btn.addEventListener('click', () => {
    const dir = btn.dataset.dir;
    if (dir === 'up') attemptMove('v', -1);
    else if (dir === 'down') attemptMove('v', 1);
    else if (dir === 'left') attemptMove('h', -1);
    else attemptMove('h', 1);
  });
});

document.addEventListener('keydown', (ev) => {
  const map = { ArrowUp: ['v', -1], ArrowDown: ['v', 1], ArrowLeft: ['h', -1], ArrowRight: ['h', 1] };
  if (map[ev.key]) {
    ev.preventDefault();
    attemptMove(...map[ev.key]);
  }
});

// ---------- Toasts ----------
const toastContainer = document.getElementById('toast-container');

function showMoveToast(prevZ, nextZ, { axis, dir }) {
  const prev = ELEMENTS_BY_Z[prevZ], next = ELEMENTS_BY_Z[nextZ];
  const prevShells = shellConfig(prevZ), nextShells = shellConfig(nextZ);
  const prevNeutrons = parseMassNumber(prev.mass) - prev.z;
  const nextNeutrons = parseMassNumber(next.mass) - next.z;
  const dP = next.z - prev.z;
  const dN = nextNeutrons - prevNeutrons;
  const dShell = nextShells.length - prevShells.length;

  let headline, trend;
  if (axis === 'v') {
    if (dir === 1) {
      headline = '↓ Down a group';
      trend = 'Atomic radius increases — the outer electron sits in a new shell, farther from the nucleus and held more loosely.';
    } else {
      headline = '↑ Up a group';
      trend = 'Atomic radius decreases — a shell is removed, so the outer electron sits closer to the nucleus.';
    }
  } else {
    if (dir === 1) {
      headline = '→ Right across a period';
      trend = 'Atomic radius decreases — same shells, but extra nuclear charge pulls electrons in tighter.';
    } else {
      headline = '← Left across a period';
      trend = 'Atomic radius increases — less nuclear charge, weaker pull on the same shells.';
    }
  }

  const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);
  let extra = '';
  const prevMetal = metallicCharacter(prev.category), nextMetal = metallicCharacter(next.category);
  if (prevMetal !== nextMetal) {
    extra = `<div class="toast-extra">Crossed from ${prevMetal} → ${nextMetal} character.</div>`;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-headline">${headline}: <strong>${prev.symbol} → ${next.symbol}</strong></div>
    <div class="toast-stats">Protons ${fmt(dP)} &middot; Neutrons ${fmt(dN)} &middot; Electrons ${fmt(dP)} &middot; Shells ${prevShells.length}→${nextShells.length}</div>
    <div class="toast-trend">${trend}</div>
    ${extra}
  `;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

// ---------- Component popups ----------
const POPUP_INFO = {
  proton: { title: 'Proton', body: 'Positively charged particle in the nucleus. The number of protons is the atomic number — it defines which element this is.' },
  neutron: { title: 'Neutron', body: 'Neutral particle in the nucleus, adds mass without charge. Same-element atoms with different neutron counts are isotopes.' },
  electron: { title: 'Electron', body: 'Negatively charged particle orbiting the nucleus in shells. Outer ("valence") electrons are what determine reactivity and bonding.' },
  shell: { title: 'Shell', body: 'An energy level electrons occupy around the nucleus. Shells fill from the inside out; the outer shell\'s fullness drives reactivity.' },
};

const popupEl = document.getElementById('popup');

function showPopup(kind, x, y) {
  const info = POPUP_INFO[kind];
  if (!info) return;
  popupEl.innerHTML = `<strong>${info.title}</strong><p>${info.body}</p>`;
  popupEl.classList.remove('hidden');
  const rect = document.body.getBoundingClientRect();
  popupEl.style.left = Math.min(x, rect.width - 260) + 'px';
  popupEl.style.top = y + 'px';
}

document.querySelectorAll('.legend-chip[data-kind]').forEach(chip => {
  chip.addEventListener('click', (ev) => {
    showPopup(chip.dataset.kind, ev.clientX, ev.clientY + 16);
  });
});

bohrSvg.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.classList.contains('proton')) showPopup('proton', ev.clientX, ev.clientY + 16);
  else if (t.classList.contains('neutron')) showPopup('neutron', ev.clientX, ev.clientY + 16);
  else if (t.classList.contains('electron')) showPopup('electron', ev.clientX, ev.clientY + 16);
  else if (t.classList.contains('shell-ring')) showPopup('shell', ev.clientX, ev.clientY + 16);
});

document.addEventListener('click', (ev) => {
  if (!popupEl.contains(ev.target) && !ev.target.closest('.legend-chip') && !ev.target.closest('#bohr-svg')) {
    popupEl.classList.add('hidden');
  }
});

// ---------- Transition metals toggle ----------
const tmToggle = document.getElementById('tm-toggle');
tmToggle.addEventListener('change', () => {
  state.transitionMetalsOn = tmToggle.checked;
  const cur = ELEMENTS_BY_Z[state.z];
  if (!isActive(cur)) {
    const parentPeriod = cur.group ? cur.period : (cur.category === 'lanthanide' ? 6 : 7);
    const fallback = GRID[parentPeriod][2];
    state.z = fallback.z;
    renderInfoPanel(state.z);
    renderBohr(state.z);
  }
  refreshGrid();
  updateDpad();
});

// ---------- Init ----------
buildGrid();
renderInfoPanel(state.z);
renderBohr(state.z);
updateDpad();
