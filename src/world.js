import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';

export const C = {
  paper: 0xdfe1e2, ink: 0x16181c, blue: 0x1e4bd2, red: 0xd8281e, white: 0xf7f6f2,
  graphite: 0x3a3f46, mid: 0x8b9198, light: 0xc4c8cc, board: 0xf1efe8, pcb: 0xe6e8ea,
  metal: 0xb4b9be, gold: 0xc2a04a, ochre: 0xb8892b,
};
export const TYPE_COLOR = { OK: C.blue, CONSULTA: C.white, SOS: C.red };

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o });
export function box(w, h, d, m, x = 0, y = 0, z = 0, r = 0) {
  const g = r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
}
export function cyl(r, h, m, x = 0, y = 0, z = 0, seg = 28, r2 = r) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), m); me.position.set(x, y, z);
  me.castShadow = true; me.receiveShadow = true; return me;
}
function tube(points, radius, m) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const me = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 8), m); me.castShadow = true; return me;
}
export function textTexture(text, { w = 256, h = 96, bg = '#16181c', fg = '#f7f6f2', font = '600 56px "Barlow Condensed", sans-serif', align = 'center' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textBaseline = 'middle'; g.textAlign = align;
  g.fillText(text, align === 'center' ? w / 2 : 10, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ----------------------------------------------------------------------------- nodo
function protoTexture() {
  const c = document.createElement('canvas'); c.width = 1328; c.height = 440; const g = c.getContext('2d');
  g.fillStyle = '#f1efe8'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#b9b6ad';
  const s = 20.4;
  for (let i = 0; i < 63; i++) for (let j = 0; j < 17; j++) {
    if (j === 2 || j === 8 || j === 14) continue;
    if ((j < 2 || j > 14) && i % 6 === 5) continue;
    g.fillRect(24 + i * s, 30 + j * 23.6, 6, 6);
  }
  g.fillStyle = '#d8281e'; g.fillRect(20, 20, c.width - 40, 2.5); g.fillRect(20, c.height - 78, c.width - 40, 2.5);
  g.fillStyle = '#1e4bd2'; g.fillRect(20, 76, c.width - 40, 2.5); g.fillRect(20, c.height - 22, c.width - 40, 2.5);
  g.fillStyle = '#d9d6cc'; g.fillRect(0, c.height / 2 - 7, c.width, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function makeNode(id) {
  const node = new THREE.Group(); node.name = 'node' + id;
  const parts = {};
  const part = (name, ex) => { const g = new THREE.Group(); g.userData.ex = new THREE.Vector3(...ex); g.userData.k = 0; node.add(g); parts[name] = g; return g; };

  // protoboard
  const pb = part('board', [0, 0, 0]);
  pb.add(box(16.6, 0.9, 5.5, mat(C.board), 0, 0.45, 0, 0.12));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 5.4), new THREE.MeshStandardMaterial({ map: protoTexture(), roughness: 0.9 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.905; top.receiveShadow = true; pb.add(top);

  // Heltec
  const hx = -4.9;
  const h = part('heltec', [-3.2, 3.0, 0.5]);
  h.add(box(5.1, 0.16, 2.55, mat(C.pcb, { roughness: 0.6 }), hx, 1.85, 0));
  h.add(box(4.6, 0.85, 0.25, mat(C.ink), hx, 1.34, 1.14)); h.add(box(4.6, 0.85, 0.25, mat(C.ink), hx, 1.34, -1.14));
  h.add(box(0.9, 0.32, 0.75, mat(C.metal, { metalness: 0.7, roughness: 0.35 }), hx + 2.3, 2.02, 0));          // USB-C
  h.add(box(1.0, 0.22, 1.0, mat(C.metal, { metalness: 0.7, roughness: 0.4 }), hx - 1.7, 2.04, 0.25));          // blindaje radio
  h.add(box(0.7, 0.14, 0.7, mat(C.ink), hx + 1.2, 1.98, -0.55));                                                 // ESP32-S3
  h.add(cyl(0.11, 0.14, mat(C.gold, { metalness: 0.8, roughness: 0.3 }), hx - 2.25, 1.99, -0.9));               // IPEX
  h.add(cyl(0.12, 0.12, mat(C.white), hx + 1.9, 1.99, 0.95)); h.add(cyl(0.12, 0.12, mat(C.white), hx + 1.9, 1.99, -0.95));

  // OLED
  const o = part('oled', [-1, 5.8, 0]);
  o.add(box(2.7, 0.2, 1.5, mat(0x0c0d10, { roughness: 0.25 }), hx - 0.1, 2.03, 0));
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.18), new THREE.MeshBasicMaterial({ map: tex }));
  scr.rotation.x = -Math.PI / 2; scr.position.set(hx - 0.1, 2.135, 0); o.add(scr);

  // antena
  const a = part('antenna', [-4.2, 2.6, -1.2]);
  const am = mat(C.ink, { roughness: 0.5 });
  a.add(tube([[hx - 2.25, 2.0, -0.9], [hx - 2.7, 2.3, -1.4], [-7.9, 1.6, -2.0], [-7.9, 1.0, -2.2]], 0.05, am));
  a.add(cyl(0.2, 0.5, mat(C.gold, { metalness: 0.8, roughness: 0.3 }), -7.9, 1.15, -2.2));
  a.add(cyl(0.14, 5.4, am, -7.9, 4.1, -2.2)); a.add(cyl(0.2, 0.9, am, -7.9, 1.85, -2.2));
  const tip = new THREE.Object3D(); tip.position.set(-7.9, 6.8, -2.2); a.add(tip);

  // pulsadores
  const b = part('buttons', [3.0, 1.5, 2.4]);
  const btns = [];
  [['OK', C.blue, -0.6], ['CONSULTA', C.white, 1.6], ['SOS', C.red, 3.8]].forEach(([tipo, col, x]) => {
    b.add(box(1.2, 0.55, 1.2, mat(C.ink), x, 1.18, 0.9, 0.06));
    const cap = cyl(0.42, 0.5, mat(col, { roughness: 0.45 }), x, 1.62, 0.9);
    cap.userData = { tipo, node: id, y0: 1.62 }; b.add(cap); btns.push(cap);
  });

  // LED + resistencia
  const l = part('led', [3.4, 4.6, -1.5]);
  const ledMat = mat(0x9c2a22, { roughness: 0.3 });
  const led = cyl(0.26, 0.5, ledMat, 5.5, 1.3, -1.0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ledMat); dome.position.set(5.5, 1.55, -1.0);
  l.add(led, dome);
  const r1 = cyl(0.12, 0.9, mat(0xcdb892), 6.7, 1.05, -1.0, 14); r1.rotation.z = Math.PI / 2; l.add(r1);
  const ledLight = new THREE.PointLight(0xff5544, 0, 9, 2); ledLight.position.set(5.5, 2.0, -1.0); l.add(ledLight);

  // zumbador + transistor
  const z = part('buzzer', [5.4, 2.7, 1.4]);
  z.add(cyl(0.62, 0.95, mat(C.ink, { roughness: 0.55 }), 6.9, 1.38, 0.95));
  z.add(cyl(0.12, 0.02, mat(0x000000), 6.9, 1.862, 0.95));
  const tr = cyl(0.26, 0.5, mat(0x101114), 5.5, 1.2, 1.25, 20); z.add(tr);
  const r2 = cyl(0.12, 0.9, mat(0xcdb892), 5.4, 1.05, 0.2, 14); r2.rotation.x = Math.PI / 2; z.add(r2);
  const buz = new THREE.Object3D(); buz.position.set(6.9, 1.9, 0.95); z.add(buz);

  // cables
  const w = part('wires', [0, 1.2, 0]);
  const wire = (pts, col) => w.add(tube(pts, 0.065, mat(col, { roughness: 0.55 })));
  wire([[-3.4, 1.0, 1.9], [-2.4, 2.1, 2.2], [-1.2, 2.0, 2.0], [-0.6, 1.0, 1.9]], C.blue);
  wire([[-3.0, 1.0, 2.3], [-1.5, 2.6, 2.6], [0.6, 2.5, 2.4], [1.6, 1.0, 1.9]], 0xdedcd4);
  wire([[-2.6, 1.0, -1.9], [-0.8, 2.9, -2.4], [2.6, 2.8, -0.2], [3.8, 1.0, 1.9]], C.red);
  wire([[-3.8, 1.0, -1.9], [-1.0, 2.2, -2.6], [4.0, 2.2, -2.4], [5.5, 1.0, -1.7]], C.ochre);
  wire([[-4.4, 1.0, -2.3], [0, 1.9, -2.7], [5.6, 2.0, -0.6], [5.4, 1.0, 0.8]], C.graphite);
  wire([[7.6, 1.0, 0.95], [7.9, 1.6, 0.2], [7.9, 1.5, -1.6], [7.5, 1.0, -2.3]], C.ink);

  for (const g of Object.values(parts)) g.userData.home = g.position.clone();

  node.userData = { id, parts, btns, canvas, tex, tip, buz, ledMat, ledLight, wires: w };
  return node;
}

export function explodeNode(node, k, dur = 1.4) {
  const { parts, wires } = node.userData;
  Object.values(parts).forEach((g, i) => {
    const t = g.userData.home.clone().addScaledVector(g.userData.ex, k);
    gsap.to(g.position, { x: t.x, y: t.y, z: t.z, duration: dur, ease: 'power3.inOut', delay: k ? i * 0.07 : (6 - i) * 0.04, overwrite: true });
  });
  wires.traverse(o => { if (o.material) { o.material.transparent = true; gsap.to(o.material, { opacity: k ? 0.12 : 1, duration: 0.8, overwrite: true }); } });
}

export function setLed(node, on) {
  const u = node.userData;
  u.ledMat.color.setHex(on ? 0xff4a38 : 0x9c2a22);
  u.ledMat.emissive.setHex(on ? 0xd8281e : 0x000000);
  u.ledLight.intensity = on ? 14 : 0;
}

export function pressButton(cap) {
  gsap.timeline().to(cap.position, { y: cap.userData.y0 - 0.2, duration: 0.07 }).to(cap.position, { y: cap.userData.y0, duration: 0.25, ease: 'back.out(3)' });
}

// ----------------------------------------------------------------------------- ondas
const ringGeo = new THREE.RingGeometry(0.975, 1, 96);
export function emitRing(scene, pos, { color = C.ink, max = 22, dur = 2.2, vertical = false, opacity = 0.7 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const r = new THREE.Mesh(ringGeo, m); r.position.copy(pos);
  if (!vertical) r.rotation.x = -Math.PI / 2;
  r.scale.setScalar(0.3); scene.add(r);
  gsap.to(r.scale, { x: max, y: max, z: max, duration: dur, ease: 'power1.out' });
  gsap.to(m, { opacity: 0, duration: dur, ease: 'power1.in', onComplete: () => { scene.remove(r); m.dispose(); } });
}

// ----------------------------------------------------------------------------- paquete
export function makePacket(fields) {
  // fields: [{t:'CSOS', bg, fg}]
  const g = new THREE.Group(); let x = 0; const hgt = 0.95;
  const slabs = [];
  fields.forEach(f => {
    const wUnits = Math.max(0.9, f.t.length * 0.46 + 0.5);
    const tex = textTexture(f.t, { w: Math.round(wUnits * 100), h: 96, bg: f.bg, fg: f.fg, font: '500 54px "IBM Plex Mono", monospace' });
    const mFace = new THREE.MeshBasicMaterial({ map: tex });
    const mSide = new THREE.MeshStandardMaterial({ color: new THREE.Color(f.bg), roughness: 0.7 });
    const me = new THREE.Mesh(new THREE.BoxGeometry(wUnits, hgt, 0.5), [mSide, mSide, mSide, mSide, mFace, mFace]);
    me.position.x = x + wUnits / 2; me.castShadow = true; g.add(me); slabs.push(me);
    x += wUnits + 0.08;
  });
  slabs.forEach(s => s.position.x -= x / 2);
  g.userData.slabs = slabs;
  return g;
}

// ----------------------------------------------------------------------------- ciudad
export function makeCity() {
  const g = new THREE.Group();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.add(box(64, 0.5, 40, mat(0xd2d5d7), 0, 0.25, 0));
  const shades = [0xf2f1ed, 0xe6e7e8, 0xc9cdd0, 0xb4b9be, 0xeceae4];
  const roofs = [];
  for (let ix = -5; ix <= 5; ix++) for (let iz = -3; iz <= 3; iz++) {
    if (rnd() < 0.2) continue;
    const w = 2.6 + rnd() * 1.6, d = 2.6 + rnd() * 1.4, hh = 1.5 + Math.pow(rnd(), 1.7) * 9;
    const x = ix * 5.4 + (rnd() - 0.5), z = iz * 5.2 + (rnd() - 0.5);
    const b = box(w, hh, d, mat(shades[(rnd() * shades.length) | 0]), x, 0.5 + hh / 2, z);
    g.add(b); roofs.push(new THREE.Vector3(x, 0.5 + hh, z));
  }
  const towers = [];
  [[-19, 0, -6], [1, 0, 9], [20, 0, -8]].forEach(([x, , z], i) => {
    const t = new THREE.Group(); t.position.set(x + 2.7, 0.5, z + 2.6); t.scale.setScalar(1.35);
    const m = mat(C.graphite);
    t.add(box(0.35, 15, 0.35, m, 0, 7.5, 0));
    [11, 13, 14.6].forEach((y, k) => { t.add(box(2.2 - k * 0.5, 0.18, 0.18, m, 0, y, 0)); t.add(box(0.18, 0.18, 2.2 - k * 0.5, m, 0, y, 0)); });
    [[0.9, 0], [-0.9, 0], [0, 0.9]].forEach(([px, pz]) => t.add(box(0.3, 1.5, 0.3, mat(C.white), px, 13.6, pz)));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: C.blue })); lamp.position.y = 15.3; t.add(lamp);
    const top = new THREE.Object3D(); top.position.y = 14.2; t.add(top);
    t.userData = { lamp, top, mats: m, links: [] };
    g.add(t); towers.push(t);
  });
  // teléfonos y enlaces
  const dotGeo = new THREE.SphereGeometry(0.36, 10, 8);
  const links = [];
  for (let i = 0; i < 18; i++) {
    const ti = i % 3, t = towers[ti];
    const ang = rnd() * Math.PI * 2, dist = 5 + rnd() * 9;
    const p = new THREE.Vector3(t.position.x + Math.cos(ang) * dist, 0.6, t.position.z + Math.sin(ang) * dist * 0.8);
    p.x = THREE.MathUtils.clamp(p.x, -30, 30); p.z = THREE.MathUtils.clamp(p.z, -18, 18);
    const phone = box(0.5, 0.9, 0.3, mat(C.ink), p.x, 0.95, p.z); g.add(phone);
    const a = new THREE.Vector3(t.position.x, 19.6, t.position.z), b2 = new THREE.Vector3(p.x, 1.4, p.z);
    const lm = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b2]), lm); g.add(line);
    const dm = new THREE.MeshBasicMaterial({ color: C.blue, transparent: true });
    const dot = new THREE.Mesh(dotGeo, dm); g.add(dot);
    const link = { a, b: b2, line, lm, dot, dm, ph: rnd(), speed: 0.35 + rnd() * 0.3, alive: true, jam: false, tower: ti };
    links.push(link); t.userData.links.push(link);
  }
  // nuestros dos nodos sobre azoteas
  const pick = roofs.filter(r => r.y > 5).sort((p, q) => p.x - q.x);
  const ra = pick[1] || roofs[0], rb = pick[pick.length - 2] || roofs[roofs.length - 1];
  const mini = (p, col) => {
    const n = new THREE.Group(); n.position.copy(p);
    n.add(box(1.5, 0.4, 0.8, mat(C.white), 0, 0.2, 0)); n.add(cyl(0.07, 2.4, mat(C.ink), -0.5, 1.5, 0, 8));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: col })); lamp.position.set(-0.5, 2.8, 0); n.add(lamp);
    n.scale.setScalar(0.001); g.add(n); return n;
  };
  const na = mini(ra, C.red), nb = mini(rb, C.red);
  const mid = ra.clone().lerp(rb, 0.5); mid.y = Math.max(ra.y, rb.y) + 20;
  const curve = new THREE.QuadraticBezierCurve3(ra.clone().setY(ra.y + 2.8), mid, rb.clone().setY(rb.y + 2.8));
  const arcM = new THREE.MeshBasicMaterial({ color: C.red });
  const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.09, 8), arcM); arc.geometry.setDrawRange(0, 0); g.add(arc);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshBasicMaterial({ color: C.red })); pulse.visible = false; g.add(pulse);
  g.userData = { towers, links, na, nb, arc, curve, pulse, ra, rb, arcCount: 80 * 8 * 6 };
  return g;
}

