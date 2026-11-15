import * as THREE from 'three';
import gsap from 'gsap';
import { C, makePacket, emitRing, setLed, pressButton } from './world.js';

// ----------------------------------------------------------------------------- OLED (cuadros reales del firmware)
// Lee una hoja de sprites de 128x64 generada por el mismo codigo de dibujo del
// firmware y la vuelve a dibujar como matriz de puntos suaves: se ve como un OLED
// real (definido, no "bloques"), respetando el contenido exacto de cada estado.
const _src = document.createElement('canvas'); _src.width = 128; _src.height = 64;
const _sg = _src.getContext('2d', { willReadFrequently: true }); _sg.imageSmoothingEnabled = false;

export class Oled {
  constructor(img, index) { this.img = img; this.idx = index; this.targets = []; this.state = 'inicio'; this.frame = 0; this.acc = 0; this.loop = true; this.then = null; this.onDraw = null; this.dirty = true; }
  addCanvas(cv, mode = 'dots') { const g = cv.getContext('2d'); this.targets.push({ cv, g, mode }); this.dirty = true; }
  play(state, { loop = false, then = null } = {}) {
    if (!this.idx.states[state]) return;
    this.state = state; this.frame = 0; this.acc = 0; this.loop = loop; this.then = then; this.dirty = true;
  }
  length(state) { return this.idx.states[state][1] * 0.08; }
  renderDots(g, W, H) {
    const cx = W / 128, cy = H / 64, r = Math.min(cx, cy) * 0.52;
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    const px = _sg.getImageData(0, 0, 128, 64).data;
    if (r > 2.3) { g.fillStyle = '#0e1726'; for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) { if (px[(y * 128 + x) * 4] > 90) continue; g.beginPath(); g.arc((x + 0.5) * cx, (y + 0.5) * cy, r * 0.5, 0, 6.2832); g.fill(); } }
    g.fillStyle = '#e8f2ff';
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) { if (px[(y * 128 + x) * 4] < 90) continue; g.beginPath(); g.arc((x + 0.5) * cx, (y + 0.5) * cy, r, 0, 6.2832); g.fill(); }
  }
  tick(dt) {
    this.acc += dt;
    const [start, count] = this.idx.states[this.state];
    while (this.acc >= 0.08) {
      this.acc -= 0.08; this.frame++; this.dirty = true;
      if (this.frame >= count) {
        if (this.loop) this.frame = 0;
        else { this.frame = count - 1; const t = this.then; this.then = null; if (t) { t(); return; } }
      }
    }
    if (!this.dirty) return;
    this.dirty = false;
    const f = start + this.frame, sx = (f % this.idx.cols) * 128, sy = Math.floor(f / this.idx.cols) * 64;
    _sg.clearRect(0, 0, 128, 64); _sg.drawImage(this.img, sx, sy, 128, 64, 0, 0, 128, 64);
    for (const { cv, g, mode } of this.targets) {
      if (mode === 'dots') this.renderDots(g, cv.width, cv.height);
      else { g.imageSmoothingEnabled = false; g.drawImage(_src, 0, 0, 128, 64, 0, 0, cv.width, cv.height); }
    }
    if (this.onDraw) this.onDraw();
  }
}

// ----------------------------------------------------------------------------- sonido (zumbador)
export const audio = {
  on: false, ctx: null, osc: null, gain: null,
  enable(v) {
    this.on = v;
    if (v && !this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.osc = this.ctx.createOscillator(); this.osc.type = 'square'; this.osc.frequency.value = 2300;
        this.gain = this.ctx.createGain(); this.gain.gain.value = 0;
        this.osc.connect(this.gain).connect(this.ctx.destination); this.osc.start();
      } catch (e) { this.on = false; }
    }
    if (this.ctx && v) this.ctx.resume();
    if (!v && this.gain) this.gain.gain.value = 0;
  },
  set(on) { if (this.gain) this.gain.gain.setTargetAtTime(on && this.on ? 0.035 : 0, this.ctx.currentTime, 0.004); },
};

