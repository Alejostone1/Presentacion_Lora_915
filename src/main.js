import * as THREE from 'three';
import gsap from 'gsap';
import { C, makeNode, explodeNode, emitRing, pressButton, makeCity, makeSpectrum, makeChirp, buildChirps, makeMap, makeWaveLab, makeCircuit } from './world.js';
import { Oled, audio, createSim, morseTimeline } from './sim.js';
import { makeVillage, updateVillage, setCharState, dropDebris, burstDust, drawPhone } from './cinematic.js';

const D = window.__DECK__;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (v, d = 0) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');

// ============================================================================ motor 3D
const canvas = $('#gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('#nogl').hidden = false; }
const scene = new THREE.Scene(); scene.background = new THREE.Color(C.paper); scene.fog = new THREE.Fog(C.paper, 120, 210);
const camera = new THREE.PerspectiveCamera(32, 1.7, 0.5, 900);
const view = { x: 0, y: 0, w: innerWidth, h: innerHeight, G: 140 };   // escenario 3D (zona derecha)
let zs = 1, offs = 0;                                                          // zoom suavizado (deja los márgenes para etiquetas)
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bec2, 1.55));
const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShadowMaterial({ opacity: 0.2 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ---------------------------------------------------------------------------- mundo
const P = { desk: [0, 0, 0], city: [0, 0, -280], spec: [-280, 0, 0], chirp: [280, 0, 0], circuit: [560, 0, 280], map: [0, 0, 280], village: [0, 0, 560], wave: [-560, 0, 0] };
const nodes = { A: makeNode('A'), B: makeNode('B') };
nodes.A.position.set(-10.6, 0, 0); nodes.A.rotation.y = 0.14;
nodes.B.position.set(10.6, 0, 0); nodes.B.rotation.y = -0.14;
scene.add(nodes.A, nodes.B);
const city = makeCity(); city.position.set(...P.city); scene.add(city);
const spec = makeSpectrum(); spec.position.set(...P.spec); scene.add(spec);
const chirp = makeChirp(); chirp.position.set(...P.chirp); scene.add(chirp);
const circuit = makeCircuit(); circuit.position.set(...P.circuit); scene.add(circuit);
const map = makeMap(); map.position.set(...P.map); scene.add(map);
const village = makeVillage(); village.position.set(...P.village); scene.add(village);
const wave = makeWaveLab(); wave.position.set(...P.wave); scene.add(wave);
const VX = P.village[0], VZ = P.village[2];

// anclas para etiquetas
const anchors = {
  'A.tip': nodes.A.userData.tip, 'B.tip': nodes.B.userData.tip,
  'city.t0': city.userData.towers[0].userData.top, 'city.t1': city.userData.towers[1].userData.top, 'city.t2': city.userData.towers[2].userData.top,
  'sp.a433': spec.userData.a433, 'sp.a915': spec.userData.a915,
  'sp.p0': spec.userData.pillars[0].a, 'sp.p1': spec.userData.pillars[1].a, 'sp.p2': spec.userData.pillars[2].a,
  'ch.aBW': chirp.userData.aBW, 'ch.aPre': chirp.userData.aPre,
  'map.A': map.userData.nA.userData.top, 'map.B': map.userData.nB.userData.top, 'map.C': map.userData.nC.userData.top,
};
map.userData.envs.forEach((e, i) => anchors['map.e' + i] = e.a);
anchors['wave.amp'] = wave.userData.anchors.amp; anchors['wave.period'] = wave.userData.anchors.period;
anchors['wave.lambda'] = wave.userData.anchors.lambda; anchors['wave.carrier'] = wave.userData.anchors.carrier;
Object.entries(circuit.userData.anchors).forEach(([k, a]) => anchors['cir.' + k] = a);

// información de cada componente (circuito interactivo) — datos reales del proyecto
const COMP = {
  heltec: { t: 'Heltec WiFi LoRa 32 V3', d: 'ESP32-S3 + radio SX1262 en una sola placa: es el cerebro y el transmisor del nodo. Un circuito integrado de semiconductores.', c: '915 MHz · SPI con el SX1262 · OLED por I²C' },
  oled: { t: 'Pantalla OLED 128×64', d: 'Muestra el estado y las alertas. Se enciende alimentando Vext (GPIO 36 en bajo) y se controla por I²C.', c: 'SDA 17 · SCL 18 · RST 21' },
  antenna: { t: 'Antena 915 MHz', d: 'Adapta la señal al aire. Nunca se transmite sin ella conectada al conector IPEX: la radio podría dañarse.', c: 'Banda 915–928 MHz · uso libre en Colombia (ANE)' },
  buttons: { t: 'Tres pulsadores', d: 'A masa, con la resistencia pull-up interna del ESP32. Cada color envía una señal cerrada.', c: 'Azul OK → GPIO 7   ·   Blanco CONSULTA → GPIO 6   ·   Rojo SOS → GPIO 5' },
  led: { t: 'LED · diodo', d: 'Diodo emisor de luz: repite en luz el mismo patrón Morse del zumbador. Tema de Circuitos: diodos y semiconductores.', c: 'GPIO 4 → 220 Ω → LED → GND\nR ≈ (3,3 − 2,0) / 0,01 A ≈ 130 Ω → 220 Ω por seguridad' },
  buzzer: { t: 'Zumbador + 2N2222', d: 'El pin del ESP32 no entrega los ~30 mA del zumbador; el transistor 2N2222 lo conmuta como interruptor. Tema de Circuitos: transistores.', c: 'GPIO 3 → 1 kΩ → base\nI_B ≈ (3,3 − 0,7) / 1 kΩ ≈ 2,6 mA' },
  board: { t: 'Protoboard', d: 'Conecta los componentes sin soldar: las filas internas están unidas entre sí. Un nodo por protoboard.', c: '' },
};
Object.entries(COMP).forEach(([k, info]) => { if (nodes.A.userData.parts[k]) nodes.A.userData.parts[k].userData.comp = info; });
{ // ancla del enlace propio en la ciudad y de las piezas del nodo
  const o = new THREE.Object3D(); o.position.copy(city.userData.curve.getPoint(0.3)); city.add(o); anchors['city.link'] = o;
  const mk = (name, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); nodes.A.userData.parts[name].add(a); anchors['A.p.' + name] = a; };
  mk('heltec', -3.2, 1.9, 1.2); mk('oled', -3.7, 2.1, 0); mk('buttons', 3.8, 1.9, 0.9); mk('led', 5.5, 1.8, -1.0); mk('buzzer', 6.9, 1.9, 0.95);
}

// ---------------------------------------------------------------------------- OLED + simulación
const oleds = {};
const imgs = {};
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }

let sim;
const cam = { px: 0, py: 14, pz: 44, tx: 0, ty: 3, tz: 0, orbit: 0, z: 1 };
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
let dragA = 0, dragEl = 0;                    // órbita manual (arrastre) acumulada
const tmpV = new THREE.Vector3();