// ----------------------------------------------------------------------------- espectro + alcance por tecnología
export function makeSpectrum() {
  const g = new THREE.Group();
  const f2x = f => (f - 400) / 600 * 44 - 22;           // 400..1000 MHz -> -22..22
  g.add(box(46, 0.5, 5, mat(C.white), 0, 0.25, 0, 0.1));
  for (let f = 400; f <= 1000; f += 25) {
    const big = f % 100 === 0;
    g.add(box(0.07, 0.04, big ? 1.6 : 0.8, mat(C.ink), f2x(f), 0.52, 2.5 - (big ? 0.8 : 0.4)));
  }
  const b433 = box(0.5, 3.2, 3, mat(C.light), f2x(433.9), 0.5 + 1.6, -0.6); b433.scale.y = 0.001; b433.position.y = 0.5; g.add(b433);
  const w915 = f2x(928) - f2x(915);
  const b915 = box(w915, 6.5, 3, mat(C.blue, { roughness: 0.5 }), (f2x(915) + f2x(928)) / 2, 0.5, -0.6); b915.scale.y = 0.001; g.add(b915);
  const cross = new THREE.Group(); cross.position.set(f2x(433.9), 2.4, 0.95);
  const cm = mat(C.red); const c1 = box(2.4, 0.22, 0.12, cm); c1.rotation.z = 0.78; const c2 = box(2.4, 0.22, 0.12, cm); c2.rotation.z = -0.78;
  cross.add(c1, c2); cross.scale.setScalar(0.001); g.add(cross);
  const a433 = new THREE.Object3D(); a433.position.set(f2x(433.9), 4.4, -0.6); g.add(a433);
  const a915 = new THREE.Object3D(); a915.position.set((f2x(915) + f2x(928)) / 2, 7.6, -0.6); g.add(a915);
  const ticks = [400, 500, 600, 700, 800, 900, 1000].map(f => { const o = new THREE.Object3D(); o.position.set(f2x(f), 0.5, 3.1); g.add(o); return { f, o }; });

  // pilares de alcance (escala logarítmica)
  const techs = [['Bluetooth', 10, C.light], ['Wi-Fi', 50, C.light], ['LoRa', 3000, C.red]];
  const pillars = techs.map(([name, meters, col], i) => {
    const hh = Math.log10(meters) * 3.2;
    const p = box(3, hh, 3, mat(col, { roughness: 0.55 }), -15 + i * 6, 0, -9); p.geometry.translate(0, hh / 2, 0); p.scale.y = 0.001;
    const base = box(4, 0.3, 4, mat(C.white), -15 + i * 6, 0.15, -9); g.add(base, p);
    const a = new THREE.Object3D(); a.position.set(-15 + i * 6, hh + 1.0, -9); g.add(a);
    return { name, meters, p, a, hh };
  });
  g.userData = { b433, b915, cross, a433, a915, ticks, pillars };
  return g;
}

