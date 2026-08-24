import type { SoundType } from "./kits";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let masterVolume = 0.72;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);
    const length = ctx.sampleRate * 1.5;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function out(node: AudioNode) {
  if (master) node.connect(master);
  else if (ctx) node.connect(ctx.destination);
}

function envGain(start: number, peak: number, attack: number, decay: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

export function setMasterVolume(v: number) {
  masterVolume = v;
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.04);
}

export function initAudio() {
  ensure();
}

function playKick(velocity: number) {
  const c = ensure();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(148, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
  osc.frequency.exponentialRampToValueAtTime(22, now + 0.42);
  const g = envGain(now, velocity, 0.004, 0.42);
  osc.connect(g);
  out(g);
  osc.start(now);
  osc.stop(now + 0.46);
}

function playSnare(velocity: number) {
  const c = ensure();
  if (!c || !noiseBuffer) return;
  const now = c.currentTime;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1100;
  const ng = envGain(now, velocity * 0.7, 0.002, 0.16);
  noise.connect(hp);
  hp.connect(ng);
  out(ng);
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(186, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
  const og = envGain(now, velocity * 0.45, 0.002, 0.1);
  osc.connect(og);
  out(og);
  noise.start(now);
  noise.stop(now + 0.2);
  osc.start(now);
  osc.stop(now + 0.14);
}

function playHiHat(open: boolean, velocity: number) {
  const c = ensure();
  if (!c || !noiseBuffer) return;
  const now = c.currentTime;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7200;
  const decay = open ? 0.32 : 0.045;
  const g = envGain(now, velocity * 0.28, 0.001, decay);
  noise.connect(hp);
  hp.connect(g);
  out(g);
  noise.start(now);
  noise.stop(now + decay + 0.04);
}

function playTom(freq: number, velocity: number) {
  const c = ensure();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.52, now + 0.28);
  const g = envGain(now, velocity * 0.85, 0.003, 0.28);
  osc.connect(g);
  out(g);
  osc.start(now);
  osc.stop(now + 0.32);
}

function playClap(velocity: number) {
  const c = ensure();
  if (!c || !noiseBuffer) return;
  const now = c.currentTime;
  for (const delay of [0, 0.012, 0.026]) {
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;
    const g = envGain(now + delay, velocity * 0.55, 0.001, 0.12);
    noise.connect(bp);
    bp.connect(g);
    out(g);
    noise.start(now + delay);
    noise.stop(now + delay + 0.16);
  }
}

function playPerc(velocity: number) {
  const c = ensure();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
  const g = envGain(now, velocity * 0.22, 0.001, 0.09);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 400;
  osc.connect(hp);
  hp.connect(g);
  out(g);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playPad(type: SoundType, label: string, velocity = 0.9) {
  switch (type) {
    case "kick":
      playKick(velocity);
      break;
    case "snare":
      playSnare(velocity);
      break;
    case "hihat":
      playHiHat(label.includes("O") || label.includes("OPEN"), velocity);
      break;
    case "tom":
      playTom(label.includes("H") ? 196 : label.includes("M") ? 148 : 110, velocity);
      break;
    case "clap":
      playClap(velocity);
      break;
    case "perc":
      playPerc(velocity);
      break;
    default:
      playKick(velocity);
  }
}