// ============================================================================ pasos
const stepEls = $$('.step');
const WHO = [
  { name: 'Alejandro', topic: 'Problema y propuesta' }, { name: 'Daniel', topic: 'Hardware y señal' },
  { name: 'Sebastián', topic: 'Protocolo y resultados' }, { name: 'Cierre', topic: '' },
];
let cur = -1, ambient = null, stepTl = null, loops = [];
const every = (t, fn, first = 0.4) => { let c; const run = () => { fn(); c = gsap.delayedCall(t, run); h.c = c; }; const h = { c: gsap.delayedCall(first, run), kill() { this.c.kill(); } }; loops.push(h); return h; };
const loopTl = tl => { loops.push(tl); return tl; };
const at = (px, py, pz, tx, ty, tz, st) => { const o = P[st]; return { px: px + o[0], py, pz: pz + o[2], tx: tx + o[0], ty, tz: tz + o[2] }; };

function startAmbient(period = 5.5) {
  const seq = [['A', 'OK'], ['B', 'CONSULTA'], ['A', 'SOS'], ['B', 'OK']]; let i = 0;
  sim.loss = 0; sim.reset();
  every(period, () => { const [n, t] = seq[i++ % seq.length]; sim.send(n, t); }, 1.4);
}

// ---- ciudad
function resetCity() {
  const u = city.userData;
  u.towers.forEach(t => { gsap.killTweensOf(t.rotation); t.rotation.set(0, 0, 0); t.userData.lamp.material.color.setHex(C.blue); t.userData.mats.color.setHex(C.graphite); });
  u.links.forEach(l => { l.alive = true; l.jam = false; l.lm.opacity = 0.8; l.lm.color.setHex(C.ink); l.dm.opacity = 1; l.dm.color.setHex(C.blue); });
  [u.na, u.nb].forEach(n => { gsap.killTweensOf(n.scale); n.scale.setScalar(0.001); });
  u.arc.geometry.setDrawRange(0, 0); u.pulse.visible = false;
}
function cityShow(el) {
  resetCity();
  const u = city.userData; const tl = gsap.timeline();
  const cut = (ti, t0) => u.towers[ti].userData.links.forEach((l, k) => tl.add(() => { l.alive = false; gsap.to(l.lm, { opacity: 0, duration: 0.4 }); gsap.to(l.dm, { opacity: 0, duration: 0.2 }); }, t0 + k * 0.09));
  // 1) daño físico
  tl.to(city.position, { x: P.city[0] + 0.35, duration: 0.05, repeat: 9, yoyo: true, ease: 'none' }, 1.6);
  tl.to(u.towers[0].rotation, { z: 1.25, duration: 1.1, ease: 'bounce.out' }, 1.8);
  tl.add(() => u.towers[0].userData.lamp.material.color.setHex(C.ink), 1.9); cut(0, 1.9);
  // 2) sin energía
  tl.add(() => { u.towers[1].userData.lamp.material.color.setHex(C.ink); gsap.to(u.towers[1].userData.mats.color, { r: 0.6, g: 0.62, b: 0.64, duration: 0.6 }); }, 3.4); cut(1, 3.5);
  // 3) saturación
  tl.add(() => { u.towers[2].userData.lamp.material.color.setHex(C.red); u.towers[2].userData.links.forEach(l => { l.jam = true; l.lm.color.setHex(C.red); l.dm.color.setHex(C.red); }); }, 5.0);
  // 4) enlace propio
  tl.to([u.na.scale, u.nb.scale], { x: 1.6, y: 1.6, z: 1.6, duration: 0.6, ease: 'back.out(2)', stagger: 0.15 }, 6.6);
  const dr = { n: 0 };
  tl.to(dr, { n: u.arcCount, duration: 1.3, ease: 'power2.inOut', onUpdate: () => u.arc.geometry.setDrawRange(0, Math.floor(dr.n / 6) * 6) }, 7.2);
  tl.add(() => {
    u.pulse.visible = true; const pp = { t: 0 };
    loopTl(gsap.to(pp, { t: 1, duration: 1.6, repeat: -1, ease: 'none', onUpdate: () => u.curve.getPoint(pp.t, u.pulse.position) }));
    every(1.6, () => emitRing(city, u.ra.clone().setY(u.ra.y + 2.8), { color: C.red, max: 9, dur: 1.5 }), 0);
  }, 8.5);
  // etiquetas en orden
  const tags = $$('.tag', el);
  [1.9, 3.4, 5.0, 7.4].forEach((t, i) => tl.to(tags[i], { opacity: 1, duration: 0.4 }, t));
  return tl;
}

// ---- morse (DOM)
function buildMorseDom() {
  $$('.morse button').forEach(btn => {
    const tipo = btn.dataset.m; const { marks, total } = morseTimeline(tipo); const pat = $('.pat', btn);
    let prev = 0; const px = 46;                               // px por segundo... se escala con %
    marks.forEach(([a, b]) => {
      if (a > prev) { const g = document.createElement('i'); g.className = 'gap'; g.style.width = ((a - prev) / 4.05 * 100) + '%'; pat.append(g); }
      const m = document.createElement('i'); m.style.width = ((b - a) / 4.05 * 100) + '%'; m.dataset.a = a; m.dataset.b = b; pat.append(m); prev = b;
    });
    const u = document.createElement('u'); pat.append(u);
    $('.du', btn).textContent = fmt(total, 1) + ' s';
    btn.addEventListener('click', () => playMorseDom(tipo));
  });
}
let morseRun = [];
function playMorseDom(tipo) {
  morseRun.forEach(t => t.kill()); morseRun = [];
  sim.reset();
  $$('.morse button').forEach(b => { b.classList.toggle('on', b.dataset.m === tipo); $$('.pat i', b).forEach(i => i.classList.remove('lit')); gsap.set($('.pat u', b), { opacity: 0 }); });
  const btn = $(`.morse button[data-m="${tipo}"]`); const { marks, total } = morseTimeline(tipo); const u = $('.pat u', btn); const pat = $('.pat', btn);
  sim.demoMorse('A', tipo);
  morseRun.push(gsap.fromTo(u, { left: '0%', opacity: 1 }, { left: (total / 4.05 * 100) + '%', duration: total, ease: 'none', onComplete: () => gsap.to(u, { opacity: 0 }) }));
  $$('i:not(.gap)', pat).forEach(i => { morseRun.push(gsap.delayedCall(+i.dataset.a, () => i.classList.add('lit'))); });
}