// ----------------------------------------------------------------------------- chirp
export function makeChirp() {
  const g = new THREE.Group();
  const W = 30, H = 9;
  g.add(box(W + 3, 0.4, 7, mat(C.white), 0, 0.2, 0, 0.1));
  const axM = mat(C.ink);
  g.add(box(W + 0.4, 0.1, 0.1, axM, 0, 0.9, 0)); g.add(box(0.1, H + 0.4, 0.1, axM, -W / 2, 0.9 + H / 2, 0));
  g.add(box(W + 0.4, 0.05, 0.05, mat(C.light), 0, 0.9 + H, 0));
  const ramps = new THREE.Group(); ramps.position.set(-W / 2, 0.9, 0); g.add(ramps);
  const head = box(0.08, H + 0.6, 1.4, mat(C.red), -W / 2, 0.9 + H / 2, 0); g.add(head);
  const aBW = new THREE.Object3D(); aBW.position.set(-W / 2 - 0.6, 0.9 + H / 2, 0); g.add(aBW);
  const aT = new THREE.Object3D(); aT.position.set(W / 2, 0.5, 2.6); g.add(aT);
  const aPre = new THREE.Object3D(); aPre.position.set(-W / 2 + 3, 0.9 + H + 0.9, 0); g.add(aPre);
  g.userData = { ramps, head, W, H, aBW, aT, aPre, mPre: mat(C.graphite, { roughness: 0.5 }), mData: mat(C.blue, { roughness: 0.5 }) };
  return g;
}
export function buildChirps(chirp, sf) {
  const { ramps, W, H, mPre, mData } = chirp.userData;
  while (ramps.children.length) { const c = ramps.children.pop(); c.geometry.dispose(); }
  const n = Math.round(1.5 * Math.pow(2, 12 - sf));          // símbolos visibles
  const sw = W / n; const nPre = Math.max(1, Math.round(n / 3));
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const th = sf <= 8 ? 0.09 : 0.14;
  const seg = (x0, y0, x1, y1, m, i) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const me = new THREE.Mesh(new THREE.BoxGeometry(len, th, 0.9), m);
    me.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); me.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    me.castShadow = true; me.userData.i = i; ramps.add(me);
  };
  for (let i = 0; i < n; i++) {
    const off = i < nPre ? 0 : rnd();                     // desplazamiento cíclico = dato
    const m = i < nPre ? mPre : mData; const x = i * sw;
    if (off === 0) seg(x, 0, x + sw, H, m, i);
    else { seg(x, off * H, x + (1 - off) * sw, H, m, i); seg(x + (1 - off) * sw, 0, x + sw, off * H, m, i); }
  }
  ramps.children.forEach(c => { c.scale.x = 0.001; gsap.to(c.scale, { x: 1, duration: 0.5, ease: 'power2.out', delay: c.userData.i * Math.min(0.06, 1.4 / n) }); });
  return { n, nPre, sw };
}

