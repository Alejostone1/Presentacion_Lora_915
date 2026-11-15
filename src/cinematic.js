import * as THREE from 'three';
import gsap from 'gsap';
import { C, mat, box, cyl, emitRing } from './world.js';

// ============================================================================
//  Aldea + personajes articulados + secuencia cinematográfica del terremoto.
//  Todo en escala de grises + tinta, con azul/rojo solo como acento (identidad).
// ============================================================================

const CH_BODY = 0xc9cbc4, CH_DARK = 0x2a2d31, CH_SKIN = 0xb9bbb4;

// --------------------------------------------------------------------------- hueso/articulación
function joint(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  g.userData.base = new THREE.Euler(); g.userData.off = new THREE.Euler();
  return g;
}
function limb(len, r, m, dir = 'y') {
  const me = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 6, 12), m);
  me.castShadow = true; me.receiveShadow = true;
  if (dir === 'y') me.position.y = -len / 2;
  return me;
}

// --------------------------------------------------------------------------- personaje
export function makeCharacter(accent) {
  const g = new THREE.Group();
  const body = mat(CH_BODY, { roughness: 0.82 });
  const dark = mat(CH_DARK, { roughness: 0.6 });
  const acc = mat(accent, { roughness: 0.55 });

  const root = joint(g, 0, 3.15, 0);                 // pelvis
  root.add(cyl(0.52, 0.5, body, 0, 0, 0, 16));

  const torso = joint(root, 0, 0.1, 0);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 1.0, 6, 14), body);
  chest.position.y = 0.85; chest.castShadow = true; torso.add(chest);
  // banda de acento (bufanda) para distinguir a cada persona y enlazar con los colores de nodo
  const scarf = cyl(0.5, 0.26, acc, 0, 1.5, 0, 16, 0.46); torso.add(scarf);

  const neck = joint(torso, 0, 1.68, 0);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.36, 6, 14), mat(CH_SKIN, { roughness: 0.7 }));
  head.position.y = 0.42; head.scale.z = 0.92; head.castShadow = true; neck.add(head);
  // gorro/pelo en tinta (sin cara: estilo maniquí)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
  cap.position.y = 0.52; neck.add(cap);

  function arm(side) {
    const s = side === 'L' ? 1 : -1;
    const sh = joint(torso, 0.62 * s, 1.44, 0);
    sh.add(limb(1.0, 0.17, body));
    const el = joint(sh, 0, -1.0, 0);
    el.add(limb(0.92, 0.15, body));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(CH_SKIN, { roughness: 0.7 }));
    hand.position.y = -0.92; hand.castShadow = true; el.add(hand);
    return { sh, el, hand };
  }
  function leg(side) {
    const s = side === 'L' ? 1 : -1;
    const hip = joint(root, 0.28 * s, -0.2, 0);
    hip.add(limb(1.35, 0.2, body));
    const kn = joint(hip, 0, -1.35, 0);
    kn.add(limb(1.25, 0.17, body));
    const foot = box(0.34, 0.2, 0.7, dark, 0, -1.3, 0.16); foot.castShadow = true; kn.add(foot);
    return { hip, kn, foot };
  }
  const armL = arm('L'), armR = arm('R'), legL = leg('L'), legR = leg('R');

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = {
    root, torso, neck, head, armL, armR, legL, legR, scarf,
    state: 'idle', phase: Math.random() * 6.28, speed: 1, lean: 0,
    jointsAll: [root, torso, neck, armL.sh, armL.el, armR.sh, armR.el, legL.hip, legL.kn, legR.hip, legR.kn],
  };
  // guarda base neutral
  g.userData.jointsAll.forEach(j => j.userData.base.copy(j.rotation));
  return g;
}

