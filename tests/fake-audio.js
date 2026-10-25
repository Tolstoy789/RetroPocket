// tests/fake-audio.js
// Web Audio de mentira para probar SoundChip en Node. No suena nada, pero se queja igual que el navegador
// cuando algo estaría mal: valores no finitos, rampas exponenciales a 0 o por debajo, osciladores que
// arrancan dos veces o métodos que no existen.

function finite(value, what) {
  if (!Number.isFinite(value)) throw new TypeError(`${what}: valor no finito (${value})`);
}

class FakeParam {
  constructor(value) {
    this._value = value;
  }
  get value() {
    return this._value;
  }
  set value(v) {
    finite(v, 'AudioParam.value');
    this._value = v;
  }
  setValueAtTime(v, t) {
    finite(v, 'setValueAtTime');
    finite(t, 'setValueAtTime (tiempo)');
    this._value = v;
    return this;
  }
  linearRampToValueAtTime(v, t) {
    finite(v, 'linearRampToValueAtTime');
    finite(t, 'linearRampToValueAtTime (tiempo)');
    this._value = v;
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    finite(v, 'exponentialRampToValueAtTime');
    finite(t, 'exponentialRampToValueAtTime (tiempo)');
    if (v <= 0) throw new RangeError(`exponentialRampToValueAtTime necesita un valor positivo (${v})`);
    this._value = v;
    return this;
  }
  setTargetAtTime(v, t, constant) {
    finite(v, 'setTargetAtTime');
    finite(t, 'setTargetAtTime (tiempo)');
    finite(constant, 'setTargetAtTime (constante)');
    this._value = v;
    return this;
  }
  cancelScheduledValues(t) {
    finite(t, 'cancelScheduledValues');
    return this;
  }
}

class FakeNode {
  constructor(ctx, params = {}) {
    this.context = ctx;
    for (const [name, value] of Object.entries(params)) this[name] = new FakeParam(value);
  }
  connect(target) {
    if (!target) throw new TypeError('connect() sin destino');
    return target;
  }
  disconnect() {}
}

class FakeSource extends FakeNode {
  constructor(ctx, params) {
    super(ctx, params);
    this.started = false;
    this.onended = null;
  }
  start(t = 0) {
    finite(t, 'start');
    if (this.started) throw new Error('InvalidStateError: start() llamado dos veces');
    this.started = true;
    this.context.voices++;
  }
  stop(t = 0) {
    finite(t, 'stop');
    if (!this.started) throw new Error('InvalidStateError: stop() antes de start()');
  }
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new FakeNode(this);
    this.voices = 0;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode(this, { gain: 1 });
  }
  createOscillator() {
    const osc = new FakeSource(this, { frequency: 440, detune: 0 });
    osc.type = 'sine';
    osc.setPeriodicWave = (wave) => {
      if (!wave) throw new TypeError('setPeriodicWave sin onda');
    };
    return osc;
  }
  createBufferSource() {
    const src = new FakeSource(this, { playbackRate: 1, detune: 0 });
    src.buffer = null;
    src.loop = false;
    return src;
  }
  createBiquadFilter() {
    const filter = new FakeNode(this, { frequency: 350, Q: 1, gain: 0, detune: 0 });
    filter.type = 'lowpass';
    return filter;
  }
  createDelay(max = 1) {
    finite(max, 'createDelay');
    return new FakeNode(this, { delayTime: 0 });
  }
  createDynamicsCompressor() {
    return new FakeNode(this, { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 });
  }
  createStereoPanner() {
    return new FakeNode(this, { pan: 0 });
  }
  createAnalyser() {
    const analyser = new FakeNode(this);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -30;
    Object.defineProperty(analyser, 'frequencyBinCount', { get: () => analyser.fftSize / 2 });
    analyser.getByteFrequencyData = (array) => array.fill(96);
    analyser.getFloatFrequencyData = (array) => array.fill(-60);
    analyser.getByteTimeDomainData = (array) => array.fill(128);
    return analyser;
  }
  createBuffer(channels, length, rate) {
    finite(length, 'createBuffer');
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, sampleRate: rate, numberOfChannels: channels, duration: length / rate, getChannelData: (i) => data[i] };
  }
  createPeriodicWave(real, imag) {
    if (real.length !== imag.length) throw new Error('createPeriodicWave: real e imag de distinto tamaño');
    return { real, imag };
  }
}

/** Pone un `window` mínimo con el AudioContext de mentira (SoundChip escucha el primer gesto en window). */
export function installFakeAudio() {
  globalThis.window = {
    AudioContext: FakeAudioContext,
    addEventListener() {},
    removeEventListener() {}
  };
}
