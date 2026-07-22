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
  renderSubshells(nextZ);
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
const NUCLEUS_K = 8.6; // nucleusRadius = NUCLEUS_K * cbrt(nucleon count), echoing the real R ~ A^(1/3) nuclear radius law
const RING_GAP = 34;
const BLOB_THRESHOLD = 44; // above this many nucleons, switch to a labeled blob instead of individual dots

let atomGroup = null;    // persistent <g>, scaled to reflect relative atomic radius
let nucleusGroup = null; // persistent <g> holding nucleon dots or the large-atom blob
let nucleusMode = null;  // 'dots' | 'blob'
let shellStates = [];    // per shell index: { ringEl, groupEl } | null

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function ensureSkeleton() {
  if (atomGroup) return;
  atomGroup = svgEl('g', { class: 'atom-scale' });
  nucleusGroup = svgEl('g', { class: 'nucleus-group' });
  atomGroup.appendChild(nucleusGroup);
  bohrSvg.appendChild(atomGroup);
}

// Smoothly reconciles the circles in `container` matching `filterClass` with `positions`:
// existing ones transition to their new spot, extras fade out, missing ones fade in.
function syncCircles(container, filterClass, positions, r, createClass) {
  createClass = createClass || filterClass;
  let els = Array.from(container.children).filter(el => el.classList.contains(filterClass));
  while (els.length > positions.length) {
    const el = els.pop();
    el.style.opacity = '0';
    el.style.r = '0px';
    setTimeout(() => el.remove(), 500);
  }
  els.forEach((el, i) => {
    el.style.cx = `${positions[i].x}px`;
    el.style.cy = `${positions[i].y}px`;
  });
  for (let i = els.length; i < positions.length; i++) {
    const el = svgEl('circle', { class: createClass, r: 0 });
    el.style.cx = `${positions[i].x}px`;
    el.style.cy = `${positions[i].y}px`;
    el.style.r = '0px';
    el.style.opacity = '0';
    el.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s`;
    container.appendChild(el);
    void el.getBoundingClientRect(); // force layout flush so the 0-state actually paints first
    el.style.r = `${r}px`;
    el.style.opacity = '1';
    els.push(el);
  }
  return els;
}

function spiralPoints(n, maxRadius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const rr = maxRadius * Math.sqrt((i + 0.5) / n);
    const theta = i * golden;
    pts.push({ x: CENTER + rr * Math.cos(theta), y: CENTER + rr * Math.sin(theta) });
  }
  return pts;
}

function renderNucleus(protons, neutrons) {
  const total = protons + neutrons;
  const nucleusRadius = NUCLEUS_K * Math.cbrt(Math.max(total, 1));

  if (total <= BLOB_THRESHOLD) {
    if (nucleusMode !== 'dots') {
      nucleusGroup.innerHTML = '';
      nucleusMode = 'dots';
    }
    const order = [];
    let pCount = 0, nCount = 0;
    while (pCount < protons || nCount < neutrons) {
      if (pCount / Math.max(protons, 1) <= nCount / Math.max(neutrons, 1) && pCount < protons) {
        order.push('proton'); pCount++;
      } else if (nCount < neutrons) {
        order.push('neutron'); nCount++;
      } else if (pCount < protons) {
        order.push('proton'); pCount++;
      }
    }
    const pts = spiralPoints(order.length, nucleusRadius);
    const protonPts = pts.filter((_, i) => order[i] === 'proton');
    const neutronPts = pts.filter((_, i) => order[i] === 'neutron');
    syncCircles(nucleusGroup, 'proton', protonPts, 4.2, 'nucleon proton');
    syncCircles(nucleusGroup, 'neutron', neutronPts, 4.2, 'nucleon neutron');
  } else {
    if (nucleusMode !== 'blob') {
      nucleusGroup.innerHTML = '';
      nucleusGroup.appendChild(svgEl('circle', { class: 'nucleus-blob', cx: CENTER, cy: CENTER, r: 0 }));
      nucleusGroup.appendChild(svgEl('text', { class: 'nucleus-label proton', x: CENTER, y: CENTER - 4 }));
      nucleusGroup.appendChild(svgEl('text', { class: 'nucleus-label neutron', x: CENTER, y: CENTER + 12 }));
      nucleusMode = 'blob';
    }
    const r = Math.min(46, nucleusRadius);
    nucleusGroup.querySelector('.nucleus-blob').setAttribute('r', r);
    nucleusGroup.querySelector('.nucleus-label.proton').textContent = `${protons}p`;
    nucleusGroup.querySelector('.nucleus-label.neutron').textContent = `${neutrons}n`;
  }

  return nucleusRadius;
}

function renderShells(shells, nucleusRadius) {
  const rows = Math.max(shells.length, shellStates.length);
  for (let i = 0; i < rows; i++) {
    const count = shells[i] || 0;
    const existing = shellStates[i];

    if (count === 0) {
      if (existing) {
        existing.ringEl.style.opacity = '0';
        existing.groupEl.style.opacity = '0';
        setTimeout(() => { existing.ringEl.remove(); existing.groupEl.remove(); }, 500);
        shellStates[i] = null;
      }
      continue;
    }

    const radius = nucleusRadius + RING_GAP * (i + 1.6);

    if (!existing) {
      const ringEl = svgEl('circle', { class: 'shell-ring', cx: CENTER, cy: CENTER, r: 0, 'data-shell': i + 1 });
      ringEl.style.opacity = '0';
      const groupEl = svgEl('g', { class: 'electron-group' });
      groupEl.style.transformOrigin = `${CENTER}px ${CENTER}px`;
      groupEl.style.animationDuration = `${(10 + i * 4).toFixed(1)}s`;
      groupEl.style.animationDirection = i % 2 === 0 ? 'normal' : 'reverse';
      groupEl.style.opacity = '0';
      atomGroup.appendChild(ringEl);
      atomGroup.appendChild(groupEl);
      void ringEl.getBoundingClientRect();
      ringEl.style.opacity = '1';
      ringEl.setAttribute('r', radius);
      groupEl.style.opacity = '1';
      shellStates[i] = { ringEl, groupEl };
    } else {
      existing.ringEl.setAttribute('r', radius);
    }

    const electronPositions = [];
    for (let k = 0; k < count; k++) {
      const angle = (2 * Math.PI * k) / count;
      electronPositions.push({ x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) });
    }
    syncCircles(shellStates[i].groupEl, 'electron', electronPositions, 4.6);
  }
  shellStates.length = shells.length;
}

function renderBohr(z) {
  ensureSkeleton();
  const e = ELEMENTS_BY_Z[z];
  const shells = shellConfig(z);
  const protons = e.z;
  const neutrons = parseMassNumber(e.mass) - protons;

  const nucleusRadius = renderNucleus(protons, neutrons);
  renderShells(shells, nucleusRadius);

  atomGroup.style.transform = `scale(${atomicRadiusScale(z)})`;
}

// ---------- Subshell panel ----------
const subshellPanel = document.getElementById('subshell-panel');

function renderSubshells(z) {
  if (!state.transitionMetalsOn) {
    subshellPanel.innerHTML = '';
    return;
  }
  const filled = subshellBreakdown(z);
  subshellPanel.innerHTML = filled.map(({ n, l, count }) => `
    <div class="subshell-chip sub-${l}"><span>${n}${l}</span><span class="n-count">${count}</span></div>
  `).join('');
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

// ---------- Reactivity / octet prediction ----------
function octetPrediction(z) {
  const shells = shellConfig(z);
  const outer = shells[shells.length - 1];
  if (shells.length === 1) {
    return outer >= 2
      ? 'Outer shell is full — very stable, unlikely to react.'
      : 'Likely to share its electron (e.g. forming covalent bonds).';
  }
  if (outer === 8) return 'Outer shell is full — very stable, unlikely to react.';
  if (outer <= 3) return 'Likely to donate electrons to reach a stable outer shell (octet).';
  if (outer === 4) return 'Likely to share electrons (covalent bonding) to reach a stable outer shell.';
  return 'Likely to gain (steal) electrons to complete its outer shell (octet).';
}

// ---------- Comic-style change bursts (on the Bohr diagram) ----------
const fmtSigned = (n) => (n > 0 ? `+${n}` : `${n}`);

function addComicBurstEl(text, x, y, kind) {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('class', `comic-burst ${kind}`);
  el.textContent = text;
  bohrSvg.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function spawnComicBursts(prevZ, nextZ) {
  const prev = ELEMENTS_BY_Z[prevZ], next = ELEMENTS_BY_Z[nextZ];
  const prevShells = shellConfig(prevZ), nextShells = shellConfig(nextZ);
  const prevNeutrons = parseMassNumber(prev.mass) - prev.z;
  const nextNeutrons = parseMassNumber(next.mass) - next.z;
  const dP = next.z - prev.z;
  const dN = nextNeutrons - prevNeutrons;
  const dShell = nextShells.length - prevShells.length;
  const nextTotal = next.z + nextNeutrons;
  const nucleusRadius = NUCLEUS_K * Math.cbrt(Math.max(nextTotal, 1));
  const outerRadius = nucleusRadius + RING_GAP * (Math.max(nextShells.length, prevShells.length) + 1.6);

  // Spawn points sit clear of the nucleus/rings themselves (upper-left / lower-right of it)
  // so the burst text doesn't sit on top of the particles actually changing.
  const bursts = [];
  if (dP !== 0) bursts.push([`${fmtSigned(dP)} proton${Math.abs(dP) !== 1 ? 's' : ''}!`, CENTER - nucleusRadius - 30, CENTER - nucleusRadius - 14, 'proton', 0]);
  if (dN !== 0) bursts.push([`${fmtSigned(dN)} neutron${Math.abs(dN) !== 1 ? 's' : ''}!`, CENTER + nucleusRadius + 30, CENTER + nucleusRadius + 20, 'neutron', 180]);
  if (dP !== 0) bursts.push([`${fmtSigned(dP)} electron${Math.abs(dP) !== 1 ? 's' : ''}!`, CENTER, CENTER - outerRadius - 20, 'electron', 380]);
  if (dShell !== 0) bursts.push([dShell > 0 ? '+1 shell!' : '-1 shell!', CENTER, CENTER - outerRadius - 50, 'shell', 560]);

  bursts.forEach(([text, x, y, kind, delay]) => {
    setTimeout(() => addComicBurstEl(text, x, y, kind), delay);
  });
}

// ---------- Info toast (persists beside the atom until the next move) ----------
let activeToast = null;

// Where the atom's outer shell currently sits on screen, so the toast can dock just
// outside it -- for bigger (scaled-up) atoms that's further out, matching their real size.
function atomOuterEdgePx(z) {
  const svgRect = bohrSvg.getBoundingClientRect();
  const e = ELEMENTS_BY_Z[z];
  const shells = shellConfig(z);
  const total = e.z + (parseMassNumber(e.mass) - e.z);
  const nucleusRadius = NUCLEUS_K * Math.cbrt(Math.max(total, 1));
  const outerRadiusUnits = nucleusRadius + RING_GAP * (shells.length - 1 + 1.6);
  const pxPerUnit = svgRect.width / VIEW;
  const outerRadiusPx = outerRadiusUnits * atomicRadiusScale(z) * pxPerUnit;
  return {
    centerX: svgRect.left + svgRect.width / 2,
    centerY: svgRect.top + svgRect.height / 2,
    outerRadiusPx,
  };
}

function positionToastBesideAtom(toast, z) {
  const { centerX, centerY, outerRadiusPx } = atomOuterEdgePx(z);
  const toastWidth = 320;
  const gap = 18;
  const left = Math.max(16, centerX - outerRadiusPx - gap - toastWidth);
  const top = Math.max(16, Math.min(centerY - toast.offsetHeight / 2, window.innerHeight - toast.offsetHeight - 16));
  toast.style.left = `${left}px`;
  toast.style.top = `${top}px`;
}

function showMoveToast(prevZ, nextZ, { axis, dir }) {
  spawnComicBursts(prevZ, nextZ);

  const prev = ELEMENTS_BY_Z[prevZ], next = ELEMENTS_BY_Z[nextZ];
  const prevShells = shellConfig(prevZ), nextShells = shellConfig(nextZ);
  const prevNeutrons = parseMassNumber(prev.mass) - prev.z;
  const nextNeutrons = parseMassNumber(next.mass) - next.z;
  const dP = next.z - prev.z;
  const dN = nextNeutrons - prevNeutrons;

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

  let extra = '';
  const prevMetal = metallicCharacter(prev.category), nextMetal = metallicCharacter(next.category);
  if (prevMetal !== nextMetal) {
    extra = `<div class="toast-extra">Crossed from ${prevMetal} → ${nextMetal} character.</div>`;
  }

  if (activeToast) {
    const stale = activeToast;
    stale.style.transition = 'opacity 150ms ease';
    stale.style.opacity = '0';
    setTimeout(() => stale.remove(), 160);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-section">
      <div class="toast-label">Change</div>
      <div class="toast-headline">${headline}: <strong>${prev.symbol} → ${next.symbol}</strong></div>
      <div class="toast-stats">Protons ${fmtSigned(dP)} &middot; Neutrons ${fmtSigned(dN)} &middot; Electrons ${fmtSigned(dP)} &middot; Shells ${prevShells.length}→${nextShells.length}</div>
    </div>
    <div class="toast-section">
      <div class="toast-label">Trend</div>
      <div class="toast-trend">${trend}</div>
      ${extra}
    </div>
    <div class="toast-section">
      <div class="toast-label">Reactivity prediction</div>
      <div class="toast-predict">${octetPrediction(nextZ)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  positionToastBesideAtom(toast, nextZ);

  toast.style.opacity = '0';
  toast.style.transform = 'translateX(10px) scale(0.94)';
  void toast.offsetWidth; // force a layout flush so the entry animates instead of snapping in
  toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(0) scale(1)';

  activeToast = toast;
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
  renderSubshells(state.z);
  refreshGrid();
  updateDpad();
});

// ---------- Guided tour ----------
const TOUR_STEPS = [
  { selector: '.bohr-panel', title: 'The Bohr model', body: 'This updates live as you move between elements — watch protons, neutrons, electrons and shells change in real time.' },
  {
    selector: '#subshell-panel', title: 'Subshells',
    body: 'With "Show transition metals" on, this breaks the current atom down by subshell (1s, 2s, 2p...) — the order electrons actually fill in.',
    beforeShow: () => { if (!state.transitionMetalsOn) { tmToggle.checked = true; tmToggle.dispatchEvent(new Event('change')); } },
  },
  { selector: '#info-panel', title: 'Element facts', body: 'Category, mass number, electron shells, metallic character, reactivity and electronegativity for the current element.' },
  { selector: '#periodic-grid', title: 'The periodic table', body: 'Color-coded by category, matching the legend above. Click any active tile to jump straight to it.' },
  { selector: '#dpad', title: 'Move the atom', body: "Use these arrows — or your keyboard's arrow keys — to move across a period or down a group." },
  { selector: '.bohr-panel', title: 'Watch what changes', body: 'Every move pops a quick burst on the diagram for what changed, then a fuller card appears beside the atom explaining the trend and predicting reactivity.' },
  { selector: '.tm-toggle', title: 'Transition metals', body: 'Toggle this to unlock the full 118-element table — transition metals, lanthanides and actinides — plus the subshell breakdown.' },
];

let tourIndex = -1;
const tourBtn = document.getElementById('tour-btn');
const tourBlocker = document.getElementById('tour-blocker');
const tourHighlight = document.getElementById('tour-highlight');
const tourCaption = document.getElementById('tour-caption');
const tourTitleEl = document.getElementById('tour-title');
const tourBodyEl = document.getElementById('tour-body');
const tourProgressEl = document.getElementById('tour-progress');

function startTour() {
  tourIndex = -1;
  tourBtn.classList.add('hidden');
  tourBlocker.classList.remove('hidden');
  tourHighlight.classList.remove('hidden');
  tourCaption.classList.remove('hidden');
  nextTourStep();
}

function endTour() {
  tourBlocker.classList.add('hidden');
  tourHighlight.classList.add('hidden');
  tourCaption.classList.add('hidden');
  tourBtn.classList.remove('hidden');
  tourIndex = -1;
}

function nextTourStep() {
  tourIndex++;
  if (tourIndex >= TOUR_STEPS.length) { endTour(); return; }
  const step = TOUR_STEPS[tourIndex];
  if (step.beforeShow) step.beforeShow();
  requestAnimationFrame(() => placeTourStep(step));
}

function placeTourStep(step) {
  const target = document.querySelector(step.selector);
  const rect = target.getBoundingClientRect();
  const pad = 8;
  tourHighlight.style.left = `${rect.left - pad}px`;
  tourHighlight.style.top = `${rect.top - pad}px`;
  tourHighlight.style.width = `${rect.width + pad * 2}px`;
  tourHighlight.style.height = `${rect.height + pad * 2}px`;

  tourTitleEl.textContent = step.title;
  tourBodyEl.textContent = step.body;
  tourProgressEl.textContent = `${tourIndex + 1} / ${TOUR_STEPS.length}`;
  document.getElementById('tour-next').textContent = tourIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next';

  const captionWidth = 320;
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - captionWidth - 16);
  let top = rect.bottom + pad + 14;
  if (top + 170 > window.innerHeight) top = Math.max(16, rect.top - pad - 14 - 170);
  tourCaption.style.left = `${left}px`;
  tourCaption.style.top = `${top}px`;
}

tourBtn.addEventListener('click', startTour);
document.getElementById('tour-skip').addEventListener('click', endTour);
document.getElementById('tour-next').addEventListener('click', nextTourStep);

// ---------- Init ----------
buildGrid();
renderInfoPanel(state.z);
renderBohr(state.z);
renderSubshells(state.z);
updateDpad();