// base procedural por estado (escribe en userData.base; los scripts usan .off)
function poseBase(ch, dt, t) {
  const u = ch.userData, p = u.phase + t * 2.2 * u.speed;
  const set = (j, x, y, z) => j.userData.base.set(x, y, z);
  const breathe = Math.sin(t * 1.6 + u.phase) * 0.03;
  switch (u.state) {
    case 'idle':
      set(u.root, 0, 0, 0); u.root.position.y = 3.15 + breathe;
      set(u.torso, 0.02 + breathe, 0, 0); set(u.neck, Math.sin(t * 0.5) * 0.05, Math.sin(t * 0.3) * 0.12, 0);
      set(u.armL.sh, 0.1, 0, 0.14 + Math.sin(t * 1.1) * 0.03); set(u.armR.sh, 0.1, 0, -0.14 - Math.sin(t * 1.1 + 1) * 0.03);
      set(u.armL.el, -0.25, 0, 0); set(u.armR.el, -0.25, 0, 0);
      set(u.legL.hip, 0, 0, 0.02); set(u.legR.hip, 0, 0, -0.02); set(u.legL.kn, 0.02, 0, 0); set(u.legR.kn, 0.02, 0, 0);
      break;
    case 'sweep': {                                   // barre / actividad cotidiana
      const s = Math.sin(t * 1.8);
      set(u.root, 0.12, 0, 0); u.root.position.y = 3.05;
      set(u.torso, 0.18, s * 0.12, 0);
      set(u.armL.sh, -1.5 + s * 0.4, 0, 0.1); set(u.armL.el, -0.5 - s * 0.3, 0, 0);
      set(u.armR.sh, -1.2 + s * 0.4, 0, -0.1); set(u.armR.el, -0.6 - s * 0.3, 0, 0);
      set(u.neck, 0.35, s * 0.1, 0);
      set(u.legL.hip, 0.15, 0, 0.02); set(u.legR.hip, -0.1, 0, -0.02); set(u.legL.kn, 0.2, 0, 0); set(u.legR.kn, 0.15, 0, 0);
      break;
    }
    case 'walk': {
      const s = Math.sin(p), c = Math.cos(p);
      u.root.position.y = 3.15 + Math.abs(Math.sin(p)) * 0.12 - 0.05;
      set(u.root, 0.06, 0, s * 0.04);
      set(u.torso, 0.06, 0, 0);
      set(u.legL.hip, s * 0.7, 0, 0.02); set(u.legR.hip, -s * 0.7, 0, -0.02);
      set(u.legL.kn, Math.max(0, -s) * 1.1 + 0.1, 0, 0); set(u.legR.kn, Math.max(0, s) * 1.1 + 0.1, 0, 0);
      set(u.armL.sh, -s * 0.55, 0, 0.12); set(u.armR.sh, s * 0.55, 0, -0.12);
      set(u.armL.el, -0.4, 0, 0); set(u.armR.el, -0.4, 0, 0);
      set(u.neck, 0.04, 0, 0);
      break;
    }
    case 'panic': {                                   // tambaleo durante el sismo
      const s = Math.sin(t * 9 + u.phase), c = Math.cos(t * 7 + u.phase);
      set(u.root, 0.1 + c * 0.08, s * 0.1, s * 0.14); u.root.position.y = 3.1 + Math.abs(s) * 0.05;
      set(u.torso, 0.12 + s * 0.06, 0, -s * 0.1);
      set(u.armL.sh, -1.9 + s * 0.3, 0, 0.5); set(u.armL.el, -0.9, 0, 0);
      set(u.armR.sh, -1.9 - s * 0.3, 0, -0.5); set(u.armR.el, -0.9, 0, 0);
      set(u.neck, -0.2 + c * 0.1, s * 0.2, 0);
      set(u.legL.hip, 0.2, 0, 0.24); set(u.legR.hip, -0.1, 0, -0.26); set(u.legL.kn, 0.4, 0, 0); set(u.legR.kn, 0.3, 0, 0);
      break;
    }
    case 'crouch': {                                  // se agacha y se cubre
      u.root.position.y = 2.0; set(u.root, 0.5, 0, 0);
      set(u.torso, 0.6, 0, 0);
      set(u.armL.sh, -2.6, 0, 0.3); set(u.armL.el, -1.4, 0, 0);
      set(u.armR.sh, -2.6, 0, -0.3); set(u.armR.el, -1.4, 0, 0);
      set(u.neck, -0.5, 0, 0);
      set(u.legL.hip, 1.5, 0, 0.1); set(u.legR.hip, 1.5, 0, -0.1); set(u.legL.kn, 1.9, 0, 0); set(u.legR.kn, 1.9, 0, 0);
      break;
    }
    case 'phone': {                                   // mira el teléfono en la mano
      u.root.position.y = 3.15 + breathe; set(u.root, 0.05, 0, 0);
      set(u.torso, 0.12, 0, 0);
      set(u.armR.sh, -1.15, 0.1, -0.35); set(u.armR.el, -1.25, 0, 0);
      set(u.armL.sh, 0.2, 0, 0.2); set(u.armL.el, -0.4, 0, 0);
      set(u.neck, 0.45, 0, 0);
      set(u.legL.hip, 0, 0, 0.02); set(u.legR.hip, 0, 0, -0.02); set(u.legL.kn, 0.05, 0, 0); set(u.legR.kn, 0.05, 0, 0);
      break;
    }
    case 'reach': {                                   // extiende el brazo hacia el nodo
      u.root.position.y = 3.0; set(u.root, 0.1, 0, 0);
      set(u.torso, 0.3, -0.15, 0);
      set(u.armR.sh, -1.5, -0.2, -0.2); set(u.armR.el, -0.3, 0, 0);
      set(u.armL.sh, 0.2, 0, 0.2); set(u.armL.el, -0.5, 0, 0);
      set(u.neck, 0.3, -0.15, 0);
      set(u.legL.hip, 0.2, 0, 0.02); set(u.legR.hip, -0.15, 0, -0.02); set(u.legL.kn, 0.3, 0, 0); set(u.legR.kn, 0.2, 0, 0);
      break;
    }
    case 'hold': {                                    // sostiene el nodo y pulsa
      u.root.position.y = 3.15; set(u.root, 0.05, 0, 0);
      set(u.torso, 0.14, 0, 0);
      set(u.armR.sh, -1.25, 0.15, -0.3); set(u.armR.el, -1.1, 0, 0);
      set(u.armL.sh, -1.1, -0.15, 0.3); set(u.armL.el, -1.15, 0, 0);
      set(u.neck, 0.4, 0, 0);
      break;
    }
    case 'relief': {                                  // alivio: mira al otro lado
      u.root.position.y = 3.15 + breathe; set(u.root, 0, 0, 0);
      set(u.torso, -0.04, 0.1, 0);
      set(u.armL.sh, 0.15, 0, 0.16); set(u.armR.sh, -0.7, 0, -0.2); set(u.armR.el, -0.5, 0, 0); set(u.armL.el, -0.3, 0, 0);
      set(u.neck, -0.08, 0.25, 0);
      set(u.legL.hip, 0, 0, 0.02); set(u.legR.hip, 0, 0, -0.02); set(u.legL.kn, 0.04, 0, 0); set(u.legR.kn, 0.04, 0, 0);
      break;
    }
  }
}