// ---- chirp (simplificado: rápido / medio / lento)
let chirpHead = null;
const SF_INFO = { 7: ['corto', 'alta'], 9: ['medio', 'media'], 12: ['largo', 'baja'] };
function setSF(sf) {
  $$('#sfSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sf === sf));
  buildChirps(chirp, sf);
  const alc = sf === 7 ? 'menor' : sf === 12 ? 'mayor' : 'medio';
  const vel = sf === 7 ? 'mayor' : sf === 12 ? 'menor' : 'media';
  $('#rAlc').textContent = alc; $('#rVel').textContent = vel;
  gsap.fromTo(['#rAlc', '#rVel'], { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, stagger: 0.06 });
}

// ---- OLED grande
const OLED_STATES = [
  ['boot', 'Bienvenida'], ['inicio', 'Reposo'], ['env_SOS_1', 'Enviando SOS'], ['env_CONSULTA_2', 'Reintento 2/3'], ['entregado', 'Entregado'],
  ['fallo', 'Sin respuesta'], ['alert_SOS', 'Llega un SOS'], ['alert_CONSULTA', 'Llega una consulta'], ['alert_OK', 'Llega un OK'],
];
let showOled, showIdx = 1, showAuto = true;
function showState(i, manual) {
  showIdx = i; if (manual) showAuto = false;
  const [st, name] = OLED_STATES[i];
  $$('#oledStates button').forEach((b, k) => b.classList.toggle('on', k === i));
  $('#oledCap').textContent = name;
  const loop = st === 'inicio' || !showAuto;
  showOled.play(st, { loop: st === 'inicio' ? true : !showAuto, then: () => showAuto && showState((showIdx + 1) % OLED_STATES.length) });
  if (st === 'inicio' && showAuto) gsap.delayedCall(3.2, () => { if (cur === IDX.interfaz && showAuto && showIdx === i) showState(i + 1); });
}

// ---- alcance
let envI = 0;
function setEnv(i) {
  envI = i;
  const e = map.userData.envs[i];
  $$('#envSeg button').forEach((b, k) => b.classList.toggle('on', k === i));
  const el = $('#envDist'); gsap.fromTo(el, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45 }); el.textContent = e.dist;
  gsap.to(map.userData.disc.scale, { x: e.r, y: e.r, z: e.r, duration: 1.1, ease: 'power3.inOut' });
  map.userData.envs.forEach((x, k) => gsap.to(x.ring.material, { opacity: k === i ? 1 : 0.28, duration: 0.5 }));
  gsap.to(map.userData.blocks.scale, { y: [1, 0.75, 0.4, 0.06][i], duration: 0.9, ease: 'power2.inOut' });
  emitRing(map, new THREE.Vector3(0, 0.5, 0), { color: C.blue, max: e.r, dur: 1.3 });
}

// ---- índice de pasos por nombre (evita números mágicos al reordenar)
const STEP_KEYS = ['portada', 'cine', 'problema', 'objetivo', 'banda', 'circuito', 'hardware', 'morse', 'senal', 'chirp', 'protocolo', 'interfaz', 'alcance', 'resultados', 'conclusiones'];
const IDX = {}; STEP_KEYS.forEach((k, i) => IDX[k] = i);

// ---- definición de pasos
const steps = [
  { // 1 portada
    cam: at(30, 18, 30, 2, 2, 0, 'desk'), z: 1.4,
    enter() { startAmbient(6); },
  },
  { // 2 CINEMÁTICA del terremoto
    cam: { px: VX, py: 14, pz: VZ + 34, tx: VX, ty: 3, tz: VZ + 1 }, z: 1, cine: true,
    enter(el) { playEarthquake(el); },
    leave() { endEarthquake(); },
  },
  { // 3 problema
    cam: at(30, 40, 88, 6, 2, -2, 'city'), tagsManual: true, z: 1.35,
    enter(el) { loopTl(cityShow(el)); }, leave() { resetCity(); },
  },
  { // 4 objetivo
    cam: at(-2, 9, 19, -8.6, 1.5, 0.6, 'desk'), z: 0.8, solo: true,
    enter() {
      sim.reset(); const tips = ['OK', 'CONSULTA', 'SOS']; let i = 0;
      every(1.7, () => {
        const tipo = tips[i++ % 3]; const cap = nodes.A.userData.btns.find(b => b.userData.tipo === tipo); pressButton(cap);
        emitRing(scene, nodes.A.userData.tip.getWorldPosition(new THREE.Vector3()), { color: tipo === 'SOS' ? C.red : tipo === 'OK' ? C.blue : C.ink, max: 14, dur: 1.6 });
        $$('.signals article').forEach(a => a.classList.toggle('hit', a.dataset.sig === tipo));
      }, 1.3);
    },
    leave() { $$('.signals article').forEach(a => a.classList.remove('hit')); },
  },
  { // 5 banda / espectro
    cam: at(0, 17, 70, 0, 4, -3, 'spec'), z: 1.45,
    enter() {
      const u = spec.userData; const tl = gsap.timeline({ delay: 0.5 });
      tl.to(u.b433.scale, { y: 1, duration: 0.7, ease: 'power3.out' }).to(u.b433.position, { y: 2.1, duration: 0.7, ease: 'power3.out' }, '<')
        .to(u.cross.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2.5)' }, '+=0.1')
        .to(u.b915.scale, { y: 1, duration: 1.0, ease: 'power3.out' }, '+=0.2').to(u.b915.position, { y: 3.75, duration: 1.0, ease: 'power3.out' }, '<');
      u.pillars.forEach((p, i) => tl.to(p.p.scale, { y: 1, duration: 0.9, ease: 'power3.out' }, 1.9 + i * 0.25));
      loopTl(tl);
    },
    leave() { const u = spec.userData; u.b433.scale.y = 0.001; u.b433.position.y = 0.5; u.b915.scale.y = 0.001; u.b915.position.y = 0.5; u.cross.scale.setScalar(0.001); u.pillars.forEach(p => p.p.scale.y = 0.001); },
  },
  { // 6 circuito (esquema + temas de clase)
    cam: { px: P.circuit[0] + 1, py: 20, pz: P.circuit[2] + 33, tx: P.circuit[0], ty: 0.5, tz: P.circuit[2] + 1 }, orbit: 0.05, z: 0.84,
    enter() { circuit.userData.start(); }, leave() { circuit.userData.stop(); },
  },
  { // 7 hardware — centrado
    cam: at(-4, 15, 35, -10.6, 4.4, 0, 'desk'), orbit: 0.14, z: 1.15, solo: true,
    enter() { sim.reset(); explodeNode(nodes.A, 1.15); }, leave() { explodeNode(nodes.A, 0, 0.9); },
  },
  { // 8 morse
    cam: at(-5, 9, 24, -10.6, 1.6, 0, 'desk'), z: 0.82, solo: true,
    enter() { sim.reset(); loops.push(gsap.delayedCall(1.3, () => playMorseDom('SOS'))); },
    leave() { morseRun.forEach(t => t.kill()); sim.reset(); },
  },
  { // 9 señal (anatomía de la onda)
    cam: { px: P.wave[0] + 2, py: 11, pz: P.wave[2] + 40, tx: P.wave[0], ty: 5, tz: P.wave[2] }, z: 0.62,
    enter() { setWaveMode(waveMode); },
    leave() { wave.userData.stop(); },
  },
  { // 10 chirp (simplificado)
    cam: at(5, 13, 59, 0, 5, 0, 'chirp'), z: 1.7,
    enter() {
      setSF(9); const u = chirp.userData;
      chirpHead = gsap.fromTo(u.head.position, { x: -u.W / 2 }, { x: u.W / 2, duration: 3.2, repeat: -1, ease: 'none', delay: 1 }); loopTl(chirpHead);
    },
  },
  { // 11 protocolo
    cam: at(0, 10, 56, 0, 4.4, 0, 'desk'), z: 1.1,
    enter() {
      sim.reset(); sim.zero(); setLoss(1); setAuto(false);
      loops.push(gsap.delayedCall(1.5, () => sim.send('A', 'SOS')));
    },
    leave() { setAuto(false); sim.reset(); },
  },
  { // 12 interfaz
    cam: at(30, 14, 30, 6, 2, 0, 'desk'), z: 1.0, empty: true,
    enter() { sim.reset(); showAuto = true; showState(1); }, leave() { showAuto = false; },
  },
  { // 13 alcance — con movimiento
    cam: at(2, 48, 58, 0, 0, 0, 'map'), orbit: 0.16, z: 0.88,
    enter() {
      const u = map.userData;
      u.envs.forEach((e, i) => gsap.fromTo(e.ring.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.2, delay: 0.5 + i * 0.18, ease: 'power3.out' }));
      gsap.fromTo(u.nA.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1.4, y: 1.4, z: 1.4, duration: 0.6, ease: 'back.out(2)' });
      let i = 0; setEnv(0); every(3.0, () => { if (!envManual) setEnv(++i % 4); }, 3.0);
      every(1.5, () => emitRing(map, new THREE.Vector3(0, 0.5, 0), { color: C.red, max: map.userData.envs[envI].r, dur: 1.4 }), 0.5);
    },
    leave() { envManual = false; gsap.to(map.userData.nA.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 }); },
  },
  { // 14 resultados
    cam: at(30, 18, 32, 2, 2, 0, 'desk'), z: 1.0,
    enter(el) {
      startAmbient(5);
      $$('[data-count]', el).forEach((n, i) => { const o = { v: 0 }, d = +(n.dataset.dec || 0); gsap.to(o, { v: +n.dataset.count, duration: 1.6, delay: 0.5 + i * 0.12, ease: 'power2.out', onUpdate: () => n.textContent = fmt(o.v, d) }); });
    },
  },
  { // 15 conclusiones
    cam: at(30, 18, 34, 2, 2, 0, 'desk'), orbit: 0.05, z: 1.0,
    enter() { startAmbient(5); },
  },
];

