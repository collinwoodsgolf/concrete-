// ============================================================
// POUR DECISIONS — 3D world (three.js)
// Real-time 3D: sun with soft shadows, PBR-ish procedural
// textures, sky/fog, modeled town and job sites. No assets.
// Falls back to logic-only (null scenes) when WebGL is absent.
// ============================================================

/* global THREE */

const WORKER_SKINS = ['#c8956c', '#8a5a3c', '#e0b090', '#6e452c', '#d4a276'];

const SEASONS = {
  1: { name:'spring',    sky: 0x87b8e8, sun: 0xfff2dd, snow: false, leaves: false, grass: '#4a6b31' },
  2: { name:'summer',    sky: 0x79b4ea, sun: 0xfff0c8, snow: false, leaves: true,  grass: '#48682c' },
  3: { name:'late fall', sky: 0x9aa7b5, sun: 0xe8e4da, snow: true,  leaves: false, grass: '#6d6b52' },
  4: { name:'spring',    sky: 0x87b8e8, sun: 0xfff2dd, snow: false, leaves: false, grass: '#4a6b31' },
  5: { name:'summer',    sky: 0x82bcec, sun: 0xfff0c8, snow: false, leaves: false, grass: '#456a2e' },
};
function season() { return SEASONS[Math.min((typeof G !== 'undefined' && G && G.chapter) || 1, 5)]; }

// ---------- core renderer -----------------------------------------------------