// ----------------------------------------------------------------------------- tiempo en aire
export function makeToA() {
  const g = new THREE.Group(); const k = 0.13;              // unidades por ms
  g.add(box(34, 0.4, 12, mat(C.white), 0, 0.2, 0, 0.1));
  const rows = [
    { name: '12 B', pre: 50.2, pay: 118.8, med: 176, z: -2.6 },
    { name: '17 B', pre: 50.2, pay: 147.5, med: 204, z: 2.6 },
  ];
  const x0 = -14;
  rows.forEach(r => {
    const mk = (len, col, x) => { const b = box(len * k, 1.6, 2.6, mat(col, { roughness: 0.55 }), 0, 1.2, r.z); b.geometry.translate(len * k / 2, 0, 0); b.position.x = x; b.scale.x = 0.001; g.add(b); return b; };
    r.bPre = mk(r.pre, C.graphite, x0); r.bPay = mk(r.pay, C.blue, x0 + r.pre * k + 0.06);
    r.mark = box(0.12, 3.2, 3.4, mat(C.red), x0 + r.med * k, 2.0, r.z); r.mark.scale.y = 0.001; g.add(r.mark);
    r.aName = new THREE.Object3D(); r.aName.position.set(x0 - 0.8, 1.4, r.z); g.add(r.aName);
    r.aCalc = new THREE.Object3D(); r.aCalc.position.set(x0 + (r.pre + r.pay) * k * 0.6, 2.4, r.z); g.add(r.aCalc);
    r.aMed = new THREE.Object3D(); r.aMed.position.set(x0 + r.med * k, 4.0, r.z); g.add(r.aMed);
    r.aPre = new THREE.Object3D(); r.aPre.position.set(x0 + r.pre * k * 0.5, 2.4, r.z); g.add(r.aPre);
  });
  for (let ms = 0; ms <= 200; ms += 50) g.add(box(0.06, 0.04, 11, mat(C.light), x0 + ms * k, 0.42, 0));
  const ticks = [0, 50, 100, 150, 200].map(ms => { const o = new THREE.Object3D(); o.position.set(x0 + ms * k, 0.4, 6.4); g.add(o); return { ms, o }; });
  g.userData = { rows, ticks };
  return g;
}