export function setCharState(ch, state) { ch.userData.state = state; }

export function updateCharacters(list, dt, t) {
  for (const ch of list) {
    poseBase(ch, dt, t);
    for (const j of ch.userData.jointsAll) {
      const b = j.userData.base, o = j.userData.off;
      j.rotation.set(b.x + o.x, b.y + o.y, b.z + o.z);
    }
  }
}

// --------------------------------------------------------------------------- casa
function makeHouse(wallShade, roofShade, mirror) {
  const g = new THREE.Group();
  const W = 9, H = 5.2, D = 7.5;
  g.add(box(W, H, D, mat(wallShade, { roughness: 0.9 }), 0, H / 2, 0, 0.05));
  // techo a dos aguas
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.001, W * 0.76, 3.1, 4, 1), mat(roofShade, { roughness: 0.85 }));
  roof.rotation.y = Math.PI / 4; roof.position.y = H + 1.5; roof.scale.z = D / W * 1.02; roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  // puerta
  g.add(box(1.8, 3.1, 0.2, mat(CH_DARK), mirror ? 2.2 : -2.2, 1.55, D / 2 + 0.01, 0.04));
  g.add(cyl(0.1, 0.1, mat(C.gold, { metalness: 0.6, roughness: 0.4 }), mirror ? 1.6 : -1.6, 1.5, D / 2 + 0.14));
  // ventanas
  const win = (x) => { g.add(box(1.7, 1.7, 0.2, mat(CH_DARK), x, 3.1, D / 2 + 0.02, 0.03)); g.add(box(1.9, 0.14, 0.26, mat(C.white), x, 3.1, D / 2 + 0.04)); g.add(box(0.14, 1.9, 0.26, mat(C.white), x, 3.1, D / 2 + 0.04)); };
  win(mirror ? -2.4 : 2.4);
  // chimenea
  g.add(box(0.9, 2.4, 0.9, mat(roofShade, { roughness: 0.85 }), mirror ? -2.8 : 2.8, H + 2.0, -1.4, 0.03));
  // antena doméstica (recibe el nodo)
  const mast = new THREE.Object3D(); mast.position.set(mirror ? -3.4 : 3.4, H + 3.1, 0); g.add(mast);
  g.userData = { W, H, D, roof };
  return g;
}