const W3 = {
  renderer: null, scene: null, camera: null, raf: null, t: 0,
  onFrame: null, onClick: null, canvas: null,

  available() {
    if (this._avail !== undefined) return this._avail;
    try {
      const c = document.createElement('canvas');
      this._avail = !!(typeof THREE !== 'undefined' && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { this._avail = false; }
    return this._avail;
  },

  mount(container, w, h) {
    this.unmount();
    if (!this.available()) return false;
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(w, h);
    r.setPixelRatio(Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.domElement.className = 'stage';
    r.domElement.style.width = '100%';       // scale to panel; keep aspect
    r.domElement.style.height = 'auto';
    container.appendChild(r.domElement);
    this.renderer = r; this.canvas = r.domElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 900);

    this.canvas.addEventListener('click', e => {
      if (!this.onClick) return;
      const rect = this.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      this.onClick(ray);
    });

    let last = 0;
    const loop = (ms) => {
      const dt = Math.min(0.05, (ms - last) / 1000 || 0.016);
      last = ms;
      this.t += dt;
      try { if (this.onFrame) this.onFrame(this.t, dt); } catch (e) {}
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return true;
  },

  unmount() {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.raf = null; this.renderer = null; this.scene = null; this.camera = null;
    this.onFrame = null; this.onClick = null; this.canvas = null;
  },

  lights(sunPos = [60, 90, 40], shadowSpan = 100) {
    const s = season();
    const sun = new THREE.DirectionalLight(s.sun, 1.2);
    sun.position.set(...sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -shadowSpan; sun.shadow.camera.right = shadowSpan;
    sun.shadow.camera.top = shadowSpan; sun.shadow.camera.bottom = -shadowSpan;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 420;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(new THREE.HemisphereLight(0xbdd6ee, 0x55603f, 0.35));
    this.scene.background = new THREE.Color(s.sky);
    return sun;
  },
};

// legacy alias so older call sites keep working
const Stage = { unmount: () => W3.unmount(), get ctx() { return W3.renderer; } };

// ---------- procedural textures -------------------------------------------------

const T3 = {};
function canvasTex(name, size, painter, { bump = false, repeat = 1 } = {}) {
  const key = name + (bump ? '_b' : '');
  if (T3[key]) return T3[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  let seed = 0; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  painter(x, rnd, size, bump);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if (!bump) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  T3[key] = tex;
  return tex;
}

const speckle = (base, n, vary, blotch = 0) => (x, rnd, s, bump) => {
  x.fillStyle = bump ? '#808080' : base; x.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const g = Math.round(110 + rnd() * vary);
    x.fillStyle = bump ? `rgba(${g},${g},${g},${0.3 + rnd() * 0.4})`
                       : `rgba(${g},${g - 4},${g - 10},${0.14 + rnd() * 0.28})`;
    x.fillRect(rnd() * s, rnd() * s, 1.5, 1.5);
  }
  for (let i = 0; i < blotch; i++) {
    x.fillStyle = bump ? 'rgba(96,96,96,.25)' : 'rgba(40,36,30,.08)';
    x.beginPath(); x.arc(rnd() * s, rnd() * s, 5 + rnd() * 16, 0, 7); x.fill();
  }
};

function grassPainter(color) {
  return (x, rnd, s, bump) => {
    x.fillStyle = bump ? '#808080' : color; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 4200; i++) {
      const g = 80 + rnd() * 70;
      x.fillStyle = bump ? `rgba(${g + 60},${g + 60},${g + 60},.35)`
                         : `rgba(${g * 0.55},${g},${g * 0.4},${0.25 + rnd() * 0.4})`;
      x.fillRect(rnd() * s, rnd() * s, 1.4, 2.5 + rnd() * 2);
    }
    if (!bump) for (let i = 0; i < 22; i++) {
      x.fillStyle = `rgba(122,110,60,${0.05 + rnd() * 0.06})`;
      x.beginPath(); x.arc(rnd() * s, rnd() * s, 5 + rnd() * 12, 0, 7); x.fill();
    }
  };
}

const MAT = {};
function mat(name) {
  if (MAT[name]) return MAT[name];
  const mk = {
    grass: () => new THREE.MeshStandardMaterial({
      map: canvasTex('grass' + season().grass, 256, grassPainter(season().grass), { repeat: 18 }),
      bumpMap: canvasTex('grass' + season().grass, 256, grassPainter(season().grass), { bump: true, repeat: 18 }),
      bumpScale: 0.12, roughness: 1 }),
    asphalt: () => new THREE.MeshStandardMaterial({
      map: canvasTex('asphalt', 256, speckle('#33363a', 3200, 90, 10), { repeat: 8 }),
      bumpMap: canvasTex('asphalt', 256, speckle('#33363a', 3200, 90, 10), { bump: true, repeat: 8 }),
      bumpScale: 0.05, roughness: 0.95 }),
    concrete: () => new THREE.MeshStandardMaterial({
      map: canvasTex('concrete', 256, speckle('#b8b5ad', 2400, 90), { repeat: 4 }),
      bumpMap: canvasTex('concrete', 256, speckle('#b8b5ad', 2400, 90), { bump: true, repeat: 4 }),
      bumpScale: 0.03, roughness: 0.85 }),
    oldConcrete: () => new THREE.MeshStandardMaterial({
      map: canvasTex('oldConcrete', 256, speckle('#9d9a90', 2400, 90, 14), { repeat: 3 }),
      bumpMap: canvasTex('oldConcrete', 256, speckle('#9d9a90', 2400, 90, 14), { bump: true, repeat: 3 }),
      bumpScale: 0.06, roughness: 0.92 }),
    gravel: () => new THREE.MeshStandardMaterial({
      map: canvasTex('gravel', 256, speckle('#867e6d', 2000, 110, 6), { repeat: 5 }),
      bumpMap: canvasTex('gravel', 256, speckle('#867e6d', 2000, 110, 6), { bump: true, repeat: 5 }),
      bumpScale: 0.18, roughness: 1 }),
    wetConcrete: () => new THREE.MeshPhongMaterial({
      map: canvasTex('wet', 256, speckle('#6f6b64', 1600, 60), { repeat: 3 }),
      color: 0xffffff, shininess: 70, specular: 0x88919c }),
    rubble: () => new THREE.MeshStandardMaterial({
      map: canvasTex('rubble', 256, speckle('#6e6557', 2400, 110, 20), { repeat: 2 }),
      bumpMap: canvasTex('rubble', 256, speckle('#6e6557', 2400, 110, 20), { bump: true, repeat: 2 }),
      bumpScale: 0.3, roughness: 1 }),
    dirt: () => new THREE.MeshStandardMaterial({
      map: canvasTex('dirt', 256, speckle('#5f5240', 1800, 70, 12), { repeat: 3 }),
      roughness: 1 }),
    wood: () => new THREE.MeshStandardMaterial({
      map: canvasTex('wood', 128, (x, rnd, s) => {
        x.fillStyle = '#9c7a48'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 40; i++) {
          x.strokeStyle = `rgba(90,60,25,${0.15 + rnd() * 0.25})`;
          x.lineWidth = 1 + rnd() * 2;
          x.beginPath(); x.moveTo(0, rnd() * s);
          x.bezierCurveTo(s * 0.3, rnd() * s, s * 0.6, rnd() * s, s, rnd() * s); x.stroke();
        }
      }, { repeat: 2 }), roughness: 0.9 }),
    glass: () => new THREE.MeshPhongMaterial({ color: 0x9fc4d8, shininess: 100, specular: 0xffffff, transparent: true, opacity: 0.85 }),
  };
  MAT[name] = mk[name]();
  return MAT[name];
}
const solid = (color, rough = 0.85, metal = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

// ---------- reusable builders -----------------------------------------------------

function box(w, h, d, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}

function gableRoof(w, d, rise, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.8, 0); shape.lineTo(w / 2 + 0.8, 0); shape.lineTo(0, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 1.6, bevelEnabled: false });
  geo.translate(0, 0, -(d + 1.6) / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const ROOF_COLORS = [0x4a4440, 0x5a5148, 0x3e444a, 0x57504a, 0x484138, 0x50463e];
const WALL_COLORS = [0xb7ab90, 0xa8b0b6, 0xc4b8a0, 0x9fae9a, 0xc0aca4, 0xd0c8b0];
const CAR_COLORS = [0x5a6570, 0x7a3b34, 0x33424f, 0x7d7466, 0x42503b];

function buildHouse(seed, { w = 26, d = 20, hgt = 9, garage = false } = {}) {
  const g = new THREE.Group();
  const wallMat = solid(WALL_COLORS[seed % WALL_COLORS.length], 0.9);
  const roofMat = new THREE.MeshStandardMaterial({
    color: ROOF_COLORS[seed % ROOF_COLORS.length], roughness: 0.95,
    bumpMap: canvasTex('shingle', 128, (x, rnd, s) => {
      x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 10) {
        x.fillStyle = 'rgba(40,40,40,.7)'; x.fillRect(0, y, s, 2);
        for (let xx = (y / 10 % 2) * 8; xx < s; xx += 16) x.fillRect(xx, y, 1.5, 10);
      }
    }, { bump: true, repeat: 4 }), bumpScale: 0.06 });
  g.add(box(w, hgt, d, wallMat, 0, hgt / 2, 0));
  const roof = gableRoof(w, d, 5.5, roofMat);
  roof.position.y = hgt;
  g.add(roof);
  // foundation
  g.add(box(w + 0.6, 1, d + 0.6, mat('concrete'), 0, 0.5, 0));
  // front face details (+z side)
  const zf = d / 2 + 0.12;
  if (garage) {
    g.add(box(9, 6.6, 0.25, solid(0xddd8cc, 0.8), w * 0.22, 3.6, zf));
    g.add(box(2.8, 6.4, 0.25, solid(0x5c3a2e, 0.8), -w * 0.32, 3.4, zf));
  } else {
    g.add(box(3, 6.6, 0.25, solid(0x5c3a2e, 0.8), 0, 3.5, zf));
    for (const wx of [-w * 0.3, w * 0.3]) {
      g.add(box(4.6, 3.6, 0.18, solid(0xffffff, 0.6), wx, 4.6, zf));
      g.add(box(4, 3, 0.22, mat('glass'), wx, 4.6, zf + 0.02, false));
    }
  }
  // chimney
  g.add(box(1.6, 4, 1.6, solid(0x6b5648, 0.95), w * 0.28, hgt + 4, -d * 0.2));
  return g;
}

function buildTree(seed, s = 1) {
  const g = new THREE.Group();
  const fall = season().snow;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.7 * s, 6 * s, 7), solid(0x6e4f37, 1));
  trunk.position.y = 3 * s; trunk.castShadow = true;
  g.add(trunk);
  let a = seed * 131 + 7;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const base = fall ? new THREE.Color(0.5, 0.33, 0.12) : new THREE.Color(0.13, 0.3, 0.1);
  for (let i = 0; i < 4; i++) {
    const c = base.clone().multiplyScalar(0.72 + rnd() * 0.4);
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((2.6 + rnd() * 1.6) * s, 1),
      new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    blob.position.set((rnd() - 0.5) * 3.4 * s, (6.5 + rnd() * 3) * s, (rnd() - 0.5) * 3.4 * s);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

function buildPickup() {
  const g = new THREE.Group();
  const body = solid(0x7a2f27, 0.55, 0.25);
  g.add(box(6.6, 1.7, 16.5, body, 0, 2.4, 0));                       // main body
  const cab = box(6.2, 2.5, 5.4, solid(0x8d3a30, 0.5, 0.25), 0, 4.3, 1.4);
  g.add(cab);
  const glassF = box(5.6, 1.7, 0.15, mat('glass'), 0, 4.6, 4.15, false);
  glassF.rotation.x = -0.22; g.add(glassF);
  g.add(box(5.6, 1.4, 0.15, mat('glass'), 0, 4.5, -1.25, false));
  // bed walls
  g.add(box(0.4, 1.4, 7.4, body, -3.1, 3.6, -4.4));
  g.add(box(0.4, 1.4, 7.4, body, 3.1, 3.6, -4.4));
  g.add(box(6.6, 1.4, 0.4, body, 0, 3.6, -8.05));
  // bumpers + lights
  g.add(box(6.8, 0.7, 0.5, solid(0xb9b9b9, 0.4, 0.8), 0, 1.9, 8.3));
  g.add(box(6.8, 0.7, 0.5, solid(0xb9b9b9, 0.4, 0.8), 0, 1.9, -8.3));
  const wheel = () => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 1, 18), solid(0x1c1c1c, 0.9));
    w.rotation.z = Math.PI / 2; w.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.05, 12), solid(0x8f8f8f, 0.35, 0.8));
    hub.rotation.z = Math.PI / 2; w.add(hub);
    return w;
  };
  for (const [x, z] of [[-3.2, 5.2], [3.2, 5.2], [-3.2, -5.2], [3.2, -5.2]]) {
    const w = wheel(); w.position.set(x, 1.35, z); g.add(w);
  }
  return g;
}