// ============================================================================ cinemática del terremoto
const villOled = { A: null, B: null };
let cineTl = null, waveMode = 'anatomia';

function setCine(num, act, cap) {
  $('#cineNum').textContent = num; $('#cineAct').textContent = act; $('#cineCap').textContent = cap || '';
  gsap.fromTo([$('#cineAct'), $('#cineCap')], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', overwrite: true });
}
function tableLed(t, on) {
  const u = t.userData; u.ledMat.color.setHex(on ? 0xff4a38 : 0x9c2a22); u.ledMat.emissive && u.ledMat.emissive.setHex(on ? 0xd8281e : 0); u.ledLight.intensity = on ? 4 : 0;
}
function villMorse(tl, at0, table, tipo) {           // luz + sonido + anillos en Morse (aldea)
  const { marks } = morseTimeline(tipo);
  marks.forEach(([a, b]) => {
    tl.call(() => { tableLed(table, true); audio.set(true); emitRing(village, table.userData.tip.getWorldPosition(tmpV.clone()).sub(village.position), { color: C.red, max: 2.4, dur: 0.5, vertical: false }); }, null, at0 + a);
    tl.call(() => { tableLed(table, false); audio.set(false); }, null, at0 + b);
  });
}
function resetVillage() {
  const u = village.userData;
  u.quake = 0; cam.shake = 0; u._phase = null; audio.set(false);
  [u.chA, u.chB].forEach(c => c.userData.jointsAll.forEach(j => j.userData.off.set(0, 0, 0)));
  setCharState(u.chA, 'sweep'); setCharState(u.chB, 'idle');
  u.phoneA.p.visible = u.phoneB.p.visible = false;
  u.debris.forEach(d => { d.mesh.visible = false; d.active = false; });
  u.towerLamp.material.color.setHex(C.blue); u.tower.rotation.set(0, 0, 0);
  u.houseA.rotation.set(0, 0.5, 0); u.houseB.rotation.set(0, Math.PI - 0.5, 0);
  if (u._base) { u.houseA.position.copy(u._base.a); u.houseB.position.copy(u._base.b); }
  u.crackMats.forEach(m => m.opacity = 0);
  tableLed(u.tableA, false); tableLed(u.tableB, false);
  if (u.linkArc) u.linkArc.geometry.setDrawRange(0, 0);
  villOled.A.play('boot', { then: () => villOled.A.play('inicio', { loop: true }) });
  villOled.B.play('boot', { then: () => villOled.B.play('inicio', { loop: true }) });
  drawPhone(u.phoneA, 'ok', 0); drawPhone(u.phoneB, 'ok', 0);
}

function playEarthquake(el) {
  const u = village.userData;
  resetVillage();
  const cineCam = (tl, o, at0, dur, ease = 'power2.inOut') => tl.to(cam, { ...o, duration: dur, ease }, at0);
  const POS = {
    est1:     { px: VX,       py: 14,  pz: VZ + 34,  tx: VX,       ty: 3,   tz: VZ + 1 },
    chAsweep: { px: VX - 3,   py: 7,   pz: VZ + 18,  tx: VX - 4.6, ty: 3.2, tz: VZ + 3 },
    quake:    { px: VX,       py: 12,  pz: VZ + 29,  tx: VX,       ty: 3.5, tz: VZ },
    houseA:   { px: VX - 6,   py: 9,   pz: VZ + 23,  tx: VX - 8,   ty: 4,   tz: VZ + 2 },
    crouch:   { px: VX - 2.5, py: 7,   pz: VZ + 19,  tx: VX - 4.6, ty: 2.5, tz: VZ + 3.5 },
    phone:    { px: VX - 3,   py: 7,   pz: VZ + 18,  tx: VX - 4.6, ty: 3.5, tz: VZ + 3.5 },
    nodeA:    { px: VX - 2,   py: 6,   pz: VZ + 13.5,  tx: VX - 4.9, ty: 2.6, tz: VZ + 1.6 },
    linkUp:   { px: VX,       py: 12,  pz: VZ + 29,  tx: VX,       ty: 4.5, tz: VZ },
    nodeB:    { px: VX + 8,   py: 6,   pz: VZ + 10,  tx: VX + 4.9, ty: 2.8, tz: VZ - 1.2 },
    chBreact: { px: VX + 8,   py: 7,   pz: VZ + 14,  tx: VX + 4.5, ty: 3.6, tz: VZ - 4 },
    final:    { px: VX,       py: 12,  pz: VZ + 31,  tx: VX,       ty: 4,   tz: VZ },
  };

  Object.assign(cam, POS.est1);
  const tl = gsap.timeline({ onComplete: () => { $('#cineReplay').classList.add('show'); } });
  cineTl = tl;

  // ACTO 01 — normalidad (termina en primer plano del vecino)
  tl.call(() => setCine('01', 'Una tarde cualquiera', 'Dos casas, dos vecinos. La red celular funciona con normalidad.'), null, 0);
  cineCam(tl, POS.chAsweep, 0.3, 4.8, 'power1.inOut');

  // ACTO 02 — terremoto
  tl.call(() => setCine('02', 'La tierra tiembla', 'Un sismo sacude el sector: tiemblan las casas, caen escombros, se levanta el polvo.'), null, 5.2);
  tl.to(u, { quake: 1, duration: 0.9, ease: 'power2.in' }, 5.2);
  tl.to(cam, { shake: 0.42, duration: 0.9 }, 5.2);
  tl.call(() => { setCharState(u.chA, 'panic'); setCharState(u.chB, 'panic'); }, null, 5.4);
  cineCam(tl, POS.quake, 5.4, 2.0, 'power2.out');
  for (let k = 0; k < 6; k++) tl.call(() => { dropDebris(village, Math.random() < 0.5 ? u.houseA : u.houseB, 2); burstDust(village, (Math.random() - 0.5) * 12, 3, (Math.random() - 0.5) * 10, 10, 1.6); }, null, 5.8 + k * 0.7);
  tl.to(u.crackMats, { opacity: 0.85, duration: 0.6, stagger: 0.08 }, 6.6);
  tl.to(u.tower.rotation, { z: 0.5, duration: 2.4, ease: 'power1.in' }, 6.6);
  cineCam(tl, POS.houseA, 8.2, 2.0, 'power2.inOut');
  cineCam(tl, POS.crouch, 10.4, 2.0, 'power2.inOut');
  tl.call(() => { setCharState(u.chA, 'crouch'); setCharState(u.chB, 'crouch'); }, null, 10.4);
  tl.call(() => { u.towerLamp.material.color.setHex(C.ink); }, null, 11.6);
  tl.to(u, { quake: 0.1, duration: 1.6, ease: 'power2.out' }, 12.0);
  tl.to(cam, { shake: 0.06, duration: 1.6 }, 12.0);

  // ACTO 03 — se cae la red
  tl.call(() => setCine('03', 'Se cae la red', 'Buscan señal en el teléfono. No hay: la torre quedó fuera de servicio.'), null, 13.6);
  tl.call(() => { setCharState(u.chA, 'phone'); setCharState(u.chB, 'phone'); u.phoneA.p.visible = true; u.phoneB.p.visible = true; u._phase = 'searching'; }, null, 13.8);
  cineCam(tl, POS.phone, 13.8, 2.0, 'power2.inOut');
  tl.to(u, { quake: 0, duration: 1.0 }, 13.8); tl.to(cam, { shake: 0, duration: 1.0 }, 13.8);
  tl.call(() => { u._phase = 'nosignal'; drawPhone(u.phoneA, 'nosignal', 0); drawPhone(u.phoneB, 'nosignal', 0); }, null, 17.2);

  // ACTO 04 — el nodo
  tl.call(() => setCine('04', 'El nodo de emergencia', 'Encienden el nodo LoRa. No necesita antenas ni operador: se comunica solo.'), null, 18.8);
  tl.call(() => { setCharState(u.chA, 'reach'); u.phoneA.p.visible = false; }, null, 19.0);
  cineCam(tl, POS.nodeA, 19.0, 2.2, 'power2.inOut');
  tl.call(() => { setCharState(u.chA, 'hold'); }, null, 21.4);
  tl.call(() => { const cap = u.tableA.userData.btns.SOS; gsap.timeline().to(cap.position, { y: cap.userData.y0 - 0.08, duration: 0.08 }).to(cap.position, { y: cap.userData.y0, duration: 0.2, ease: 'back.out(3)' }); villOled.A.play('env_SOS_1', { then: () => villOled.A.play('inicio', { loop: true }) }); }, null, 22.2);
  villMorse(tl, 22.3, u.tableA, 'SOS');

  // ACTO 05 — transmisión
  tl.call(() => setCine('05', 'Transmisión del SOS', 'La señal de radio cruza de una casa a la otra, sin ninguna red de por medio.'), null, 26.4);
  cineCam(tl, POS.linkUp, 26.2, 2.0, 'power2.inOut');
  tl.call(() => {
    const a = u.tableA.userData.tip.getWorldPosition(tmpV.clone()).sub(village.position);
    const b = u.tableB.userData.tip.getWorldPosition(new THREE.Vector3()).sub(village.position);
    emitRing(village, a, { color: C.red, max: 8, dur: 1.4 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.4 })); ball.castShadow = true; village.add(ball);
    const mid = a.clone().lerp(b, 0.5); mid.y += 7; const curve = new THREE.QuadraticBezierCurve3(a, mid, b); const s = { t: 0 };
    gsap.to(s, { t: 1, duration: 2.2, ease: 'power1.inOut', onUpdate: () => curve.getPoint(s.t, ball.position), onComplete: () => { village.remove(ball); emitRing(village, b, { color: C.red, max: 7, dur: 1.2 }); } });
  }, null, 27.0);

  // ACTO 06 — recepción + ACK
  tl.call(() => setCine('06', 'Recepción y confirmación', 'El otro nodo recibe el aviso, avisa a su vecino y devuelve un ACK: el mensaje llegó.'), null, 29.4);
  tl.call(() => { villOled.B.play('alert_SOS', { then: () => villOled.B.play('inicio', { loop: true }) }); }, null, 29.4);
  villMorse(tl, 29.6, u.tableB, 'SOS');
  cineCam(tl, POS.nodeB, 29.4, 1.8, 'power2.inOut');
  tl.call(() => { setCharState(u.chB, 'relief'); }, null, 31.0);
  cineCam(tl, POS.chBreact, 31.2, 1.8, 'power2.inOut');
  tl.call(() => {
    const b = u.tableB.userData.tip.getWorldPosition(tmpV.clone()).sub(village.position);
    const a = u.tableA.userData.tip.getWorldPosition(new THREE.Vector3()).sub(village.position);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.5 })); village.add(ball);
    const mid = a.clone().lerp(b, 0.5); mid.y += 6.5; const curve = new THREE.QuadraticBezierCurve3(b, mid, a); const s = { t: 0 };
    gsap.to(s, { t: 1, duration: 1.8, ease: 'power1.inOut', onUpdate: () => curve.getPoint(s.t, ball.position), onComplete: () => { village.remove(ball); villOled.A.play('entregado', { then: () => villOled.A.play('inicio', { loop: true }) }); } });
  }, null, 32.4);
  tl.call(() => { setCharState(u.chA, 'relief'); }, null, 34.2);
  cineCam(tl, POS.final, 34.4, 2.4, 'power2.inOut');
  tl.to({ n: 0 }, { n: u.linkCount, duration: 1.6, ease: 'power2.inOut', onUpdate() { u.linkArc.geometry.setDrawRange(0, Math.floor(this.targets()[0].n / 6) * 6); } }, 34.6);
  tl.call(() => setCine('—', 'El enlace existe', 'Dos nodos, sin red celular ni internet, con la certeza de que el mensaje llegó.'), null, 36.6);
}