// --------------------------------------------------------------------------- pantalla del nodo (aldea)
function nodeTable(accent) {
  const g = new THREE.Group();
  // mesa
  g.add(box(3.4, 0.25, 2.2, mat(C.board, { roughness: 0.85 }), 0, 2.4, 0, 0.05));
  [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]].forEach(([x, z]) => g.add(cyl(0.12, 2.4, mat(CH_DARK), x, 1.2, z, 8)));
  // cuerpo del nodo (protoboard pequeña + placa)
  const node = new THREE.Group(); node.position.set(0, 2.55, 0); g.add(node);
  node.add(box(2.6, 0.3, 1.2, mat(C.board), 0, 0.15, 0, 0.05));
  node.add(box(1.5, 0.16, 0.9, mat(C.ink), -0.3, 0.38, 0));
  // pantalla OLED
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: tex }));
  scr.rotation.x = -Math.PI / 2.1; scr.position.set(-0.3, 0.49, 0.2); node.add(scr);
  // antena
  node.add(cyl(0.05, 2.0, mat(C.ink), 0.9, 1.0, -0.3, 8));
  const tip = new THREE.Object3D(); tip.position.set(0.9, 2.0, -0.3); node.add(tip);
  // pulsadores
  const btns = {};
  [['OK', C.blue, -0.2], ['CONSULTA', C.white, 0.25], ['SOS', C.red, 0.7]].forEach(([tipo, col, x]) => {
    const cap = cyl(0.14, 0.18, mat(col, { roughness: 0.5 }), x, 0.42, 0.35, 14); cap.userData = { y0: 0.42 }; node.add(cap); btns[tipo] = cap;
  });
  const led = cyl(0.08, 0.16, mat(0x9c2a22, { roughness: 0.3 }), 0.55, 0.42, -0.1, 12);
  const ledLight = new THREE.PointLight(0xff4a38, 0, 3, 2); ledLight.position.set(0.55, 0.7, -0.1); node.add(led, ledLight);
  g.userData = { node, canvas, tex, tip, btns, led, ledMat: led.material, ledLight };
  return g;
}

// --------------------------------------------------------------------------- partículas de polvo
function makeDust(max) {
  const pos = new Float32Array(max * 3); pos.fill(-9999);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xbfc0ba, size: 0.42, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false;
  pts.userData = { v: [], life: new Float32Array(max), max, n: 0, geo, m };
  return pts;
}