// ----------------------------------------------------------------------------- laboratorio de señales (telecomunicaciones)
export function makeWaveLab() {
  const g = new THREE.Group();
  const W = 30, base = 6, plateY = 0.2;
  g.add(box(W + 4, 0.4, 9, mat(C.white), 0, plateY, 0, 0.1));
  // ejes
  g.add(box(W + 1, 0.08, 0.08, mat(C.ink), 0, base, 0));             // eje de tiempo (línea cero)
  g.add(box(0.08, base * 2, 0.08, mat(C.ink), -W / 2 - 0.5, base, 0)); // eje de amplitud
  // reglas de amplitud (líneas punteadas a ±A)
  const ampTop = new THREE.Group(), ampBot = new THREE.Group(); g.add(ampTop, ampBot);
  const dashed = (grp, col) => { for (let x = -W / 2; x < W / 2; x += 1.4) grp.add(box(0.8, 0.05, 0.05, mat(col), x, 0, 0)); };
  dashed(ampTop, C.mid); dashed(ampBot, C.mid);
  // marcas de período
  const pL = box(0.1, 1.2, 0.1, mat(C.red), 0, base, 0), pR = box(0.1, 1.2, 0.1, mat(C.red), 0, base, 0); g.add(pL, pR);

  const scroll = new THREE.Group(); g.add(scroll);
  const extra = new THREE.Group(); g.add(extra);

  const anchors = {
    amp: new THREE.Object3D(), period: new THREE.Object3D(), lambda: new THREE.Object3D(), carrier: new THREE.Object3D(),
  };
  Object.values(anchors).forEach(a => g.add(a));

  const state = { A: 3.2, lam: 7, speed: 4, mode: 'anatomia', lamShift: 0 };

  function sampleY(x, mode, A, lam) {
    if (mode === 'modulacion') {
      // chirp: la frecuencia crecé con x (longitud de onda que se encoge) → símbolo LoRa
      const u = (x + W) / (2 * W); const k = 2 * Math.PI * (0.6 + u * 2.2) / lam;
      return base + A * Math.sin(k * x);
    }
    return base + A * Math.sin(2 * Math.PI * x / lam);
  }
  function tube(mode, A, lam, col, rad, span) {
    const pts = []; const x0 = -W / 2 - lam * 2, x1 = W / 2 + lam * 2;
    for (let x = x0; x <= x1; x += 0.25) pts.push(new THREE.Vector3(x, sampleY(x, mode, A, lam), 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, pts.length, rad, 8);
    const me = new THREE.Mesh(geo, mat(col, { roughness: 0.5 })); me.castShadow = true; return me;
  }
  function clear(grp) { while (grp.children.length) { const c = grp.children.pop(); c.geometry && c.geometry.dispose(); } }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'anatomia') { state.A = 3.4; state.lam = 8; state.speed = 3.4; }
    else if (mode === 'modulacion') { state.A = 3.0; state.lam = 7; state.speed = 3.0; }
    else { state.A = 2.6; state.lam = 6.5; state.speed = 3.2; }
    clear(scroll); clear(extra);
    scroll.add(tube(mode === 'modulacion' ? 'modulacion' : 'anatomia', state.A, state.lam, mode === 'ruido' ? C.graphite : C.red, 0.26));
    ampTop.position.y = base + state.A; ampBot.position.y = base - state.A;
    pL.position.x = -2; pR.position.x = -2 + state.lam;
    anchors.amp.position.set(-5, base + state.A, 0);
    anchors.period.position.set(-2 + state.lam / 2, base + state.A + 1.2, 0);
    anchors.lambda.position.set(W / 2 - 4, base - state.A - 0.6, 0);
    anchors.carrier.position.set(-W / 2 + 3, base - state.A - 0.5, 0);
    extra.visible = true;
    if (mode === 'ruido') {
      // onda limpia (azul) de referencia + umbral de ruido
      const clean = tube('anatomia', state.A, state.lam, C.blue, 0.14); clean.position.y = -2.0; extra.add(clean);
      const th = box(W, 0.06, 4, new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.12 }), 0, base - state.A - 1.0, 0); extra.add(th);
    }
    pL.visible = pR.visible = (mode !== 'ruido');
    ampTop.visible = ampBot.visible = (mode !== 'modulacion');
  }

  g.userData = {
    anchors, state, setMode,
    update(dt, t) { scroll.position.x = -((t * state.speed) % state.lam); if (state.mode === 'ruido') extra.children[0] && (extra.children[0].position.x = -((t * state.speed) % state.lam)); },
    stop() {},
  };
  setMode('anatomia');
  return g;
}