function endEarthquake() {
  if (cineTl) { cineTl.kill(); cineTl = null; }
  gsap.killTweensOf(village.userData);
  $('#cineReplay').classList.remove('show');
  resetVillage();
}

// ---- laboratorio de señales
function setWaveMode(mode) {
  waveMode = mode; wave.userData.setMode(mode);
  $$('#waveSeg button').forEach(b => b.classList.toggle('on', b.dataset.w === mode));
}

// ---- controles del protocolo
const LOSS = [0, 0.3, 0.6, 1]; let autoH = null, envManual = false;
function setLoss(i) { sim.loss = LOSS[i]; $$('#lossSeg button').forEach((b, k) => b.classList.toggle('on', k === i)); }
function setAuto(v) {
  $('#btnAuto').setAttribute('aria-pressed', v); if (autoH) { autoH.kill(); autoH = null; }
  if (v) { const t = ['OK', 'CONSULTA', 'SOS']; autoH = every(3.6, () => sim.send(Math.random() < 0.5 ? 'A' : 'B', t[(Math.random() * 3) | 0]), 0.2); }
}

// ============================================================================ navegación
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/); el.textContent = '';
  words.forEach((w, i) => { const o = document.createElement('span'); o.className = 'w'; const s = document.createElement('span'); s.textContent = w; o.append(s); el.append(o); if (i < words.length - 1) el.append(' '); });
}
$$('.split').forEach(splitWords);
$('#tot').textContent = String(steps.length).padStart(2, '0');