// ============================================================================ aldea
export function makeVillage() {
  const g = new THREE.Group();
  // suelo / calle
  const ground = box(80, 0.6, 60, mat(0xcfd1cc, { roughness: 0.95 }), 0, -0.3, 0);
  g.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(10, 60), new THREE.MeshStandardMaterial({ color: 0xc3c6c2, roughness: 1 }));
  street.rotation.x = -Math.PI / 2; street.position.y = 0.02; street.receiveShadow = true; g.add(street);
  // líneas de la calle
  for (let z = -26; z <= 26; z += 6) g.add(box(0.3, 0.02, 2.4, mat(C.white), 0, 0.04, z));
  // grietas (ocultas hasta el sismo)
  const cracks = new THREE.Group(); g.add(cracks);
  const crackMats = [];
  for (let i = 0; i < 5; i++) {
    const cm = new THREE.MeshBasicMaterial({ color: 0x3a3d42, transparent: true, opacity: 0 });
    const w = 0.12 + Math.random() * 0.1;
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(w, 5 + Math.random() * 6), cm);
    cr.rotation.x = -Math.PI / 2; cr.rotation.z = (Math.random() - 0.5) * 1.2; cr.position.set((Math.random() - 0.5) * 8, 0.05, -14 + i * 7);
    cracks.add(cr); crackMats.push(cm);
  }

  // dos casas enfrentadas
  const houseA = makeHouse(0xe7e8e4, 0x9aa0a4, false); houseA.position.set(-9.5, 0, 3.5); houseA.rotation.y = 0.45; g.add(houseA);
  const houseB = makeHouse(0xdadcd7, 0x868b8f, true); houseB.position.set(9.5, 0, -3.5); houseB.rotation.y = Math.PI - 0.45; g.add(houseB);

  // arbustos / prisma-árbol
  const tree = (x, z) => {
    const t = new THREE.Group(); t.position.set(x, 0, z);
    t.add(cyl(0.2, 1.6, mat(0x7c756a), 0, 0.8, 0, 8));
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), mat(0xb7bcb3, { roughness: 1 })); crown.position.y = 2.3; crown.castShadow = true; t.add(crown);
    g.add(t); return t;
  };
  tree(-6, -10); tree(7, 12);

  // personajes
  const chA = makeCharacter(C.blue); chA.position.set(-4.6, 0, 4.4); chA.rotation.y = 2.0; chA.scale.setScalar(1.05);
  const chB = makeCharacter(C.red); chB.position.set(4.6, 0, -4.4); chB.rotation.y = -1.1; chB.scale.setScalar(1.05);
  g.add(chA, chB);

  // teléfono en la mano derecha de cada personaje (oculto hasta el acto 3)
  const phone = (ch) => {
    const p = box(0.26, 0.5, 0.07, mat(CH_DARK), 0, 0, 0.12, 0.03);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 120; const cx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.42), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, 0, 0.16); p.add(scr);
    p.position.y = -0.92; p.visible = false; ch.userData.armR.el.add(p);
    return { p, canvas, cx, tex };
  };
  const phoneA = phone(chA), phoneB = phone(chB);

  // mesas con nodos (uno junto a cada casa)
  const tableA = nodeTable(C.blue); tableA.position.set(-4.9, 0, 1.5); tableA.rotation.y = 0.4; g.add(tableA);
  const tableB = nodeTable(C.red); tableB.position.set(4.9, 0, -1.5); tableB.rotation.y = Math.PI + 0.4; g.add(tableB);

  // torre celular lejana
  const tower = new THREE.Group(); tower.position.set(26, 0, -20);
  tower.add(box(0.5, 20, 0.5, mat(C.graphite), 0, 10, 0));
  [15, 17.5, 19.4].forEach((y, k) => { tower.add(box(3 - k * 0.7, 0.2, 0.2, mat(C.graphite), 0, y, 0)); tower.add(box(0.2, 0.2, 3 - k * 0.7, mat(C.graphite), 0, y, 0)); });
  const towerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshBasicMaterial({ color: C.blue })); towerLamp.position.y = 20.4; tower.add(towerLamp);
  g.add(tower);

  // escombros (tejas) que caen durante el sismo
  const debris = [];
  const dm = mat(0x9aa0a4, { roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const d = box(0.5 + Math.random() * 0.4, 0.14, 0.5 + Math.random() * 0.3, dm, 0, 0, 0, 0.02);
    d.visible = false; d.castShadow = true; g.add(d);
    debris.push({ mesh: d, v: new THREE.Vector3(), w: new THREE.Vector3(), active: false });
  }
  const dust = makeDust(260); g.add(dust);

  // halo de "sin señal" sobre las torres/teléfonos (barras que se rompen) — geometría, sin iconos de IA
  g.userData = {
    ground, street, cracks, crackMats, houseA, houseB, chA, chB, phoneA, phoneB,
    tableA, tableB, tower, towerLamp, debris, dust, chars: [chA, chB],
    quake: 0,            // intensidad actual del sismo (0..1)
    screens: { A: { canvas: tableA.userData.canvas, tex: tableA.userData.tex }, B: { canvas: tableB.userData.canvas, tex: tableB.userData.tex } },
  };
  return g;
}

// --------------------------------------------------------------------------- polvo: lanzar un estallido
export function burstDust(village, x, y, z, n = 14, spread = 1.4) {
  const d = village.userData.dust.userData, pos = d.geo.attributes.position.array;
  for (let i = 0; i < n && d.n < d.max; i++) {
    const idx = d.n++;
    pos[idx * 3] = x + (Math.random() - 0.5) * spread; pos[idx * 3 + 1] = y + Math.random() * 0.6; pos[idx * 3 + 2] = z + (Math.random() - 0.5) * spread;
    d.v[idx] = new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 2.4, (Math.random() - 0.5) * 2.2);
    d.life[idx] = 1;
  }
  d.m.opacity = 0.5; d.geo.attributes.position.needsUpdate = true;
}