// ----------------------------------------------------------------------------- circuito (esquema con corriente animada)
export function makeCircuit() {
  const g = new THREE.Group();
  g.add(box(40, 0.5, 26, mat(0xeceae4, { roughness: 0.95 }), 0, 0.25, 0, 0.1));   // mesa/placa
  // retícula tenue
  const grid = new THREE.Group(); g.add(grid);
  for (let x = -18; x <= 18; x += 3) grid.add(box(0.03, 0.02, 24, mat(0xd9d7cf), x, 0.52, 0));
  for (let z = -11; z <= 11; z += 3) grid.add(box(36, 0.02, 0.03, mat(0xd9d7cf), 0, 0.52, z));
  const Y = 0.6;

  // rieles de alimentación
  const rail3v3 = box(36, 0.3, 0.5, mat(C.blue, { roughness: 0.5 }), 0, Y, -10); g.add(rail3v3);
  const railGnd = box(36, 0.3, 0.5, mat(C.ink), 0, Y, 10); g.add(railGnd);

  // --- componentes ---
  function chip() {
    const c = new THREE.Group(); c.position.set(0, Y, 0);
    c.add(box(6.4, 1.3, 6.4, mat(0x15171b, { roughness: 0.5 }), 0, 0.65, 0, 0.1));
    c.add(box(0.7, 0.2, 0.7, mat(C.white), -2.4, 1.32, -2.4));           // marca de pin 1
    for (let i = -2; i <= 2; i++) { c.add(box(0.3, 0.3, 0.9, mat(C.metal, { metalness: 0.6, roughness: 0.4 }), i * 1.1, 0.4, 3.5)); c.add(box(0.3, 0.3, 0.9, mat(C.metal, { metalness: 0.6, roughness: 0.4 }), i * 1.1, 0.4, -3.5)); }
    c.add(box(0.9, 0.3, 0.9, mat(C.metal, { metalness: 0.7, roughness: 0.4 }), -1.6, 1.35, 0.3));  // blindaje radio
    g.add(c); return c;
  }
  function pushButton(col, x, z) {
    const b = new THREE.Group(); b.position.set(x, Y, z);
    b.add(box(2, 0.7, 2, mat(C.ink), 0, 0.35, 0, 0.08));
    b.add(cyl(0.6, 0.6, mat(col, { roughness: 0.45 }), 0, 0.85, 0, 18));
    g.add(b); return b;
  }
  function resistor(x, z, rot, bands) {
    const r = new THREE.Group(); r.position.set(x, Y + 0.3, z); r.rotation.y = rot;
    r.add(cyl(0.3, 1.8, mat(0xcdb892, { roughness: 0.6 }), 0, 0, 0, 16)); // cuerpo horizontal
    r.children[0].rotation.z = Math.PI / 2;
    bands.forEach((col, i) => { const bd = cyl(0.33, 0.18, mat(col), -0.5 + i * 0.4, 0, 0, 16); bd.rotation.z = Math.PI / 2; r.add(bd); });
    r.add(cyl(0.06, 1.4, mat(C.metal, { metalness: 0.6 }), 1.4, 0, 0, 8)); r.children[r.children.length - 1].rotation.z = Math.PI / 2;
    r.add(cyl(0.06, 1.4, mat(C.metal, { metalness: 0.6 }), -1.4, 0, 0, 8)); r.children[r.children.length - 1].rotation.z = Math.PI / 2;
    g.add(r); return r;
  }
  function led(x, z) {
    const l = new THREE.Group(); l.position.set(x, Y, z);
    l.add(cyl(0.55, 0.7, mat(0xc0352c, { roughness: 0.3 }), 0, 0.45, 0, 18));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12, 0, 6.2832, 0, Math.PI / 2), mat(0xd8281e, { roughness: 0.25 })); dome.position.y = 0.8; l.add(dome);
    const lite = new THREE.PointLight(0xff4a38, 6, 8, 2); lite.position.y = 1.1; l.add(lite);
    g.add(l); l.userData.lite = lite; return l;
  }
  function transistor(x, z) {
    const t = new THREE.Group(); t.position.set(x, Y, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 20, 1, false, 0, Math.PI), mat(0x101114, { roughness: 0.5 })); body.position.y = 0.7; body.rotation.y = Math.PI / 2; t.add(body);
    t.add(box(1.6, 1.4, 0.2, mat(0x17191d), 0, 0.7, 0.0));
    for (let i = -1; i <= 1; i++) t.add(cyl(0.07, 1.0, mat(C.metal, { metalness: 0.6 }), i * 0.4, -0.3, 0.2, 8));
    g.add(t); return t;
  }
  function buzzer(x, z) {
    const b = new THREE.Group(); b.position.set(x, Y, z);
    b.add(cyl(1.0, 1.4, mat(0x15171b, { roughness: 0.55 }), 0, 0.7, 0, 24));
    b.add(cyl(0.18, 0.04, mat(0x000000), 0, 1.42, 0, 12));
    g.add(b); return b;
  }

  const cChip = chip();
  const bSOS = pushButton(C.red, -14, 3), bCON = pushButton(C.white, -14, 0), bOK = pushButton(C.blue, -14, -3);
  const rLed = resistor(6, -4.5, 0, [C.ink, 0xb8892b, C.ink]);
  const cLed = led(10.5, -4.5);
  const rBase = resistor(6, 4.5, 0, [0xb8892b, C.ink, 0xb8892b]);
  const cTr = transistor(10.5, 4.5);
  const cBuz = buzzer(14.5, 4.5);
  const cOled = (() => { const o = new THREE.Group(); o.position.set(-11, Y, -5); o.add(box(4.4, 0.4, 2.4, mat(0x0c0d10, { roughness: 0.3 }), 0, 0.3, 0, 0.06)); g.add(o); return o; })();

  // --- trazas con corriente ---
  const traces = [];
  function trace(pts, col, { dots = 2, speed = 0.3, r = 0.13 } = {}) {
    const vs = pts.map(p => new THREE.Vector3(p[0], 0.56, p[1]));
    const curve = new THREE.CatmullRomCurve3(vs);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, vs.length * 6), r, 7), mat(col, { roughness: 0.5 }));
    g.add(tube);
    const sp = [];
    for (let i = 0; i < dots; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshBasicMaterial({ color: col === C.ink ? 0x4a4f57 : col })); g.add(s); sp.push(s); }
    const tr = { curve, sp, speed, phase: Math.random() };
    traces.push(tr); return tr;
  }
  // alimentación
  trace([[0, -10], [0, -3.4]], C.blue, { speed: 0.5 });
  trace([[14.5, -10], [14.5, 4.5]], C.blue, { speed: 0.4 });
  // señal del botón SOS → chip
  trace([[-14, 3], [-8, 2.4], [-3.4, 1.6]], C.red, { speed: 0.55 });
  trace([[-15, 3.6], [-15, 10]], C.ink, { dots: 1, speed: 0.4 });
  // salida al LED (diodo)
  trace([[3.4, -1.5], [6, -4.5]], C.red, { speed: 0.5 });
  trace([[7.8, -4.5], [10.5, -4.5]], C.red, { dots: 1, speed: 0.5 });
  trace([[10.5, -3.6], [10.5, 10]], C.ink, { dots: 1, speed: 0.4 });
  // salida al zumbador (transistor)
  trace([[3.4, 1.5], [6, 4.5]], C.red, { speed: 0.5 });
  trace([[7.8, 4.5], [10, 4.5]], C.red, { dots: 1, speed: 0.5 });
  trace([[14.5, 4.5], [11, 4.5]], C.blue, { dots: 1, speed: 0.4 });
  trace([[10.5, 5.2], [10.5, 10]], C.ink, { dots: 1, speed: 0.4 });
  // I²C a la pantalla
  trace([[-2, 3.2], [-7, 0], [-11, -3.8]], 0x6b7178, { dots: 2, speed: 0.3 });

  const anchors = {};
  const anc = (name, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); g.add(a); anchors[name] = a; };
  anc('esp', 0, Y + 2.0, 0); anc('btn', -14, Y + 1.6, 3); anc('oled', -11, Y + 1.2, -5);
  anc('led', 10.5, Y + 1.8, -4.5); anc('tr', 10.5, Y + 1.8, 4.5); anc('buz', 14.5, Y + 2.0, 4.5);

  let running = false, blink = 0;
  g.userData = {
    anchors,
    start() { running = true; },
    stop() { running = false; },
    update(dt, t) {
      for (const tr of traces) {
        for (let i = 0; i < tr.sp.length; i++) {
          const u = ((t * tr.speed + tr.phase + i / tr.sp.length) % 1 + 1) % 1;
          tr.curve.getPoint(u, tr.sp[i].position);
        }
      }
      blink += dt; const on = (blink % 1.4) < 0.5;
      cLed.userData.lite.intensity = on ? 7 : 1.2;
      cLed.children[1].material.color.setHex(on ? 0xff5a4a : 0xc0352c);
    },
  };
  return g;
}