// riel
const segsEl = $('#segs'); const tickBtns = [];
WHO.forEach((w, wi) => {
  const idxs = stepEls.map((el, i) => +el.dataset.who === wi ? i : -1).filter(i => i >= 0);
  const sg = document.createElement('div'); sg.className = 'sg'; sg.style.setProperty('--n', idxs.length);
  sg.innerHTML = `<div class="who"><b>${w.name}</b><span>${w.topic}</span></div><div class="tks"></div>`;
  idxs.forEach(i => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Ir al paso ' + (i + 1)); b.addEventListener('click', () => go(i)); $('.tks', sg).append(b); tickBtns[i] = b; });
  sg.dataset.w = wi; segsEl.append(sg);
});

function reveal(el, step) {
  const tl = gsap.timeline();
  tl.fromTo($$('.split .w>span', el), { yPercent: 115 }, { yPercent: 0, duration: 0.8, ease: 'power4.out', stagger: 0.035 }, 0);
  tl.fromTo($$('[data-a]', el), { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.07 }, 0.15);
  if (!step.tagsManual) tl.fromTo($$('.tag', el), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.09 }, 0.9);
  if (reduce) tl.progress(1);
  return tl;
}

let moving = false;
function go(i, instant) {
  i = Math.max(0, Math.min(steps.length - 1, i));
  if (i === cur) return;
  const prev = cur; cur = i;
  scene.visible = true;
  // salir
  loops.forEach(l => l.kill && l.kill()); loops = [];
  if (stepTl) stepTl.kill();
  if (prev >= 0) { const pe = stepEls[prev]; steps[prev].leave && steps[prev].leave(); gsap.killTweensOf($$('*', pe)); pe.classList.remove('on'); }
  // riel
  $('#cur').textContent = String(i + 1).padStart(2, '0');
  tickBtns.forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.toggle('cur', k === i); });
  $$('.sg').forEach(s => s.classList.toggle('cur', +s.dataset.w === +stepEls[i].dataset.who));
  // cámara
  const st = steps[i]; const far = prev < 0 ? 0 : Math.hypot(st.cam.tx - cam.tx, st.cam.tz - cam.tz);
  const dur = instant || reduce ? 0 : far > 60 ? 2.1 : 1.5;
  gsap.killTweensOf(cam);
  const lift = { k: 0 }; cam.lift = 0;
  gsap.to(cam, { ...st.cam, z: st.z ?? 1, orbit: 0, duration: dur, ease: 'power3.inOut' });
  if (far > 60 && dur) gsap.to(lift, { k: 1, duration: dur, ease: 'none', onUpdate: () => cam.lift = Math.sin(Math.PI * lift.k) * 26, onComplete: () => cam.lift = 0 });
  cam.orbitSpeed = st.orbit || 0; cam.cine = !!st.cine; cam.shake = 0; dragA = 0; dragEl = 0;
  deselectComp(); $('#restore').hidden = true;
  moving = true;
  gsap.delayedCall(dur * 0.55, () => {
    if (cur !== i) return;
    nodes.B.visible = !st.solo; scene.visible = !st.empty;
    const el = stepEls[i]; el.classList.add('on');
    gsap.set($$('.tag', el), { opacity: 0 });
    st.enter && st.enter(el);
    stepTl = reveal(el, st);
    moving = false;
  });
  try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
}
const next = () => go(cur + 1), prevStep = () => go(cur - 1);
$('#next').addEventListener('click', next); $('#prev').addEventListener('click', prevStep);
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { if (e.key === ' ' && document.activeElement && document.activeElement.tagName === 'BUTTON') return; e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prevStep(); }
  else if (e.key === 'Home') go(0); else if (e.key === 'End') go(steps.length - 1);
  else if (e.key === 'f' || e.key === 'F') toggleFull(); else if (e.key === 's' || e.key === 'S') toggleSound();
  else if (e.key === 'r' || e.key === 'R') resetView();
});
let wheelLock = 0;
addEventListener('wheel', e => { const n = performance.now(); if (n < wheelLock || Math.abs(e.deltaY) < 25) return; wheelLock = n + 1100; e.deltaY > 0 ? next() : prevStep(); }, { passive: true });
let tsx = null;
addEventListener('touchstart', e => { tsx = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => { if (tsx == null) return; const dx = e.changedTouches[0].clientX - tsx; tsx = null; if (Math.abs(dx) > 60) dx < 0 ? next() : prevStep(); }, { passive: true });

function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); }
function toggleSound() { audio.enable(!audio.on); const b = $('#btnSound'); b.textContent = 'Sonido: ' + (audio.on ? 'sí' : 'no'); b.setAttribute('aria-pressed', audio.on); }
$('#btnFull').addEventListener('click', toggleFull); $('#btnSound').addEventListener('click', toggleSound);