function buildMixer() {
  const g = new THREE.Group();
  g.add(box(8, 1.4, 26, solid(0x555a60, 0.7, 0.4), 0, 2.2, 0));         // frame
  g.add(box(7.6, 4.6, 6, solid(0xe6e2d8, 0.5, 0.1), 0, 5, 9.4));        // cab
  const glass = box(7, 2.2, 0.2, mat('glass'), 0, 5.8, 12.4, false);
  glass.rotation.x = -0.15; g.add(glass);
  // drum
  const stripeTex = canvasTex('drum', 128, (x, rnd, s) => {
    x.fillStyle = '#e8e4da'; x.fillRect(0, 0, s, s);
    x.fillStyle = '#b85a28';
    for (let k = -2; k < 6; k++) { x.save(); x.translate(k * 34, 0); x.rotate(0.5); x.fillRect(0, -20, 12, s * 1.6); x.restore(); }
  }, { repeat: 1 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.2, 12, 20),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.5, metalness: 0.15 }));
  drum.castShadow = true;
  drum.rotation.x = 0.28 + Math.PI / 2;
  drum.position.set(0, 6.6, -3);
  g.add(drum); g.userData.drum = drum;
  // hopper + fins
  g.add(box(3, 3, 3, solid(0x8f8a80, 0.7, 0.3), 0, 8.2, -9.6));
  const wheel = (x, z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.2, 18), solid(0x1c1c1c, 0.9));
    w.rotation.z = Math.PI / 2; w.position.set(x, 1.7, z); w.castShadow = true;
    return w;
  };
  for (const [x, z] of [[-3.6, 10], [3.6, 10], [-3.6, -6], [3.6, -6], [-3.6, -9.5], [3.6, -9.5]]) g.add(wheel(x, z));
  return g;
}

function buildSkid() {
  const g = new THREE.Group();
  g.add(box(5.4, 3.4, 7, solid(0xd9a516, 0.6, 0.2), 0, 3.2, 0));
  g.add(box(4, 2.6, 3.6, solid(0x2c2c2c, 0.8), 0, 4.6, -0.4));
  g.add(box(0.7, 0.7, 8.4, solid(0xb5890f, 0.6, 0.3), -2.9, 4, 1));
  g.add(box(0.7, 0.7, 8.4, solid(0xb5890f, 0.6, 0.3), 2.9, 4, 1));
  g.add(box(6.4, 2.6, 1.4, solid(0x8f8a80, 0.6, 0.4), 0, 1.9, 5.6));    // bucket
  const wheel = (x, z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1, 14), solid(0x1c1c1c, 0.9));
    w.rotation.z = Math.PI / 2; w.position.set(x, 1.25, z); w.castShadow = true;
    return w;
  };
  for (const [x, z] of [[-2.9, 2.2], [2.9, 2.2], [-2.9, -2.2], [2.9, -2.2]]) g.add(wheel(x, z));
  return g;
}

function buildCar(color) {
  const g = new THREE.Group();
  g.add(box(6.4, 1.8, 15, solid(color, 0.45, 0.35), 0, 2.1, 0));
  g.add(box(5.8, 1.9, 7.5, solid(color, 0.4, 0.35), 0, 3.7, -0.4));
  g.add(box(5.2, 1.4, 0.15, mat('glass'), 0, 3.9, 3.4, false)).children.at(-1);
  const wheel = (x, z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.9, 14), solid(0x1c1c1c, 0.9));
    w.rotation.z = Math.PI / 2; w.position.set(x, 1.15, z); w.castShadow = true;
    return w;
  };
  for (const [x, z] of [[-3, 4.6], [3, 4.6], [-3, -4.6], [3, -4.6]]) g.add(wheel(x, z));
  return g;
}

// a person: capsule body, head, hard hat, pose-able tools
function buildPerson({ vest = 0xe87b12, hat = 0xf5b82e, skin = '#c8956c', scale = 1 } = {}) {
  const g = new THREE.Group();
  const skinMat = solid(new THREE.Color(skin), 0.8);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.1, 6, 12), solid(vest, 0.85));
  body.position.y = 2.8; body.castShadow = true;
  g.add(body);
  // hi-vis stripes
  const stripe = box(2, 0.28, 0.4, solid(0xdfe66a, 0.7), 0, 3.3, 0.85, false);
  g.add(stripe);
  g.add(box(0.62, 1.8, 0.62, solid(0x3b4a63, 0.95), -0.5, 0.9, 0));    // legs
  g.add(box(0.62, 1.8, 0.62, solid(0x3b4a63, 0.95), 0.5, 0.9, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 12), skinMat);
  head.position.y = 5.15; head.castShadow = true;
  g.add(head);
  const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), solid(hat, 0.45));
  hatTop.position.y = 5.35; hatTop.castShadow = true;
  g.add(hatTop);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 16), solid(hat, 0.45));
  brim.position.y = 5.32;
  g.add(brim);
  // arms
  const arm = (side) => {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.6, 4, 8), skinMat);
    a.position.set(side * 1.15, 3.2, 0.2);
    a.rotation.z = side * 0.35;
    a.castShadow = true;
    return a;
  };
  g.add(arm(1)); g.add(arm(-1));
  // tools (toggled per pose)
  const tools = {};
  const jack = new THREE.Group();
  jack.add(box(0.3, 3.4, 0.3, solid(0x555a60, 0.6, 0.5), 0, 1.7, 0));
  jack.add(box(1.6, 0.35, 0.35, solid(0x333, 0.7), 0, 3.2, 0));
  jack.add(box(0.16, 1.2, 0.16, solid(0x888, 0.4, 0.8), 0, -0.4, 0));
  jack.position.set(1.4, 0.4, 1);
  tools.jack = jack;
  const screed = new THREE.Group();
  const pole = box(0.16, 0.16, 6.5, solid(0x9aa0a6, 0.4, 0.7), 0, 0, 0);
  pole.rotation.x = 0.5;
  screed.add(pole);
  screed.add(box(3.4, 0.18, 0.6, solid(0xc8ccd0, 0.4, 0.6), 0, -1.5, 2.8));
  screed.position.set(1.1, 3, 1);
  tools.screed = screed; tools.float = screed;
  const broom = new THREE.Group();
  const bp = box(0.14, 0.14, 6, solid(0x8a6a34, 0.8), 0, 0, 0);
  bp.rotation.x = 0.5; broom.add(bp);
  broom.add(box(2.2, 0.5, 0.5, solid(0xa87f38, 0.95), 0, -1.4, 2.6));
  broom.position.set(1.1, 3, 1);
  tools.broom = broom;
  const shovel = new THREE.Group();
  const sp = box(0.14, 0.14, 4.6, solid(0x8a6a34, 0.8), 0, 0, 0);
  sp.rotation.x = 0.6; shovel.add(sp);
  shovel.add(box(1.1, 0.1, 1.4, solid(0x777, 0.5, 0.6), 0, -1.2, 2));
  shovel.position.set(1.2, 2.6, 0.8);
  tools.shovel = shovel;
  for (const k of ['jack', 'screed', 'broom', 'shovel']) { tools[k].visible = false; g.add(tools[k]); }
  g.userData = { tools, pose: 'idle', ph: Math.random() * 6.28 };
  g.scale.setScalar(scale);
  return g;
}
function setPose(person, pose) {
  const u = person.userData;
  u.pose = pose;
  for (const k of ['jack', 'screed', 'broom', 'shovel']) u.tools[k].visible = false;
  const t = { jack:'jack', screed:'screed', float:'screed', broom:'broom', shovel:'shovel' }[pose];
  if (t) u.tools[t].visible = true;
}
function animPerson(person, t) {
  const u = person.userData;
  if (u.pose === 'jack') {
    person.position.y = Math.abs(Math.sin(t * 26 + u.ph)) * 0.12;
    if (u.tools.jack.visible) u.tools.jack.position.y = 0.4 + Math.sin(t * 26) * 0.1;
  } else if (u.pose === 'walk') {
    person.position.y = Math.abs(Math.sin(t * 9 + u.ph)) * 0.22;
    person.rotation.z = Math.sin(t * 9 + u.ph) * 0.05;
  } else {
    person.position.y = Math.sin(t * 2.1 + u.ph) * 0.05 + 0.02;
    person.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.02;
  }
}