// --------------------------------------------------------------------------- update por frame
export function updateVillage(village, dt, t) {
  const u = village.userData;
  updateCharacters(u.chars, dt, t);
  // temblor de edificios/props
  const q = u.quake;
  const shake = (o, base, amp) => { o.position.x = base.x + (Math.random() - 0.5) * amp * q; o.position.z = base.z + (Math.random() - 0.5) * amp * q; o.rotation.z = (base.rz || 0) + (Math.random() - 0.5) * 0.02 * q; };
  if (q > 0.001) {
    if (!u._base) u._base = { a: u.houseA.position.clone(), b: u.houseB.position.clone(), tw: u.tower.position.clone() };
    u.houseA.position.x = u._base.a.x + (Math.random() - 0.5) * 0.18 * q; u.houseA.position.y = (Math.random() - 0.5) * 0.08 * q;
    u.houseB.position.x = u._base.b.x + (Math.random() - 0.5) * 0.18 * q; u.houseB.position.y = (Math.random() - 0.5) * 0.08 * q;
    u.houseA.rotation.z = (Math.random() - 0.5) * 0.015 * q; u.houseB.rotation.z = (Math.random() - 0.5) * 0.015 * q;
  }
  // escombros con física simple
  for (const d of u.debris) {
    if (!d.active) continue;
    d.v.y -= 22 * dt; d.mesh.position.addScaledVector(d.v, dt);
    d.mesh.rotation.x += d.w.x * dt; d.mesh.rotation.y += d.w.y * dt; d.mesh.rotation.z += d.w.z * dt;
    if (d.mesh.position.y <= 0.08) { d.mesh.position.y = 0.08; d.v.multiplyScalar(0); d.w.multiplyScalar(0.3); d.active = false; burstDust(village, d.mesh.position.x, 0.1, d.mesh.position.z, 6, 0.8); }
  }
  // polvo
  const dd = u.dust.userData, pos = dd.geo.attributes.position.array; let alive = 0;
  for (let i = 0; i < dd.n; i++) {
    if (dd.life[i] <= 0) continue;
    dd.life[i] -= dt * 0.5; const v = dd.v[i]; v.y -= 1.4 * dt; v.multiplyScalar(0.98);
    pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
    if (pos[i * 3 + 1] < 0.05) { dd.life[i] = 0; pos[i * 3 + 1] = -9999; } else alive++;
  }
  if (dd.n) dd.geo.attributes.position.needsUpdate = true;
  if (alive === 0 && dd.m.opacity > 0) gsap.to(dd.m, { opacity: 0, duration: 0.6, overwrite: true });
  if (dd.n > dd.max - 20) dd.n = 0;      // recicla el anillo cuando se vacía
}

// --------------------------------------------------------------------------- lanzar escombros de una casa
export function dropDebris(village, house, count) {
  const u = village.userData; let dropped = 0;
  for (const d of u.debris) {
    if (d.active || d.mesh.visible) continue;
    const wp = house.getWorldPosition(new THREE.Vector3());
    d.mesh.position.set(wp.x + (Math.random() - 0.5) * 7 - village.position.x, 7 + Math.random() * 2, wp.z + (Math.random() - 0.5) * 6 - village.position.z);
    d.mesh.visible = true; d.active = true;
    d.v.set((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2);
    d.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    if (++dropped >= count) break;
  }
}

// --------------------------------------------------------------------------- señal "sin red" en un teléfono
export function drawPhone(ph, mode, t) {
  const g = ph.cx, c = ph.canvas; g.clearRect(0, 0, 64, 120);
  g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 64, 120);
  if (mode === 'ok') {
    g.fillStyle = '#1e4bd2'; for (let i = 0; i < 4; i++) g.fillRect(10 + i * 11, 70 - i * 10, 8, 14 + i * 10);
  } else if (mode === 'searching') {
    g.fillStyle = '#5d646b'; for (let i = 0; i < 4; i++) { if ((Math.floor(t * 3) % 4) === i) continue; g.fillRect(10 + i * 11, 70 - i * 10, 8, 14 + i * 10); }
  } else if (mode === 'nosignal') {
    g.fillStyle = '#3a3d42'; for (let i = 0; i < 4; i++) g.fillRect(10 + i * 11, 70 - i * 10, 8, 14 + i * 10);
    g.strokeStyle = '#d8281e'; g.lineWidth = 6; g.beginPath(); g.moveTo(12, 24); g.lineTo(52, 96); g.stroke();
  }
  ph.tex.needsUpdate = true;
}
