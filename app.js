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

  const titleEl = document.createElement('div');
  titleEl.className = 'grid-title';
  titleEl.id = 'grid-title';
  titleEl.innerHTML = `
    <div class="grid-title-heading" id="grid-title-heading">${DEFAULT_GRID_TITLE}</div>
    <div class="grid-title-body" id="grid-title-body"></div>
  `;
  gridEl.appendChild(titleEl);

  refreshGrid();
}

function makeTile(e, row, col) {
  const btn = document.createElement('button');
  btn.className = 'tile';
  btn.dataset.z = e.z;
  btn.style.gridRow = row;
  btn.style.gridColumn = col;
  btn.style.setProperty('--tile-color', CATEGORY_META[e.category].color);
  btn.style.setProperty('--heat-reactivity', reactivityColor(reactivityScore(e.z)));
  btn.style.setProperty('--heat-electroneg', electronegColor(e.en));
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
    if (!btn.dataset.z) continue; // skip the decorative grid-title element
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

// ---------- Info panel (flip card: quick facts <-> write-up) ----------
function renderInfoPanel(z) {
  const e = ELEMENTS_BY_Z[z];
  const shells = shellConfig(z);
  const meta = CATEGORY_META[e.category];
  const panel = document.getElementById('info-panel');
  panel.style.setProperty('--accent', meta.color);

  document.getElementById('info-card-front').innerHTML = `
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

  document.getElementById('info-card-back').innerHTML = `
    <div class="info-header">
      <div class="info-symbol">${e.symbol}</div>
      <div class="info-titles">
        <div class="info-name">${e.name}</div>
        <div class="info-category">About this element</div>
      </div>
    </div>
    <div class="info-writeup">${elementWriteUp(z)}</div>
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

// A random point well outside the diagram's usual bounds, used as the origin for a
// newly-arriving particle's "flying in" entrance.
function randomFarPoint(radius = 190) {
  const angle = Math.random() * Math.PI * 2;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

// Smoothly reconciles the circles in `container` matching `filterClass` with `positions`:
// existing ones transition to their new spot, extras fade out, new ones fly in from a
// random point outside the diagram and bounce into place (see the back-out easing on
// .electron's transition).
function syncCircles(container, filterClass, positions, r, createClass) {
  createClass = createClass || filterClass;
  let els = Array.from(container.children).filter(el => el.classList.contains(filterClass));
  while (els.length > positions.length) {
    const el = els.pop();
    el.classList.remove(filterClass); // so a rapid re-sync before removal can't "reclaim" this fading-out element
    el.style.opacity = '0';
    el.style.r = '0px';
    setTimeout(() => el.remove(), 500);
  }
  els.forEach((el, i) => {
    el.style.cx = `${positions[i].x}px`;
    el.style.cy = `${positions[i].y}px`;
  });
  for (let i = els.length; i < positions.length; i++) {
    const far = randomFarPoint();
    const el = svgEl('circle', { class: createClass, r: 0 });
    el.style.cx = `${far.x}px`;
    el.style.cy = `${far.y}px`;
    el.style.r = '0px';
    el.style.opacity = '0';
    el.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s`;
    container.appendChild(el);
    void el.getBoundingClientRect(); // force layout flush so the flight-in actually animates
    el.style.cx = `${positions[i].x}px`;
    el.style.cy = `${positions[i].y}px`;
    el.style.r = `${r}px`;
    el.style.opacity = '1';
    els.push(el);
  }
  return els;
}

// Smoothly reconciles nucleon "ball" groups in `container` with `positions`. Each nucleon
// is a wrapper <g> (positioned via transform, so it can transition smoothly) containing an
// inner <g> that jiggles continuously via CSS, holding a gradient-filled body circle. New
// nucleons fly in from a random point outside the diagram and bounce into place.
function syncNucleonGroups(container, kind, positions, r) {
  const wrapClass = `${kind}-wrap`;
  let wraps = Array.from(container.children).filter(el => el.classList.contains(wrapClass));
  while (wraps.length > positions.length) {
    const w = wraps.pop();
    w.classList.remove(wrapClass); // so a rapid re-sync before removal can't "reclaim" this fading-out element
    w.style.opacity = '0';
    w.style.transform = `${w.dataset.baseTransform} scale(0.2)`;
    setTimeout(() => w.remove(), 500);
  }
  wraps.forEach((w, i) => {
    const t = `translate(${positions[i].x}px, ${positions[i].y}px)`;
    w.dataset.baseTransform = t;
    w.style.transform = `${t} scale(1)`;
  });
  for (let i = wraps.length; i < positions.length; i++) {
    const t = `translate(${positions[i].x}px, ${positions[i].y}px)`;
    const far = randomFarPoint();
    const wrap = svgEl('g', { class: wrapClass });
    wrap.dataset.baseTransform = t;
    wrap.style.opacity = '0';
    wrap.style.transform = `translate(${far.x}px, ${far.y}px) scale(0.4)`;

    const inner = svgEl('g', { class: `nucleon ${kind}` });
    inner.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s`;
    const body = svgEl('circle', { class: 'nucleon-body', r });
    inner.appendChild(body);
    wrap.appendChild(inner);
    container.appendChild(wrap);

    void wrap.getBoundingClientRect(); // force layout flush so the flight-in actually animates
    wrap.style.opacity = '1';
    wrap.style.transform = `${t} scale(1)`;
    wraps.push(wrap);
  }
  return wraps;
}

const NUCLEON_SPACING = 13.6; // center-to-center distance between packed nucleons (just enough room for r=6.5 balls not to overlap)

// Packs n points onto a compact triangular (close-packed circles) lattice instead of a
// spiral, so it reads as a normal tightly-clustered nucleus. Points are returned in a
// row-by-row snake order so that assigning proton/neutron labels in sequence produces a
// mostly-alternating pattern rather than same-type nucleons clumping together.
function hexNucleusPositions(n) {
  if (n <= 0) return [];
  const ringsNeeded = Math.ceil(Math.sqrt(n)) + 3;
  const candidates = [];
  for (let row = -ringsNeeded; row <= ringsNeeded; row++) {
    const y = row * NUCLEON_SPACING * (Math.sqrt(3) / 2);
    const xOffset = (Math.abs(row) % 2 === 1) ? NUCLEON_SPACING / 2 : 0;
    for (let col = -ringsNeeded; col <= ringsNeeded; col++) {
      const x = col * NUCLEON_SPACING + xOffset;
      candidates.push({ x, y, row, dist: Math.hypot(x, y) });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const chosen = candidates.slice(0, n);

  const byRow = new Map();
  chosen.forEach((p) => {
    if (!byRow.has(p.row)) byRow.set(p.row, []);
    byRow.get(p.row).push(p);
  });
  const rowKeys = Array.from(byRow.keys()).sort((a, b) => a - b);
  const ordered = [];
  rowKeys.forEach((r, idx) => {
    const rowPts = byRow.get(r).sort((a, b) => a.x - b.x);
    if (idx % 2 === 1) rowPts.reverse();
    ordered.push(...rowPts);
  });
  return ordered.map((p) => ({ x: CENTER + p.x, y: CENTER + p.y }));
}

// Builds a proton/neutron order that mostly alternates types (rather than clumping same-type
// nucleons together), shared by both the 2D and 3D dot layouts.
function buildNucleonOrder(protons, neutrons) {
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
  return order;
}

function render2DNucleus(order, nucleusRadius) {
  if (nucleusMode !== 'dots2d') {
    nucleus3DRecords.clear();
    nucleusGroup.innerHTML = '';
    nucleusMode = 'dots2d';
  }
  nucleusGroup.classList.add('spinning');
  const pts = hexNucleusPositions(order.length);
  const protonPts = pts.filter((_, i) => order[i] === 'proton');
  const neutronPts = pts.filter((_, i) => order[i] === 'neutron');
  syncNucleonGroups(nucleusGroup, 'proton', protonPts, 6.5);
  syncNucleonGroups(nucleusGroup, 'neutron', neutronPts, 6.5);
}

function renderBlobNucleus(protons, neutrons, nucleusRadius) {
  if (nucleusMode !== 'blob') {
    nucleus3DRecords.clear();
    nucleusGroup.innerHTML = '';
    nucleusGroup.classList.remove('spinning');
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

function renderNucleus(protons, neutrons) {
  const total = protons + neutrons;
  const nucleusRadius = NUCLEUS_K * Math.cbrt(Math.max(total, 1));

  if (total <= BLOB_THRESHOLD) {
    const order = buildNucleonOrder(protons, neutrons);
    if (nucleusViewMode === '3d') {
      render3DNucleus(order, nucleusRadius);
    } else {
      render2DNucleus(order, nucleusRadius);
    }
  } else {
    renderBlobNucleus(protons, neutrons, nucleusRadius);
  }

  return nucleusRadius;
}

// ---------- 3D nucleus: "liquid drop" physics -- a real nuclear model, not just a visual
// trick -- nucleons are simulated as small particles with a Lennard-Jones-style pairwise
// force: they repel steeply the moment they'd overlap, but mildly attract each other out to
// a short range beyond that -- like real short-range surface tension between liquid
// molecules. That's what actually pulls neighbours in touching-close with no gaps, rather
// than just letting them float apart to fill whatever space is available. A soft wall at the
// nucleus's physical radius (NUCLEUS_K*cbrt(total nucleon count), the same law used
// elsewhere for ring-gap placement) plus a firm centring pull quickly draw newly-arrived or
// scattered nucleons back into a single ball, rather than leaving them drifting for ages.
// Random thermal jitter keeps nucleons continuously swimming past and swapping places with
// each other. No fixed lattice, no rigid rotation of the whole cluster. A "camera" orbit
// around the cluster (used only for projection, not part of the physics) gives the near/far
// depth cue: closer nucleons render bigger/brighter, farther ones smaller/dimmer and are
// painted behind. Adding or removing nucleons (moving to a different element) kicks that
// orbit up to a fast spin in a freshly-rolled random direction, which then decays back down
// to a slow steady rotation over the next few seconds -- direction only ever changes on an
// element change, never mid-idle. New nucleons shoot in from well outside the visible
// diagram; removed ones shoot back out the same way. A "2D nucleus" toggle switches back to
// the flat packed-disc view. ----------
const NUCLEUS_3D_SPIN_BASE_PERIOD = 9000;  // slow resting rotation it decays down to (ms per revolution)
const NUCLEUS_3D_SPIN_BOOST_PERIOD = 1900; // fast rotation right after an element change (ms per revolution)
const NUCLEUS_3D_SPIN_DECAY = 0.988;       // per-~16.7ms-step pull of the boosted speed back toward baseline
const NUCLEUS_3D_SPACING = 12.4;    // equilibrium centre-to-centre distance -- a touch under 2*bodyR so touching balls read as gap-free
const NUCLEUS_3D_CUTOFF = NUCLEUS_3D_SPACING * 1.55; // beyond this, nucleons don't interact at all
const NUCLEUS_3D_REPEL_K = 0.16;    // steep push-apart once closer than NUCLEUS_3D_SPACING
const NUCLEUS_3D_ATTRACT_K = 0.028; // mild pull-together for neighbours that have drifted apart (closes gaps)
const NUCLEUS_3D_WALL_K = 0.006;    // how hard the nucleus's outer radius pushes nucleons back in (safety backstop, not the packing mechanism)
const NUCLEUS_3D_CENTER_K = 0.0022; // pull toward the centre -- strong enough to pull a freshly-arrived scatter of nucleons into a ball quickly
const NUCLEUS_3D_JITTER = 0.14;     // per-frame random thermal jiggle -- nucleons visibly swap places and swim around each other
const NUCLEUS_3D_DAMPING = 0.92;    // velocity decay per ~16.7ms simulation step -- looser than before so that jiggle keeps things moving
let nucleusViewMode = '3d'; // '2d' | '3d' -- user preference, only matters while under BLOB_THRESHOLD
let nucleus3DRecords = new Map(); // order-index -> { kind, el, pos:{x,y,z}, vel:{x,y,z}, leaving, depth }
let nucleus3DTargetRadius = 30;
let nucleus3DFrameHandle = null;
let nucleus3DSortCounter = 0;
let nucleus3DLastTick = 0;
let nucleus3DCameraAngle = 0;
let nucleus3DCameraSpeed = 0;    // radians/ms, signed -- current (possibly boosted) angular speed
let nucleus3DCameraDir = 1;      // +1 | -1 -- only re-rolled on an element change
let nucleus3DCameraLastTick = 0;
let nucleus3DPrevTotal = -1;     // last seen nucleon count, to detect an element change

function randomFarPoint3D(radius = 420) {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const ringR = Math.sqrt(Math.max(0, 1 - u * u));
  return { x: radius * ringR * Math.cos(t), y: radius * u, z: radius * ringR * Math.sin(t) };
}

function render3DNucleus(order, nucleusRadius) {
  nucleus3DTargetRadius = nucleusRadius;

  if (nucleusMode !== 'dots3d') {
    nucleusGroup.innerHTML = '';
    nucleusGroup.classList.remove('spinning');
    nucleus3DRecords.clear();
    nucleusMode = 'dots3d';
    nucleus3DLastTick = performance.now();
    nucleus3DCameraLastTick = nucleus3DLastTick;
    nucleus3DCameraDir = Math.random() < 0.5 ? -1 : 1;
    nucleus3DCameraSpeed = nucleus3DCameraDir * (Math.PI * 2) / NUCLEUS_3D_SPIN_BASE_PERIOD;
    nucleus3DPrevTotal = -1; // don't treat entering 3D mode itself as an "element changed" spin-up
  }

  // A changed nucleon count means the element changed -- re-roll the spin direction and kick
  // the camera orbit up to a fast spin, which then decays back down to a slow steady rotation
  // (see step3DNucleus). Direction never changes except on this event.
  if (nucleus3DPrevTotal !== -1 && nucleus3DPrevTotal !== order.length) {
    nucleus3DCameraDir = Math.random() < 0.5 ? -1 : 1;
    nucleus3DCameraSpeed = nucleus3DCameraDir * (Math.PI * 2) / NUCLEUS_3D_SPIN_BOOST_PERIOD;
  }
  nucleus3DPrevTotal = order.length;

  // Extras (count shrank) shoot back out the way new ones shoot in -- a strong outward
  // impulse that carries them off the visible diagram before they fade and leave the
  // simulation.
  for (const [i, rec] of nucleus3DRecords) {
    if (i >= order.length && !rec.leaving) {
      rec.leaving = true;
      rec.leaveStart = performance.now();
      const d = Math.max(1, Math.hypot(rec.pos.x, rec.pos.y, rec.pos.z));
      const kick = 15;
      rec.vel.x += (rec.pos.x / d) * kick;
      rec.vel.y += (rec.pos.y / d) * kick;
      rec.vel.z += (rec.pos.z / d) * kick;
      const el = rec.el;
      setTimeout(() => { nucleus3DRecords.delete(i); el.remove(); }, 660);
    }
  }

  // New nucleons shoot in from a random point outside the nucleus with an inward kick, then
  // jostle into place under the same forces as everyone else already in the liquid.
  for (let i = 0; i < order.length; i++) {
    if (nucleus3DRecords.has(i)) continue;
    const wrap = svgEl('g', { class: `nucleon-3d ${order[i]}` });
    const body = svgEl('circle', { class: 'nucleon-body', cx: 0, cy: 0, r: 6.5 });
    wrap.appendChild(body);
    nucleusGroup.appendChild(wrap);
    const far = randomFarPoint3D();
    const d = Math.max(1, Math.hypot(far.x, far.y, far.z));
    const speed = 13;
    nucleus3DRecords.set(i, {
      kind: order[i], el: wrap, leaving: false, depth: 0,
      pos: far,
      vel: { x: -far.x / d * speed, y: -far.y / d * speed, z: -far.z / d * speed },
    });
  }

  if (!nucleus3DFrameHandle) nucleus3DFrameHandle = requestAnimationFrame(step3DNucleus);
}

function step3DNucleus(now) {
  if (nucleusMode !== 'dots3d') { nucleus3DFrameHandle = null; return; }

  const dt = Math.min(2, Math.max(0, now - nucleus3DLastTick) / 16.6667) || 1;
  nucleus3DLastTick = now;
  const damp = Math.pow(NUCLEUS_3D_DAMPING, dt);
  const live = [...nucleus3DRecords.values()].filter((r) => !r.leaving);

  // Short-range Lennard-Jones-style pairwise force: steep repulsion once overlapping, mild
  // attraction out to NUCLEUS_3D_CUTOFF. This is what actually pulls neighbours in touching-
  // close with no gaps (the attraction closes any drift apart), while the repulsion keeps
  // them from fully overlapping -- a real liquid's cohesion, not just a non-overlap rule.
  for (let a = 0; a < live.length; a++) {
    const pa = live[a].pos;
    for (let b = a + 1; b < live.length; b++) {
      const pb = live[b].pos;
      const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dy, dz) || 0.001;
      if (dist >= NUCLEUS_3D_CUTOFF) continue;
      const f = dist < NUCLEUS_3D_SPACING
        ? -NUCLEUS_3D_REPEL_K * (NUCLEUS_3D_SPACING - dist)
        : NUCLEUS_3D_ATTRACT_K * (dist - NUCLEUS_3D_SPACING);
      const k = (f / dist) * dt;
      const fx = dx * k, fy = dy * k, fz = dz * k;
      live[a].vel.x += fx; live[a].vel.y += fy; live[a].vel.z += fz;
      live[b].vel.x -= fx; live[b].vel.y -= fy; live[b].vel.z -= fz;
    }
  }

  live.forEach((rec) => {
    const p = rec.pos, v = rec.vel;
    const r = Math.hypot(p.x, p.y, p.z) || 0.001;
    // Soft wall at the nucleus's physical radius, plus a very weak leash toward the centre --
    // just an anchor/safety backstop, not what gives the cluster its density.
    if (r > nucleus3DTargetRadius) {
      const k = NUCLEUS_3D_WALL_K * (r - nucleus3DTargetRadius) * dt;
      v.x -= (p.x / r) * k; v.y -= (p.y / r) * k; v.z -= (p.z / r) * k;
    }
    v.x -= p.x * NUCLEUS_3D_CENTER_K * dt; v.y -= p.y * NUCLEUS_3D_CENTER_K * dt; v.z -= p.z * NUCLEUS_3D_CENTER_K * dt;

    v.x += (Math.random() - 0.5) * NUCLEUS_3D_JITTER * dt;
    v.y += (Math.random() - 0.5) * NUCLEUS_3D_JITTER * dt;
    v.z += (Math.random() - 0.5) * NUCLEUS_3D_JITTER * dt;

    v.x *= damp; v.y *= damp; v.z *= damp;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
  });

  // Leaving nucleons just coast outward on their exit velocity until their timer removes them.
  nucleus3DRecords.forEach((rec) => {
    if (!rec.leaving) return;
    rec.pos.x += rec.vel.x * dt; rec.pos.y += rec.vel.y * dt; rec.pos.z += rec.vel.z * dt;
  });

  // Camera-orbit rotation (viewing only -- not part of the liquid's own motion) gives the
  // near/far depth cue. Its direction only changes on an element-change spin-up (set in
  // render3DNucleus); every frame it just relaxes back toward a slow baseline speed in that
  // same direction, so a fast spin-up smoothly winds down to a gentle steady rotation.
  const camDt = Math.min(50, Math.max(0, now - nucleus3DCameraLastTick));
  nucleus3DCameraLastTick = now;
  const baseSpeed = nucleus3DCameraDir * (Math.PI * 2) / NUCLEUS_3D_SPIN_BASE_PERIOD;
  const decay = Math.pow(NUCLEUS_3D_SPIN_DECAY, camDt / 16.6667);
  nucleus3DCameraSpeed = baseSpeed + (nucleus3DCameraSpeed - baseSpeed) * decay;
  nucleus3DCameraAngle += nucleus3DCameraSpeed * camDt;
  const angle = nucleus3DCameraAngle;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const maxR = Math.max(nucleus3DTargetRadius, 1);

  nucleus3DRecords.forEach((rec) => {
    const p = rec.pos;
    const rx = p.x * cosA + p.z * sinA;
    const rz = -p.x * sinA + p.z * cosA;
    const ry = p.y;
    const depthT = clamp01((rz + maxR) / (2 * maxR));
    const scale = lerp(0.8, 1.1, depthT);
    rec.depth = rz;
    rec.el.style.transform = `translate(${(CENTER + rx).toFixed(2)}px, ${(CENTER + ry).toFixed(2)}px) scale(${scale.toFixed(2)})`;
    // Fade driven directly off elapsed time (not a CSS transition) so it stays in lockstep
    // with the physics-driven position updates every frame.
    rec.el.style.opacity = rec.leaving
      ? Math.max(0, 1 - (now - rec.leaveStart) / 650).toFixed(2)
      : lerp(0.75, 1, depthT).toFixed(2);
  });

  nucleus3DSortCounter++;
  if (nucleus3DSortCounter % 6 === 0) {
    const sorted = [...nucleus3DRecords.values()].sort((a, b) => a.depth - b.depth);
    sorted.forEach((rec) => nucleusGroup.appendChild(rec.el));
  }

  nucleus3DFrameHandle = requestAnimationFrame(step3DNucleus);
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
    syncCircles(shellStates[i].groupEl, 'electron', electronPositions, 3.2);
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
  const scale = atomicRadiusScale(nextZ);
  const rawNucleusRadius = NUCLEUS_K * Math.cbrt(Math.max(nextTotal, 1));
  const rawOuterRadius = rawNucleusRadius + RING_GAP * (Math.max(nextShells.length, prevShells.length) + 1.6);
  // Clamp so bursts stay on-screen for high-shell-count atoms instead of spawning
  // further and further above the visible diagram as more shells are added.
  const nucleusRadius = Math.min(rawNucleusRadius * scale, 55);
  const outerRadius = Math.min(rawOuterRadius * scale, 150);

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
  if (t.closest('.proton')) showPopup('proton', ev.clientX, ev.clientY + 16);
  else if (t.closest('.neutron')) showPopup('neutron', ev.clientX, ev.clientY + 16);
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

// ---------- Info panel flip (facts <-> write-up) ----------
const flipBtn = document.getElementById('flip-btn');
const infoCardInner = document.getElementById('info-card-inner');
let infoFlipped = false;
flipBtn.addEventListener('click', () => {
  infoFlipped = !infoFlipped;
  infoCardInner.classList.toggle('flipped', infoFlipped);
  flipBtn.textContent = infoFlipped ? '✕' : 'i';
  flipBtn.setAttribute('aria-label', infoFlipped ? 'Back to quick facts' : 'Show element write-up');
});

// ---------- Heatmaps ----------
const DEFAULT_GRID_TITLE = 'Interactive<br>Periodic Table';
const HEATMAP_INFO = {
  reactivity: {
    title: 'Reactivity',
    body: 'Hotter = more reactive. Black noble gases barely react at all.',
  },
  electroneg: {
    title: 'Electronegativity',
    body: 'How much an atom wants electrons. Green = holds on tight. Blue = lets go easily.',
  },
};

let activeHeatmap = null; // 'reactivity' | 'electroneg' | null
const heatReactivityBtn = document.getElementById('heat-reactivity-btn');
const heatElectronegBtn = document.getElementById('heat-electroneg-btn');

function setHeatmap(mode) {
  gridEl.classList.remove('heatmap-reactivity', 'heatmap-electroneg');
  heatReactivityBtn.classList.remove('active');
  heatElectronegBtn.classList.remove('active');
  const gridTitle = document.getElementById('grid-title');
  const headingEl = document.getElementById('grid-title-heading');
  const bodyEl = document.getElementById('grid-title-body');

  if (activeHeatmap === mode) {
    activeHeatmap = null;
    gridTitle.classList.remove('active');
    headingEl.innerHTML = DEFAULT_GRID_TITLE;
    bodyEl.textContent = '';
    return;
  }

  activeHeatmap = mode;
  gridEl.classList.add(mode === 'reactivity' ? 'heatmap-reactivity' : 'heatmap-electroneg');
  (mode === 'reactivity' ? heatReactivityBtn : heatElectronegBtn).classList.add('active');
  const info = HEATMAP_INFO[mode];
  gridTitle.classList.add('active');
  headingEl.textContent = info.title;
  bodyEl.textContent = info.body;
}

heatReactivityBtn.addEventListener('click', () => setHeatmap('reactivity'));
heatElectronegBtn.addEventListener('click', () => setHeatmap('electroneg'));

// ---------- Expand table / shrink Bohr model ----------
const expandTableBtn = document.getElementById('expand-table-btn');
const appEl = document.querySelector('.app');
expandTableBtn.addEventListener('click', () => {
  const expanded = appEl.classList.toggle('table-expanded');
  expandTableBtn.classList.toggle('active', expanded);
});

// ---------- Nucleus 3D/2D toggle ----------
const nucleusModeBtn = document.getElementById('nucleus-mode-btn');
nucleusModeBtn.addEventListener('click', () => {
  nucleusViewMode = nucleusViewMode === '3d' ? '2d' : '3d';
  nucleusModeBtn.classList.toggle('active', nucleusViewMode === '3d');
  nucleusModeBtn.innerHTML = nucleusViewMode === '3d' ? '🌐 3D nucleus' : '⬛ 2D nucleus';
  renderBohr(state.z);
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
  { selector: '#flip-btn', title: 'Flip for a write-up', body: 'Click this to flip the card over and read a short write-up on how reactive this element is, why, and what it typically bonds with.' },
  { selector: '#periodic-grid', title: 'The periodic table', body: 'Color-coded by category, matching the legend above. Click any active tile to jump straight to it.' },
  { selector: '.heatmap-toggles', title: 'Heatmaps', body: 'Toggle these to recolor the whole table by reactivity or electronegativity instead of category, to see those trends at a glance.' },
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