function buildDog() {
  const g = new THREE.Group();
  const fur = solid(0x8a6a42, 0.95);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.7, 5, 10), fur);
  body.rotation.z = Math.PI / 2; body.position.y = 1.25; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), solid(0x7a5b36, 0.95));
  head.position.set(1.55, 1.7, 0); head.castShadow = true;
  g.add(head);
  const snout = box(0.5, 0.3, 0.34, solid(0x5f4527, 0.95), 1.95, 1.55, 0);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), solid(0x5f4527, 0.95));
    ear.position.set(1.4, 2.15, s * 0.3);
    g.add(ear);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.75, 0.3], [-0.75, -0.3], [0.75, 0.3], [0.75, -0.3]]) {
    const leg = box(0.18, 1.1, 0.18, fur, lx, 0.55, lz);
    legs.push(leg); g.add(leg);
  }
  const tail = box(0.14, 0.14, 0.9, fur, -1.5, 1.7, 0);
  g.add(tail);
  g.userData = { legs, tail };
  return g;
}
function animDog(dog, t) {
  dog.userData.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 16 + i * 1.7) * 0.7);
  dog.userData.tail.rotation.y = Math.sin(t * 14) * 0.5;
  dog.position.y = Math.abs(Math.sin(t * 8)) * 0.25;
}

// falling weather: snow or leaves
function buildWeather(scene, kind, span = 160) {
  if (!kind) return null;
  const n = 260;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * span;
    pos[i * 3 + 1] = Math.random() * 60;
    pos[i * 3 + 2] = (Math.random() - 0.5) * span;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: kind === 'snow' ? 0xffffff : 0xb07c2c,
    size: kind === 'snow' ? 0.5 : 0.7, transparent: true, opacity: 0.9 });
  const pts = new THREE.Points(geo, m);
  scene.add(pts);
  return { pts, n, span, update(dt) {
    const p = pts.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      p[i * 3 + 1] -= dt * (kind === 'snow' ? 4 : 3);
      p[i * 3] += dt * 1.5;
      if (p[i * 3 + 1] < 0) { p[i * 3 + 1] = 55; p[i * 3] = (Math.random() - 0.5) * span; }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  } };
}

function buildRain(scene, span = 130) {
  const n = 500;
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * span, y = Math.random() * 45, z = (Math.random() - 0.5) * span;
    pos.set([x, y, z, x + 0.5, y - 2.2, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaebfd4, transparent: true, opacity: 0.55 }));
  scene.add(rain);
  return { rain, n, span, update(dt) {
    const p = rain.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      for (const off of [0, 3]) { p[i * 6 + off + 1] -= dt * 55; p[i * 6 + off] += dt * 9; }
      if (p[i * 6 + 1] < 0) {
        const x = (Math.random() - 0.5) * span, z = (Math.random() - 0.5) * span;
        p.set([x, 45, z, x + 0.5, 42.8, z], i * 6);
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;
  } };
}

// simple soft cloud sprites
function addClouds(scene, n = 5, span = 240) {
  const tex = canvasTex('cloud', 128, (x, rnd, s) => {
    x.clearRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const g = x.createRadialGradient(s/2 + (rnd()-0.5)*40, s/2 + (rnd()-0.5)*16, 2, s/2, s/2, 34 + rnd()*20);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
  });
  tex.encoding = THREE.sRGBEncoding;
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false }));
    sp.scale.set(60 + Math.random() * 50, 24 + Math.random() * 14, 1);
    sp.position.set((Math.random() - 0.5) * span, 55 + Math.random() * 25, -60 - Math.random() * 120);
    scene.add(sp);
  }
}

// ============================================================
// TOWN — 3D neighborhood
// ============================================================

const TOWN = { W: 960, H: 540 };   // click-space kept for legacy mapping
const LOTS = Array.from({ length: 10 }, (_, i) => {
  const top = i < 5;
  const col = i % 5;
  return { i, top, wx: -72 + col * 36, wz: top ? -26 : 26 };
});
const ROAD_HALF = 7;