export const MORSE = { SOS: ['... --- ...', 150], CONSULTA: ['..--..', 110], OK: ['--- -.-', 110] };
export function morseTimeline(tipo) {
  const [pat, u] = MORSE[tipo]; const out = []; let c = 0;
  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i];
    if (ch === ' ') { c += 2 * u; continue; }
    const d = ch === '.' ? u : 3 * u; out.push([c / 1000, (c + d) / 1000, ch]); c += d; if (pat[i + 1]) c += u;
  }
  return { marks: out, total: c / 1000 };
}

// ----------------------------------------------------------------------------- simulación del protocolo
export function createSim({ scene, nodes, oleds, camera }) {
  const sim = {
    loss: 0.3, forceLose: 0, speed: 1, enabled: true, listeners: [],
    stats: { sent: 0, delivered: 0, retries: 0, failed: 0, received: 0 },
    pend: { A: null, B: null }, lastRx: { A: null, B: null }, counter: 41000 + Math.floor(Math.random() * 900),
    packets: [], calls: [], log: null,
  };
  const emit = (ev, d) => sim.listeners.forEach(f => f(ev, d));
  const later = (t, fn) => { const c = gsap.delayedCall(t / sim.speed, fn); sim.calls.push(c); return c; };
  const other = id => (id === 'A' ? 'B' : 'A');
  const tipPos = id => nodes[id].userData.tip.getWorldPosition(new THREE.Vector3());
  const buzPos = id => nodes[id].userData.buz.getWorldPosition(new THREE.Vector3());

  function playMorse(id, tipo) {
    const { marks } = morseTimeline(tipo);
    marks.forEach(([a, b]) => {
      later(a, () => { setLed(nodes[id], true); audio.set(true); emitRing(scene, buzPos(id), { max: 3.2, dur: 0.5, color: C.ink, opacity: 0.5 }); });
      later(b, () => { setLed(nodes[id], false); audio.set(false); });
    });
  }
  function beep(id, n, on, off) {
    for (let i = 0; i < n; i++) {
      later(i * (on + off), () => { setLed(nodes[id], true); audio.set(true); });
      later(i * (on + off) + on, () => { setLed(nodes[id], false); audio.set(false); });
    }
  }

  function fly(from, to, fields, { lost, onArrive }) {
    const p = makePacket(fields); p.scale.setScalar(0.001); scene.add(p);
    const a = tipPos(from), b = tipPos(to);
    const st = { t: 0 }; const item = { p, dead: false }; sim.packets.push(item);
    const place = () => { p.position.lerpVectors(a, b, st.t); p.position.y += Math.sin(Math.PI * st.t) * 4.2 + 0.9; };
    place();
    gsap.to(p.scale, { x: 1, y: 1, z: 1, duration: 0.25 / sim.speed, ease: 'back.out(2)' });
    emitRing(scene, a, { max: 16, dur: 1.5, color: C.ink });
    later(0.18, () => emitRing(scene, a, { max: 16, dur: 1.5, color: C.ink, opacity: 0.4 }));
    const done = () => { scene.remove(p); item.dead = true; sim.packets = sim.packets.filter(x => !x.dead); };
    if (lost) {
      gsap.to(st, { t: 0.5 + Math.random() * 0.15, duration: 0.5 / sim.speed, ease: 'none', onUpdate: place, onComplete: () => {
        emit('lost', { from });
        item.free = true;
        gsap.to(p.position, { y: 0.6, duration: 0.55, ease: 'power2.in' });
        gsap.to(p.rotation, { z: (Math.random() - 0.5) * 2.4, x: 0.8, duration: 0.55 });
        p.userData.slabs.forEach(s => s.material.forEach(m => { m.transparent = true; gsap.to(m, { opacity: 0, duration: 0.5, delay: 0.45 }); }));
        gsap.delayedCall(1.0, done);
      } });
    } else {
      gsap.to(st, { t: 1, duration: 0.8 / sim.speed, ease: 'power1.inOut', onUpdate: place, onComplete: () => {
        gsap.to(p.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.18, onComplete: done });
        onArrive && onArrive();
      } });
    }
  }

  const fieldsMsg = (from, tipo, cnt) => [
    { t: 'CSOS', bg: '#3a3f46', fg: '#f7f6f2' }, { t: from, bg: '#f7f6f2', fg: '#16181c' },
    { t: tipo, bg: tipo === 'SOS' ? '#d8281e' : tipo === 'OK' ? '#1e4bd2' : '#f7f6f2', fg: tipo === 'CONSULTA' ? '#16181c' : '#f7f6f2' },
    { t: String(cnt), bg: '#c4c8cc', fg: '#16181c' }];
  const fieldsAck = (from, cnt) => [
    { t: 'CSOS', bg: '#3a3f46', fg: '#f7f6f2' }, { t: from, bg: '#f7f6f2', fg: '#16181c' },
    { t: 'ACK', bg: '#16181c', fg: '#f7f6f2' }, { t: String(cnt), bg: '#c4c8cc', fg: '#16181c' }];

  const roll = () => { if (sim.forceLose > 0) { sim.forceLose--; emit('force'); return true; } return Math.random() < sim.loss; };

  function attempt(from) {
    const pd = sim.pend[from]; if (!pd) return;
    pd.n++;
    const to = other(from);
    oleds[from].play(`env_${pd.tipo}_${pd.n}`, { loop: false });
    emit('attempt', { from, tipo: pd.tipo, n: pd.n, cnt: pd.cnt });
    if (pd.n > 1) { sim.stats.retries++; emit('stats'); }
    fly(from, to, fieldsMsg(from, pd.tipo, pd.cnt), {
      lost: roll(),
      onArrive: () => {
        const dup = sim.lastRx[to] === from + pd.cnt;
        emit('rx', { to, tipo: pd.tipo, dup });
        if (!dup) {
          sim.lastRx[to] = from + pd.cnt; sim.stats.received++; emit('stats');
          oleds[to].play('alert_' + pd.tipo, { then: () => oleds[to].play('inicio', { loop: true }) });
          playMorse(to, pd.tipo);
        }
        const cnt = pd.cnt;
        later(0.12, () => fly(to, from, fieldsAck(to, cnt), {
          lost: roll(),
          onArrive: () => {
            const cur = sim.pend[from];
            if (!cur || cur.cnt !== cnt) return;
            cur.timer && cur.timer.kill(); sim.pend[from] = null;
            sim.stats.delivered++; emit('stats'); emit('delivered', { from, n: cur.n });
            oleds[from].play('entregado', { then: () => oleds[from].play('inicio', { loop: true }) });
            beep(from, 2, 0.08, 0.08);
          },
        }));
      },
    });
    pd.timer = later(0.8 + 2.5, () => {
      const cur = sim.pend[from]; if (!cur || cur !== pd) return;
      if (pd.n < 3) attempt(from);
      else {
        sim.pend[from] = null; sim.stats.failed++; emit('stats'); emit('failed', { from });
        oleds[from].play('fallo', { then: () => oleds[from].play('inicio', { loop: true }) });
        beep(from, 1, 0.6, 0);
      }
    });
  }

  sim.send = (from, tipo) => {
    if (!sim.enabled) return;
    const cap = nodes[from].userData.btns.find(b => b.userData.tipo === tipo); if (cap) pressButton(cap);
    if (sim.pend[from] && tipo !== 'SOS') { emit('busy', { from }); return; }
    if (sim.pend[from]) sim.pend[from].timer && sim.pend[from].timer.kill();
    sim.pend[from] = { tipo, cnt: sim.counter++, n: 0, timer: null };
    sim.stats.sent++; emit('stats');
    beep(from, 1, 0.06, 0);
    attempt(from);
  };
  sim.demoMorse = (id, tipo) => playMorse(id, tipo);
  sim.reset = () => {
    sim.calls.forEach(c => c.kill()); sim.calls = [];
    sim.packets.forEach(it => { gsap.killTweensOf(it.p.position); scene.remove(it.p); }); sim.packets = [];
    sim.pend = { A: null, B: null };
    ['A', 'B'].forEach(id => { setLed(nodes[id], false); oleds[id].play('inicio', { loop: true }); });
    audio.set(false);
  };
  sim.zero = () => { sim.stats = { sent: 0, delivered: 0, retries: 0, failed: 0, received: 0 }; emit('stats'); };
  sim.update = () => { for (const it of sim.packets) if (!it.free) it.p.quaternion.copy(camera.quaternion); };
  sim.on = f => sim.listeners.push(f);
  return sim;
}