// ----------------------------------------------------------------------------- mapa (alcance y multisalto)
export function makeMap() {
  const g = new THREE.Group();
  g.add(cyl(34, 0.4, mat(0xd3d6d8), 0, 0.2, 0, 96));
  const envs = [
    { key: 'interior', name: 'Interior denso', dist: '≈ 300 m', r: 6 },
    { key: 'urbano', name: 'Urbano', dist: '≈ 1 km', r: 12 },
    { key: 'suburbano', name: 'Suburbano', dist: '≈ 3 km', r: 19 },
    { key: 'vista', name: 'Línea de vista', dist: 'varios km', r: 28 },
  ];
  envs.forEach((e, i) => {
    const m = new THREE.MeshBasicMaterial({ color: i === 3 ? C.mid : C.ink, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    e.ring = new THREE.Mesh(new THREE.RingGeometry(e.r - (i === 3 ? 0.06 : 0.12), e.r, 128), m); e.ring.rotation.x = -Math.PI / 2; e.ring.position.y = 0.42; e.ring.scale.setScalar(0.001); g.add(e.ring);
    e.a = new THREE.Object3D(); e.a.position.set(Math.cos(-0.5 - i * 0.16) * e.r, 0.6, Math.sin(-0.5 - i * 0.16) * -e.r); g.add(e.a);
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.16 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.41; disc.scale.setScalar(0.001); g.add(disc);
  // bloques de entorno
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blocks = new THREE.Group(); g.add(blocks);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, d = 3 + Math.sqrt(rnd()) * 17;
    const hh = 0.6 + rnd() * (d < 8 ? 3.4 : d < 13 ? 2 : 0.9);
    blocks.add(box(0.9 + rnd(), hh, 0.9 + rnd(), mat(rnd() < 0.5 ? 0xeceae4 : 0xc9cdd0), Math.cos(a) * d, 0.4 + hh / 2, Math.sin(a) * d));
  }
  const marker = (x, z, label) => {
    const n = new THREE.Group(); n.position.set(x, 0.4, z);
    n.add(box(1.6, 0.5, 0.9, mat(C.white), 0, 0.25, 0)); n.add(cyl(0.08, 3.2, mat(C.ink), -0.5, 1.9, 0, 8));
    const top = new THREE.Object3D(); top.position.set(-0.5, 3.6, 0); n.add(top); n.userData = { top, label }; g.add(n); return n;
  };
  const nA = marker(0, 0, 'A');
  const nB = marker(0, -15, 'B'), nC = marker(22, 6, 'C');
  nB.position.set(11, 0.4, -13); nB.scale.setScalar(0.001); nC.scale.setScalar(0.001);
  // cerro entre A y C
  const hill = new THREE.Mesh(new THREE.SphereGeometry(6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb9bec2)); hill.position.set(11, 0.4, 3); hill.scale.set(1, 0.001, 0.75); hill.castShadow = true; g.add(hill);
  g.userData = { envs, disc, blocks, nA, nB, nC, hill };
  return g;
}