const TownView = {
  state: null, group: null, markers: [], truck: null, weather: null,

  mount(container, markers, onMarker) {
    if (!W3.mount(container, 960, 540)) return false;
    const scene = W3.scene;
    W3.lights([55, 95, 22], 170);      // high sun, sideways shadows the camera can see
    scene.fog = new THREE.Fog(season().sky, 220, 520);
    addClouds(scene);

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 260), mat('grass'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    // road along X at z in [-7, 7]
    const road = new THREE.Mesh(new THREE.PlaneGeometry(400, ROAD_HALF * 2), mat('asphalt'));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.03; road.receiveShadow = true;
    scene.add(road);
    // center dashes
    for (let x = -190; x < 190; x += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xd6b64a, roughness: 0.9 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.12, 0);
      scene.add(dash);
    }
    // curbs + sidewalks
    for (const s of [-1, 1]) {
      const curb = box(400, 0.5, 0.8, mat('concrete'), 0, 0.25, s * (ROAD_HALF + 0.4));
      curb.receiveShadow = true; scene.add(curb);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(400, 5), mat('concrete'));
      walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.06, s * (ROAD_HALF + 3.3));
      walk.receiveShadow = true; scene.add(walk);
    }

    // lots
    for (const lot of LOTS) {
      const facing = lot.top ? 0 : Math.PI;       // face the road
      if (lot.i === 0) {
        // your shop: metal building + gravel yard
        const shop = new THREE.Group();
        shop.add(box(30, 11, 22, solid(0x8a929a, 0.55, 0.5), 0, 5.5, 0));
        const roof = gableRoof(30, 22, 4, solid(0x7c8894, 0.5, 0.6));
        roof.position.y = 11; shop.add(roof);
        shop.add(box(12, 8, 0.4, solid(0x5d666f, 0.6, 0.5), -4, 4, 11.2));
        // sign
        const signTex = canvasTex('sign', 256, (x) => {
          x.fillStyle = '#f5b82e'; x.fillRect(0, 0, 256, 256);
          x.fillStyle = '#1a1408'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center';
          x.fillText('CONCRETE', 128, 118); x.font = 'bold 26px sans-serif';
          x.fillText('& OUTDOOR', 128, 158);
        });
        const sign = box(10, 5, 0.5, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }), 9, 7, 11.3);
        shop.add(sign);
        const gy = new THREE.Mesh(new THREE.PlaneGeometry(42, 34), mat('gravel'));
        gy.rotation.x = -Math.PI / 2; gy.position.y = 0.05; gy.receiveShadow = true;
        shop.add(gy);
        shop.position.set(lot.wx, 0, lot.wz);
        shop.rotation.y = facing;
        scene.add(shop);
        if (typeof owns === 'function' && owns('skid')) {
          const sk = buildSkid(); sk.position.set(lot.wx + 16, 0, lot.wz - 6); sk.rotation.y = 0.5;
          scene.add(sk);
        }
      } else if (lot.i === 4) {
        // city hall
        const ch = new THREE.Group();
        ch.add(box(34, 14, 24, solid(0xb5af9f, 0.85), 0, 7, 0));
        for (let k = 0; k < 5; k++) {
          const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 12, 12), solid(0xd5cfbf, 0.8));
          col2.position.set(-12 + k * 6, 6, 13.2); col2.castShadow = true;
          ch.add(col2);
        }
        ch.add(box(36, 2, 6, solid(0xc4beb0, 0.8), 0, 13, 11.5));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), solid(0x9d9788, 0.6, 0.2));
        dome.position.y = 14; dome.castShadow = true;
        ch.add(dome);
        // steps
        for (let k = 0; k < 3; k++) ch.add(box(16, 0.6, 2, mat('concrete'), 0, 0.3 + k * 0.6, 16 - k * 1.6));
        ch.position.set(lot.wx + 2, 0, lot.wz);
        ch.rotation.y = facing;
        scene.add(ch);
      } else {
        const house = buildHouse(lot.i, { garage: lot.i % 3 === 0 });
        house.position.set(lot.wx, 0, lot.wz);
        house.rotation.y = facing;
        scene.add(house);
        // driveway to the road
        const dLen = Math.abs(lot.wz) - 10 - ROAD_HALF + 2;
        const drv = new THREE.Mesh(new THREE.PlaneGeometry(9, dLen), lot.i % 2 ? mat('oldConcrete') : mat('concrete'));
        drv.rotation.x = -Math.PI / 2;
        drv.position.set(lot.wx + 8, 0.06, lot.top ? lot.wz + 10 + dLen / 2 : lot.wz - 10 - dLen / 2);
        drv.receiveShadow = true;
        scene.add(drv);
        if (lot.i % 3 === 1) {
          const car = buildCar(CAR_COLORS[lot.i % CAR_COLORS.length]);
          car.position.set(lot.wx + 8, 0, lot.top ? lot.wz + 13 : lot.wz - 13);
          car.rotation.y = lot.top ? 0 : Math.PI;
          car.scale.setScalar(0.75);
          scene.add(car);
        }
      }
    }

    // trees
    for (const [tx, tz, s, sd] of [[-88, -42, 1.2, 1], [-20, -44, 1.4, 2], [55, -45, 1, 3], [95, -40, 1.2, 9], [-95, 42, 1.3, 4], [-30, 45, 1.1, 5], [30, 44, 1.3, 6], [88, 43, 1.1, 7]])
      { const tr = buildTree(sd, s); tr.position.set(tx, 0, tz); scene.add(tr); }

    // markers
    this.markers = [];
    for (const m of markers) {
      const lot = LOTS[m.lot];
      const g = new THREE.Group();
      const pinTex = canvasTex('pin' + (m.story ? 'S' : 'D'), 128, (x) => {
        x.fillStyle = m.story ? '#f5b82e' : '#f4f2ec';
        x.beginPath(); x.arc(64, 50, 40, 0, 7); x.fill();
        x.beginPath(); x.moveTo(36, 78); x.lineTo(64, 118); x.lineTo(92, 78); x.closePath(); x.fill();
        x.fillStyle = m.story ? '#1a1408' : '#2e7d32';
        x.font = 'bold 52px sans-serif'; x.textAlign = 'center';
        x.fillText(m.story ? '★' : '$', 64, 68);
      });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex, transparent: true }));
      sp.scale.set(9, 9, 1);
      g.position.set(lot.wx, 17, lot.wz);
      g.add(sp);
      g.userData.marker = m;
      scene.add(g);
      this.markers.push(g);
    }

    // your truck
    this.truck = buildPickup();
    this.truck.position.set(-58, 0, 12);
    this.truck.rotation.y = Math.PI / 2;
    scene.add(this.truck);

    this.weather = buildWeather(scene, season().snow ? 'snow' : (season().leaves ? 'leaf' : null), 220);

    // camera: high 3/4 view with a slow drift
    W3.camera.position.set(0, 115, 125);
    W3.camera.lookAt(0, 0, -2);
    W3.onFrame = (t, dt) => {
      W3.camera.position.x = Math.sin(t * 0.07) * 8;
      W3.camera.lookAt(0, 0, -2);
      this.markers.forEach((g, i) => g.position.y = 17 + Math.sin(t * 2.6 + i) * 1.2);
      if (this.weather) this.weather.update(dt);
      if (this._drive) this._drive(dt);
    };
    W3.onClick = ray => {
      const hits = ray.intersectObjects(this.markers, true);
      if (hits.length) {
        let g = hits[0].object;
        while (g && !g.userData.marker) g = g.parent;
        if (g && onMarker) onMarker(g.userData.marker);
      }
    };
    return true;
  },

  driveTo(lotIndex, cb) {
    if (!W3.renderer || !this.truck) return cb();
    const lot = LOTS[lotIndex];
    const path = [
      new THREE.Vector3(this.truck.position.x, 0, 3.5),
      new THREE.Vector3(lot.wx + 8, 0, lot.top ? -3.5 : 3.5),
      new THREE.Vector3(lot.wx + 8, 0, lot.top ? -14 : 14),
    ];
    let leg = 0;
    this._drive = (dt) => {
      const target = path[leg];
      const d = target.clone().sub(this.truck.position); d.y = 0;
      const dist = d.length();
      if (dist < 1) { leg++; if (leg >= path.length) { this._drive = null; setTimeout(cb, 300); } return; }
      d.normalize();
      this.truck.position.addScaledVector(d, dt * 26);
      this.truck.rotation.y = Math.atan2(d.x, d.z);
    };
  },
};