// puntero: paralaje + interacción 3D (enviar, seleccionar componente, orbitar con arrastre)
addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; });
const ray = new THREE.Raycaster();
const compCard = $('#compCard'), restoreBtn = $('#restore');
let selected = null, selBase = null, dragging = false, dsx = 0, dsy = 0, dMoved = 0;
const ndc = e => new THREE.Vector2((e.clientX - view.x) / view.w * 2 - 1, -((e.clientY - view.y) / view.h * 2 - 1));
function showRestore() { restoreBtn.hidden = false; }
function hideRestore() { if (!selected && !dragA && !dragEl) restoreBtn.hidden = true; }
function selectComp(o) {
  if (selected === o) return;
  deselectComp(true);
  selected = o; selBase = o.position.clone();
  const ex = o.userData.ex; const dir = ex && ex.length() > 0.01 ? ex.clone().normalize() : new THREE.Vector3(0, 1, 0);
  gsap.to(o.position, { x: selBase.x + dir.x * 1.5, y: selBase.y + dir.y * 1.5, z: selBase.z + dir.z * 1.5, duration: 0.4, ease: 'power3.out' });
  emitRing(scene, o.getWorldPosition(new THREE.Vector3()), { color: C.red, max: 5, dur: 1 });
  const info = o.userData.comp;
  $('h4', compCard).textContent = info.t; $('.cc-d', compCard).textContent = info.d; $('.cc-calc', compCard).textContent = info.c || '';
  compCard.hidden = false; gsap.fromTo(compCard, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
  showRestore();
}
function deselectComp(skipHide) {
  if (selected) { gsap.to(selected.position, { x: selBase.x, y: selBase.y, z: selBase.z, duration: 0.3, ease: 'power2.inOut' }); selected = null; }
  compCard.hidden = true; if (!skipHide) hideRestore();
}
function resetView() { gsap.to({ a: dragA, e: dragEl }, { a: 0, e: 0, duration: 0.5, ease: 'power2.inOut', onUpdate() { dragA = this.targets()[0].a; dragEl = this.targets()[0].e; } }); deselectComp(); restoreBtn.hidden = true; }
restoreBtn.addEventListener('click', resetView);
$('#compClose').addEventListener('click', () => deselectComp());

canvas.addEventListener('pointerdown', e => {
  if (!sim) return;
  ray.setFromCamera(ndc(e), camera);
  const bhit = ray.intersectObjects([...nodes.A.userData.btns, ...nodes.B.userData.btns], false)[0];
  if (bhit && [IDX.portada, IDX.protocolo, IDX.resultados, IDX.conclusiones].includes(cur)) { sim.send(bhit.object.userData.node, bhit.object.userData.tipo); return; }
  if (cur === IDX.hardware) {
    const chit = ray.intersectObject(nodes.A, true)[0];
    if (chit) { let o = chit.object; while (o && !o.userData.comp) o = o.parent; if (o) { selectComp(o); return; } }
  }
  dragging = true; dsx = e.clientX; dsy = e.clientY; dMoved = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - dsx, dy = e.clientY - dsy; dsx = e.clientX; dsy = e.clientY; dMoved += Math.abs(dx) + Math.abs(dy);
  dragA = Math.max(-1.1, Math.min(1.1, dragA + dx * 0.005));
  dragEl = Math.max(-9, Math.min(16, dragEl - dy * 0.14));
  showRestore();
});
addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('dblclick', resetView);

// ============================================================================ bucle
const tagsOf = stepEls.map(el => $$('.tag', el).map(t => ({ el: t, a: anchors[t.dataset.anchor], side: t.dataset.side, color: t.classList.contains('red') ? 'l-red' : t.classList.contains('blue') ? 'l-blue' : '' })));
const leaderSvg = $('#leaders'); const SVGNS = 'http://www.w3.org/2000/svg'; const leaderPool = [];
function leader(i) { if (leaderPool[i]) return leaderPool[i]; const ln = document.createElementNS(SVGNS, 'line'); const ci = document.createElementNS(SVGNS, 'circle'); ci.setAttribute('r', '3'); leaderSvg.append(ln, ci); const o = { ln, ci }; leaderPool[i] = o; return o; }
const TPAD = 12;
const clock = new THREE.Clock(); let orbitA = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05;
  orbitA += (cam.orbitSpeed || 0) * dt;
  const pf = cam.cine ? 0.18 : 1;                      // menos paralaje durante la cinemática
  const ox = cam.px - cam.tx, oz = cam.pz - cam.tz; const a = Math.sin(orbitA) * 0.55 + (pointer.sx * -0.045 + Math.sin(t * 0.21) * 0.012) * pf + (dragA || 0);
  const ca = Math.cos(a), sa = Math.sin(a);
  const sh = cam.shake || 0;
  camera.position.set(
    cam.tx + ox * ca - oz * sa + (Math.random() - 0.5) * sh,
    cam.py + (cam.lift || 0) + (pointer.sy * 0.9 + Math.sin(t * 0.33) * 0.12) * pf + (Math.random() - 0.5) * sh * 0.8 + (dragEl || 0),
    cam.tz + ox * sa + oz * ca + (Math.random() - 0.5) * sh);
  camera.lookAt(cam.tx + (Math.random() - 0.5) * sh * 0.4, cam.ty + (Math.random() - 0.5) * sh * 0.4, cam.tz);
  // zona útil del escenario: se reserva margen solo en los lados que tienen etiquetas
  let wantZ = 1, wantO = 0;
  if (cur >= 0 && view.w >= 640) { const L = tagsOf[cur].some(t => t.side === 'l'), R = tagsOf[cur].some(t => t.side === 'r'); const xl = L ? view.G : 12, xr = view.w - (R ? view.G : 12); if (L || R) { wantZ = (xr - xl) / view.w; wantO = (xl + xr) / 2 - view.w / 2; } }
  const kk = Math.min(1, dt * 5); zs += (wantZ - zs) * kk; offs += (wantO - offs) * kk;
  camera.zoom = zs * (cam.z || 1); camera.setViewOffset(view.w, view.h, -offs, 0, view.w, view.h);
  sun.position.set(cam.tx + 16, 44, cam.tz + 22); sun.target.position.set(cam.tx, 0, cam.tz);

  if (sim) {
    oleds.A.tick(dt); oleds.B.tick(dt); if (cur === IDX.interfaz && showOled) showOled.tick(dt); sim.update();
    if (cur === IDX.cine) { villOled.A.tick(dt); villOled.B.tick(dt); updateVillage(village, dt, t); if (village.userData._phase === 'searching') { drawPhone(village.userData.phoneA, 'searching', t); drawPhone(village.userData.phoneB, 'searching', t); } if (cineTl) $('#cineProg').style.width = (cineTl.progress() * 100) + '%'; }
    if (cur === IDX.senal) wave.userData.update(dt, t);
    if (cur === IDX.circuito) circuit.userData.update(dt, t);
  }
  // enlaces de la ciudad
  if (cur === IDX.problema) for (const l of city.userData.links) {
    if (!l.alive) continue;
    l.ph = (l.ph + dt * (l.jam ? 0.06 : l.speed)) % 1;
    l.dot.position.lerpVectors(l.a, l.b, l.jam ? 0.5 + Math.sin(t * 30 + l.ph * 40) * 0.02 : l.ph);
  }
  if (renderer) renderer.render(scene, camera);
  // etiquetas: el TEXTO vive en los márgenes (nunca sobre el 3D) y una línea guía lo une al punto 3D
  let used = 0;
  if (cur >= 0 && stepEls[cur].classList.contains('on')) {
    const PAD = TPAD, W = innerWidth, topMin = view.y + 22, botMax = view.y + view.h - 22, gw = view.G - PAD - 8, showTags = view.w >= 640;
    const arr = [];
    for (const tg of tagsOf[cur]) {
      if (!tg.a) continue;
      tg.a.getWorldPosition(tmpV).project(camera);
      const vis = showTags && tmpV.z < 1 && tmpV.x > -1.15 && tmpV.x < 1.15;
      const ax = view.x + (tmpV.x * 0.5 + 0.5) * view.w, ay = view.y + (-tmpV.y * 0.5 + 0.5) * view.h;
      arr.push({ tg, ax, ay: Math.max(topMin, Math.min(botMax, ay)), side: tg.side, vis });
    }
    // de-colisión vertical por margen
    for (const sd of ['l', 'r']) {
      const col = arr.filter(o => o.vis && o.side === sd).sort((a, b) => a.ay - b.ay);
      for (let i = 0; i < col.length; i++) {
        const h = col[i].tg.el.offsetHeight || 26;
        if (i > 0) { const prev = col[i - 1]; const minY = prev.cy + (prev.h + h) / 2 + 8; if (col[i].ay < minY) col[i].ay = minY; }
        col[i].cy = Math.min(botMax, col[i].ay); col[i].h = h;
      }
    }
    for (const o of arr) {
      const tg = o.tg, el = tg.el;
      el.style.display = o.vis ? '' : 'none';
      if (!o.vis) continue;
      const cy = o.cy != null ? o.cy : o.ay;
      el.style.top = cy + 'px'; el.style.maxWidth = gw + 'px';
      if (o.side === 'l') { el.style.left = (view.x + PAD) + 'px'; el.style.right = 'auto'; } else { el.style.right = (W - view.x - view.w + PAD) + 'px'; el.style.left = 'auto'; }
      const w = el.offsetWidth;
      const lx = o.side === 'l' ? view.x + PAD + w + 6 : view.x + view.w - PAD - w - 6;      // borde interior del texto
      const ld = leader(used++);
      ld.ln.setAttribute('x1', lx); ld.ln.setAttribute('y1', cy); ld.ln.setAttribute('x2', o.ax); ld.ln.setAttribute('y2', o.ay);
      ld.ci.setAttribute('cx', o.ax); ld.ci.setAttribute('cy', o.ay);
      if (o.ax < view.x || o.ax > view.x + view.w) { el.style.display = 'none'; used--; continue; }
      const cls = tg.color; ld.ln.setAttribute('class', cls); ld.ci.setAttribute('class', cls);
      ld.ln.style.display = ''; ld.ci.style.display = '';
      ld.ln.style.opacity = el.style.opacity || getComputedStyle(el).opacity;
      ld.ci.style.opacity = ld.ln.style.opacity;
    }
  }
  for (let i = used; i < leaderPool.length; i++) { leaderPool[i].ln.style.display = 'none'; leaderPool[i].ci.style.display = 'none'; }
  requestAnimationFrame(frame);
}
function resize() {
  const r = canvas.getBoundingClientRect(); view.x = r.left; view.y = r.top; view.w = Math.max(200, r.width); view.h = Math.max(200, r.height);
  view.G = Math.max(112, Math.min(200, view.w * 0.165));
  const asp = view.w / view.h, A0 = 1.7, v0 = 32 * Math.PI / 180;
  camera.aspect = asp; camera.fov = (asp < A0 ? 2 * Math.atan(Math.tan(v0 / 2) * A0 / asp) : v0) * 180 / Math.PI; camera.updateProjectionMatrix();
  renderer && renderer.setSize(view.w, view.h, false);
  leaderSvg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`); leaderSvg.setAttribute('width', innerWidth); leaderSvg.setAttribute('height', innerHeight);
}
addEventListener('resize', resize); resize();

// ============================================================================ arranque
(async function init() {
  const [ia, ib] = await Promise.all([loadImg(D.oledA), loadImg(D.oledB)]);
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  ['A', 'B'].forEach((id, k) => {
    const o = new Oled(k ? ib : ia, D.oled); o.addCanvas(nodes[id].userData.canvas); o.onDraw = () => nodes[id].userData.tex.needsUpdate = true; o.play('boot', { then: () => o.play('inicio', { loop: true }) }); oleds[id] = o;
  });
  showOled = new Oled(ib, D.oled); showOled.addCanvas($('#oledBig'), 'dots');
  // OLED de los nodos de la aldea
  villOled.A = new Oled(ia, D.oled); villOled.A.addCanvas(village.userData.screens.A.canvas, 'dots'); villOled.A.onDraw = () => village.userData.tableA.userData.tex.needsUpdate = true;
  villOled.B = new Oled(ib, D.oled); villOled.B.addCanvas(village.userData.screens.B.canvas, 'dots'); villOled.B.onDraw = () => village.userData.tableB.userData.tex.needsUpdate = true;
  villOled.A.play('inicio', { loop: true }); villOled.B.play('inicio', { loop: true });
  // enlace persistente entre los nodos de la aldea (acto final)
  village.updateWorldMatrix(true, true);
  { const a = village.userData.tableA.userData.tip.getWorldPosition(new THREE.Vector3()).sub(village.position);
    const b = village.userData.tableB.userData.tip.getWorldPosition(new THREE.Vector3()).sub(village.position);
    const mid = a.clone().lerp(b, 0.5); mid.y += 7;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.08, 8), new THREE.MeshBasicMaterial({ color: C.red }));
    arc.geometry.setDrawRange(0, 0); village.add(arc);
    village.userData.linkArc = arc; village.userData.linkCount = 80 * 8 * 6; }
  sim = createSim({ scene, nodes, oleds, camera });
  sim.on((ev, d) => {
    const s = sim.stats;
    if (ev === 'stats') { $('#stSent').textContent = s.sent; $('#stDel').textContent = s.delivered; $('#stRet').textContent = s.retries; $('#stFail').textContent = s.failed; }
    const log = $('#simLog'); const nm = id => 'Nodo ' + id;
    if (ev === 'attempt') log.textContent = `${nm(d.from)} envía ${d.tipo} · intento ${d.n}/3`;
    else if (ev === 'lost') log.textContent = 'Paquete perdido en el canal';
    else if (ev === 'rx') log.textContent = d.dup ? `${nm(d.to)} recibe un duplicado: confirma, no vuelve a sonar` : `${nm(d.to)} recibe ${d.tipo} y responde ACK`;
    else if (ev === 'delivered') log.textContent = `Entregado y confirmado en el intento ${d.n}`;
    else if (ev === 'failed') log.textContent = 'Tres intentos sin ACK: sin respuesta';
    else if (ev === 'busy') log.textContent = `${nm(d.from)} ocupado: espera la confirmación anterior`;
    if (ev === 'force') $('#btnLose').classList.remove('armed');
  });
  $$('[data-send]').forEach(b => b.addEventListener('click', () => { const [n, t] = b.dataset.send.split(':'); sim.send(n, t); }));
  $$('#lossSeg button').forEach((b, i) => b.addEventListener('click', () => setLoss(i)));
  $('#btnLose').addEventListener('click', () => { sim.forceLose = 1; $('#btnLose').classList.add('armed'); });
  $('#btnAuto').addEventListener('click', () => setAuto($('#btnAuto').getAttribute('aria-pressed') !== 'true'));
  $$('#sfSeg button').forEach(b => b.addEventListener('click', () => setSF(+b.dataset.sf)));
  $('#cineReplay').addEventListener('click', () => { $('#cineReplay').classList.remove('show'); playEarthquake(stepEls[IDX.cine]); });
  $$('#waveSeg button').forEach(b => b.addEventListener('click', () => setWaveMode(b.dataset.w)));
  $$('#envSeg button').forEach((b, i) => b.addEventListener('click', () => { envManual = true; setEnv(i); }));
  OLED_STATES.forEach(([, name], i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.addEventListener('click', () => showState(i, true)); $('#oledStates').append(b); });
  buildMorseDom();
  const h = parseInt(location.hash.slice(1), 10);
  Object.assign(cam, steps[0].cam, { z: steps[0].z ?? 1 });
  go(h >= 1 && h <= steps.length ? h - 1 : 0, true);
  window.__deck = { go, steps, sim, cam, at, gsap, selectComp, resetView, parts: nodes.A.userData.parts, setCam(o) { gsap.killTweensOf(cam); Object.assign(cam, o); }, get cur() { return cur; } };
  frame();
})();