// legacy shims used by game.js
function townState() {
  const markers = [];
  const used = new Set([0, 4]);
  const ch = chapterDef();
  if (!G.storyDone[ch.id]) {
    const lot = STORY_LOTS[ch.id] || 2;
    markers.push({ lot, story: true });
    used.add(lot);
  }
  for (const lead of G.leads) {
    if (lead.lot === undefined || used.has(lead.lot)) {
      const free = LOTS.map(l => l.i).filter(i => !used.has(i));
      lead.lot = free.length ? free[Math.floor(Math.random() * free.length)] : 6;
    }
    used.add(lead.lot);
    markers.push({ lot: lead.lot, story: false, job: lead });
  }
  return { markers };
}

// ============================================================
// JOB SITE — 3D lot, slab work happens here
// ============================================================

const SITE = { W: 960, H: 430 };

function slabRect(job) {   // legacy shape used by minigames for grid math
  return { x: 0, y: 0, w: job.len, h: job.wid };
}

const Site3D = {
  create(container, job, height = 430) {
    if (!W3.mount(container, 960, height)) return null;
    const scene = W3.scene;
    const sun = W3.lights([42, 78, 18]);
    scene.fog = new THREE.Fog(season().sky, 110, 340);
    addClouds(scene, 4);

    const L = job.len, Wd = job.wid;
    const site = {
      job, L, Wd, people: [], anims: [], group: new THREE.Group(),
      player: null, dog: null, rainFx: null, weather: null,
    };
    scene.add(site.group);

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), mat('grass'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    // customer's house behind the slab (-z)
    const house = buildHouse((job.name || '').length, { w: Math.max(30, L * 0.8), d: 24, hgt: 10, garage: !!JOB_TYPES[job.type].interior });
    house.position.set(0, 0, -Wd / 2 - 24);
    scene.add(house);
    // front walk
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 12), mat('concrete'));
    walk.rotation.x = -Math.PI / 2; walk.position.set(-L * 0.28, 0.06, -Wd / 2 - 6);
    walk.receiveShadow = true;
    scene.add(walk);
    // customer out front, supervising in a cardigan
    const customer = buildPerson({ vest: 0x6e5a48, hat: 0xbfb9ac, skin: '#d4a276', scale: 0.92 });
    customer.position.set(-L * 0.28, 0, -Wd / 2 - 8);
    scene.add(customer);
    site.people.push(customer);

    // street in front (+z) with curb
    const street = new THREE.Mesh(new THREE.PlaneGeometry(260, 14), mat('asphalt'));
    street.rotation.x = -Math.PI / 2; street.position.set(0, 0.03, Wd / 2 + 26);
    street.receiveShadow = true;
    scene.add(street);
    scene.add(box(260, 0.5, 0.8, mat('concrete'), 0, 0.25, Wd / 2 + 18.8));

    // hedges along the property lines
    for (const sx of [-1, 1]) {
      for (let z = -Wd / 2 - 20; z < Wd / 2 + 12; z += 6) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 + (Math.abs(z * 7) % 10) / 10, 1),
          new THREE.MeshStandardMaterial({ color: 0x2c4a20, roughness: 1, flatShading: true }));
        b.position.set(sx * (Math.max(L / 2 + 20, 40)), 2, z);
        b.castShadow = true;
        scene.add(b);
      }
    }
    // trees
    const t1 = buildTree(3, 1.3); t1.position.set(-L / 2 - 14, 0, -Wd / 2 - 6); scene.add(t1);
    const t2 = buildTree(8, 1.1); t2.position.set(L / 2 + 13, 0, -Wd / 2 - 2); scene.add(t2);

    // your pickup at the curb + staged lumber
    const truck = buildPickup();
    truck.position.set(-L / 2 - 16, 0, Wd / 2 + 13);
    truck.rotation.y = Math.PI / 2 + 0.08;
    scene.add(truck);
    for (let k = 0; k < 2; k++)
      scene.add(box(8, 0.8, 2.4, mat('wood'), -L / 2 - 4, 0.4 + k * 0.85, Wd / 2 + 12));

    // the work zone: form boards + stakes around slab area (origin-centered)
    site.forms = new THREE.Group();
    const fbMat = mat('wood');
    site.forms.add(box(L + 1, 0.9, 0.5, fbMat, 0, 0.45, -Wd / 2 - 0.3));
    site.forms.add(box(L + 1, 0.9, 0.5, fbMat, 0, 0.45, Wd / 2 + 0.3));
    site.forms.add(box(0.5, 0.9, Wd + 1, fbMat, -L / 2 - 0.3, 0.45, 0));
    site.forms.add(box(0.5, 0.9, Wd + 1, fbMat, L / 2 + 0.3, 0.45, 0));
    const nStakes = Math.round(L / 6);
    for (let i = 0; i <= nStakes; i++) {
      for (const s of [-1, 1])
        site.forms.add(box(0.3, 1.6, 0.3, solid(0x6e5426, 0.9), -L / 2 + i * L / nStakes, 0.8, s * (Wd / 2 + 0.8)));
    }
    scene.add(site.forms);

    // crew members standing by
    ((typeof G !== 'undefined' && G && G.crew) || []).forEach((c, k) => {
      const p = buildPerson({ vest: 0xe87b12, skin: c.skin || '#c8956c' });
      p.position.set(-L / 2 - 8, 0, -Wd / 2 + 4 + k * 8);
      p.rotation.y = 1.2;
      setPose(p, 'shovel');
      scene.add(p);
      site.people.push(p);
    });

    // the foreman (you): white hat, lime vest
    site.player = buildPerson({ vest: 0xb9cc1e, hat: 0xf2f0e8 });
    site.player.position.set(-L / 2 - 6, 0, Wd / 2 + 8);
    scene.add(site.player);
    site.people.push(site.player);
    site._move = null;

    site.weather = buildWeather(scene, season().snow ? 'snow' : null, 160);

    // camera: cinematic 3/4 from the street side
    const span = Math.max(L, Wd);
    const camR = span * 0.95 + 26;
    W3.camera.position.set(-span * 0.25, camR * 0.62, Wd / 2 + camR * 0.72);
    W3.camera.lookAt(0, 0, 0);

    W3.onFrame = (t, dt) => {
      W3.camera.position.x = -span * 0.25 + Math.sin(t * 0.1) * 3;
      W3.camera.lookAt(0, 0, 0);
      site.people.forEach(p => animPerson(p, t));
      if (site.dog && site.dog.visible) animDog(site.dog, t);
      if (site.mixerG && site.mixerG.visible) site.mixerG.userData.drum.rotation.y += dt * 1.4;
      if (site.rainFx) site.rainFx.update(dt);
      if (site.weather) site.weather.update(dt);
      if (site._move) site._move(dt);
      if (site.onTick) site.onTick(t, dt);
    };

    // --- site API used by the minigames ---

    site.groundPoint = (ray) => {
      const pt = new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt);
      return pt;
    };
    site.cellAt = (pt, cols, rows) => {
      const cx = Math.floor((pt.x + L / 2) / (L / cols));
      const cz = Math.floor((pt.z + Wd / 2) / (Wd / rows));
      if (cx < 0 || cx >= cols || cz < 0 || cz >= rows) return -1;
      return cz * cols + cx;
    };
    site.cellCenter = (i, cols, rows) => new THREE.Vector3(
      -L / 2 + (i % cols + 0.5) * (L / cols), 0, -Wd / 2 + (Math.floor(i / cols) + 0.5) * (Wd / rows));

    site.movePlayer = (target, cb) => {
      setPose(site.player, 'walk');
      site._move = (dt) => {
        const d = target.clone().sub(site.player.position); d.y = 0;
        const dist = d.length();
        if (dist < 1.2) {
          site._move = null;
          site.player.rotation.y = Math.atan2(d.x, d.z);
          if (cb) cb();
          return;
        }
        d.normalize();
        site.player.position.addScaledVector(d, dt * 26);
        site.player.rotation.y = Math.atan2(d.x, d.z);
      };
    };
    site.playerPose = p => setPose(site.player, p);

    site.setSun = (dim) => { sun.intensity = dim ? 0.45 : 1.15; };
    site.rain = (on) => {
      if (on && !site.rainFx) {
        site.rainFx = buildRain(scene);
        site.setSun(true);
        scene.fog.near = 40; scene.fog.far = 180;
      }
    };
    site.showDog = () => {
      if (!site.dog) { site.dog = buildDog(); scene.add(site.dog); }
      site.dog.visible = true;
      site.dog.position.set(-L / 2 - 24, 0, 2);
      site.dog.rotation.y = Math.PI / 2;
    };
    site.dogX = (x01) => { if (site.dog) site.dog.position.x = -L / 2 - 24 + x01 * (L + 30); };
    site.hideDog = () => { if (site.dog) site.dog.visible = false; };
    site.pawprints = () => {
      const pawMat = solid(0x2a241d, 1);
      for (let k = 0; k < 9; k++) {
        const paw = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), pawMat);
        paw.rotation.x = -Math.PI / 2;
        paw.position.set(-L / 2 + 3 + k * (L - 6) / 9, 0.42, (k % 2 ? 1.2 : -0.6));
        scene.add(paw);
      }
    };
    site.showInspector = () => {
      const insp = buildPerson({ vest: 0x7c7460, hat: 0xe8e4da, scale: 0.95 });
      insp.position.set(L / 2 + 9, 0, -2);
      insp.rotation.y = -1.4;
      scene.add(insp);
      site.people.push(insp);
    };

    // --- DEMO: the old slab in breakable chunks -------------------------------
    site.demoInit = (cols, rows, hpMax) => {
      site.chunks = [];
      const cw = L / cols, ch = Wd / rows;
      site.forms.visible = false;                     // nothing formed yet
      const dirt = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), mat('dirt'));
      dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.02; dirt.receiveShadow = true;
      site.group.add(dirt);
      for (let i = 0; i < cols * rows; i++) {
        const c = site.cellCenter(i, cols, rows);
        const g = new THREE.Group();
        g.position.copy(c);
        const slab = box(cw - 0.25, 0.5, ch - 0.25, mat('oldConcrete'), 0, 0.28, 0);
        // deterministic weathered tilt
        slab.rotation.set(((i * 37) % 10 - 5) * 0.004, 0, ((i * 53) % 10 - 5) * 0.004);
        g.add(slab);
        // rubble pile (hidden until broken)
        const pile = new THREE.Group();
        let a = i * 997 + 13;
        const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        for (let k = 0; k < 6; k++) {
          const r = box(0.6 + rnd() * (cw * 0.3), 0.35 + rnd() * 0.4, 0.6 + rnd() * (ch * 0.3),
            mat('rubble'), (rnd() - 0.5) * cw * 0.6, 0.3 + rnd() * 0.3, (rnd() - 0.5) * ch * 0.6);
          r.rotation.set(rnd() * 0.6, rnd() * 3, rnd() * 0.6);
          pile.add(r);
        }
        pile.visible = false;
        g.add(pile);
        g.userData = { slab, pile };
        site.group.add(g);
        site.chunks.push(g);
      }
    };
    site.demoSet = (i, hpLeft, hpMax) => {
      const c = site.chunks && site.chunks[i];
      if (!c) return;
      if (hpLeft <= 0) { c.userData.slab.visible = false; c.userData.pile.visible = true; }
      else {
        const f = hpLeft / hpMax;
        c.userData.slab.rotation.x = (1 - f) * 0.06;
        c.userData.slab.position.y = 0.28 - (1 - f) * 0.12;
        c.userData.slab.material = mat('rubble');   // cracked look as damage grows
        if (f > 0.66) c.userData.slab.material = mat('oldConcrete');
      }
    };
    site.puffAt = (i, cols, rows) => {
      const c = site.cellCenter(i, cols, rows);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xc8c3b4, transparent: true, opacity: 0.5 }));
      puff.position.set(c.x, 1, c.z);
      W3.scene.add(puff);
      const t0 = W3.t;
      const iv = setInterval(() => {
        const dt2 = W3.t - t0;
        puff.scale.setScalar(1 + dt2 * 4);
        puff.material.opacity = Math.max(0, 0.5 - dt2 * 0.9);
        if (dt2 > 0.6) { clearInterval(iv); W3.scene.remove(puff); }
      }, 40);
    };

    // --- POUR: gravel base, wet cells, the mixer ------------------------------
    site.pourInit = (cols, rows) => {
      site.cells = [];
      const cw = L / cols, ch = Wd / rows;
      const base = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), mat('gravel'));
      base.rotation.x = -Math.PI / 2; base.position.y = 0.05; base.receiveShadow = true;
      site.group.add(base);
      for (let i = 0; i < cols * rows; i++) {
        const c = site.cellCenter(i, cols, rows);
        const cell = box(cw - 0.12, 0.42, ch - 0.12, mat('wetConcrete'), c.x, 0.24, c.z);
        cell.visible = false;
        site.group.add(cell);
        site.cells.push(cell);
      }
      // the mixer truck: backed up along the left form line, hopper toward the slab
      site.mixerG = buildMixer();
      site.mixerG.position.set(-L / 2 - 16, 0, 2);
      site.mixerG.rotation.y = -Math.PI / 2;          // cab away, rear at the forms
      scene.add(site.mixerG);
      // chute + mud stream, hung off the hopper
      site.chute = new THREE.Group();
      const c1 = box(0.9, 0.3, 9, solid(0xb5b1a8, 0.5, 0.5), 0, 0, 4.5);
      site.chute.add(c1);
      site.chute.position.set(-L / 2 - 6, 5.5, 2);
      scene.add(site.chute);
      site.mud = [];
      for (let k = 0; k < 6; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), mat('wetConcrete'));
        m.visible = false;
        scene.add(m);
        site.mud.push(m);
      }
      site._pourTargetPt = null;
    };
    site.pourTarget = (i, cols, rows) => {
      if (i == null || i < 0) { site._pourTargetPt = null; site.mud.forEach(m => m.visible = false); return; }
      const c = site.cellCenter(i, cols, rows);
      site._pourTargetPt = c;
      const from = site.chute.position;
      site.chute.lookAt(c.x, 0.6, c.z);
    };
    // animate mud stream along the chute in ticks
    site._mudT = 0;
    const oldTick = site.onTick;
    site.onTick = (t, dt) => {
      if (site._pourTargetPt) {
        site.mud.forEach((m, k) => {
          const f = ((t * 0.9 + k / 6) % 1);
          const from = new THREE.Vector3().copy(site.chute.position);
          const to = site._pourTargetPt;
          m.visible = true;
          m.position.lerpVectors(from, new THREE.Vector3(to.x, 0.5, to.z), f);
          m.position.y += Math.sin(f * Math.PI) * 2.2;
        });
      }
      if (site._extraTick) site._extraTick(t, dt);
    };
    site.pourSet = (i, screeded) => {
      const cell = site.cells && site.cells[i];
      if (!cell) return;
      cell.visible = true;
      cell.position.y = screeded ? 0.24 : 0.3;
      cell.scale.y = screeded ? 1 : 1.25;
    };

    // --- FINISH: one curing slab, marks appear as you work --------------------
    site.finishInit = () => {
      site.slab = box(L - 0.1, 0.45, Wd - 0.1, new THREE.MeshPhongMaterial({
        map: canvasTex('wet', 256, speckle('#6f6b64', 1600, 60), { repeat: 3 }),
        color: 0xffffff, shininess: 60, specular: 0x8b95a2 }), 0, 0.26, 0);
      site.group.add(site.slab);
      // bleed sheen overlay
      site.sheen = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.4, Wd - 0.4),
        new THREE.MeshPhongMaterial({ color: 0xdfe9f5, transparent: true, opacity: 0, shininess: 130, specular: 0xffffff }));
      site.sheen.rotation.x = -Math.PI / 2; site.sheen.position.y = 0.5;
      site.group.add(site.sheen);
      site.marks = new THREE.Group();
      site.group.add(site.marks);
    };
    site.finishSurface = (p, bleedOn) => {
      if (!site.slab) return;
      const m = site.slab.material;
      m.color.setRGB(0.72 + p * 0.5, 0.71 + p * 0.5, 0.68 + p * 0.5);
      m.shininess = Math.max(5, 60 - p * 55);
      site.sheen.material.opacity = bleedOn ? 0.24 + Math.sin(W3.t * 2) * 0.08 : 0;
    };
    site.finishMark = (kind) => {
      const dark = solid(0x55524b, 0.95);
      if (kind === 'edge') {
        const f = new THREE.Group();
        f.add(box(L - 1.4, 0.03, 0.16, dark, 0, 0.5, -Wd / 2 + 0.8, false));
        f.add(box(L - 1.4, 0.03, 0.16, dark, 0, 0.5, Wd / 2 - 0.8, false));
        f.add(box(0.16, 0.03, Wd - 1.4, dark, -L / 2 + 0.8, 0.5, 0, false));
        f.add(box(0.16, 0.03, Wd - 1.4, dark, L / 2 - 0.8, 0.5, 0, false));
        site.marks.add(f);
      } else if (kind === 'broom') {
        site.slab.material.bumpMap = canvasTex('broom', 128, (x, rnd, s) => {
          x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
          for (let xx = 0; xx < s; xx += 3) {
            x.fillStyle = `rgba(30,30,30,${0.3 + rnd() * 0.3})`;
            x.fillRect(xx, 0, 1.2, s);
          }
        }, { bump: true, repeat: 6 });
        site.slab.material.bumpScale = 0.05;
        site.slab.material.needsUpdate = true;
      } else if (kind === 'swirl') {
        for (let k = 0; k < 6; k++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 6, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(-L / 2 + (k * 89 % 97) / 97 * L, 0.5, -Wd / 2 + (k * 53 % 89) / 89 * Wd);
          site.marks.add(ring);
        }
      }
    };
    site.finishJoints = (vCuts, hCuts) => {
      const jm = solid(0x3e3b35, 0.95);
      (vCuts || []).forEach(f => site.marks.add(box(0.14, 0.04, Wd - 0.3, jm, -L / 2 + f, 0.5, 0, false)));
      (hCuts || []).forEach(f => site.marks.add(box(L - 0.3, 0.04, 0.14, jm, 0, 0.5, -Wd / 2 + f, false)));
    };
    site.trowelMachine = (spinning) => {
      if (!site.trowelG) {
        site.trowelG = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.14, 8, 24), solid(0x9aa0a6, 0.4, 0.6));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.8;
        site.trowelG.add(ring);
        const blades = new THREE.Group();
        for (let k = 0; k < 4; k++) {
          const b = box(1.7, 0.06, 0.5, solid(0xc8ccd0, 0.35, 0.7), 0.9, 0, 0, false);
          const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; h.add(b);
          blades.add(h);
        }
        blades.position.y = 0.55;
        site.trowelG.add(blades);
        site.trowelG.userData.blades = blades;
        const handle = box(0.16, 0.16, 5, solid(0x666, 0.6, 0.5), 0, 2.2, -3);
        handle.rotation.x = 0.6;
        site.trowelG.add(handle);
        site.trowelG.position.set(L / 2 + 7, 0, Wd / 2 - 4);
        scene.add(site.trowelG);
      }
      site.trowelG.userData.spin = spinning;
      if (!site._extraTick) site._extraTick = (t, dt) => {
        if (site.trowelG && site.trowelG.userData.spin) site.trowelG.userData.blades.rotation.y += dt * 9;
      };
    };

    site.dispose = () => W3.unmount();
    return site;
  },
};
