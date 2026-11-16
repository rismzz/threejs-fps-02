// Procedural sound effects built on WebAudio — no audio assets needed.
// Every effect is a small stack of oscillators / filtered noise bursts.
// All methods are safe to call before init() (they simply do nothing).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  tone({ freq = 440, freqEnd = null, type = 'square', dur = 0.15, vol = 0.25, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 0.8, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() {
    this.noise({ dur: 0.13, vol: 0.5, freq: 1700 });
    this.tone({ freq: 150, freqEnd: 55, type: 'sawtooth', dur: 0.1, vol: 0.22 });
  }

  enemyShoot() {
    this.noise({ dur: 0.1, vol: 0.16, freq: 900 });
    this.tone({ freq: 220, freqEnd: 90, type: 'sawtooth', dur: 0.09, vol: 0.08 });
  }

  hit() {
    this.tone({ freq: 880, freqEnd: 660, type: 'square', dur: 0.05, vol: 0.12 });
  }

  headshot() {
    this.tone({ freq: 1320, freqEnd: 990, type: 'square', dur: 0.07, vol: 0.14 });
  }

  enemyDie() {
    this.tone({ freq: 300, freqEnd: 60, type: 'triangle', dur: 0.28, vol: 0.25 });
    this.noise({ dur: 0.2, vol: 0.15, freq: 500 });
  }

  playerHurt() {
    this.tone({ freq: 110, freqEnd: 70, type: 'sawtooth', dur: 0.16, vol: 0.3 });
  }

  reloadStart() {
    this.tone({ freq: 500, type: 'square', dur: 0.05, vol: 0.12 });
    this.tone({ freq: 350, type: 'square', dur: 0.05, vol: 0.12, delay: 0.12 });
  }

  reloadEnd() {
    this.tone({ freq: 700, type: 'square', dur: 0.06, vol: 0.14 });
  }

  emptyClick() {
    this.tone({ freq: 1200, type: 'square', dur: 0.04, vol: 0.1 });
  }

  pickup() {
    this.tone({ freq: 620, freqEnd: 930, type: 'sine', dur: 0.14, vol: 0.22 });
  }

  waveStart() {
    this.tone({ freq: 392, type: 'square', dur: 0.12, vol: 0.16 });
    this.tone({ freq: 523, type: 'square', dur: 0.12, vol: 0.16, delay: 0.12 });
    this.tone({ freq: 659, type: 'square', dur: 0.2, vol: 0.16, delay: 0.24 });
  }

  waveClear() {
    this.tone({ freq: 523, type: 'sine', dur: 0.12, vol: 0.2 });
    this.tone({ freq: 784, type: 'sine', dur: 0.22, vol: 0.2, delay: 0.1 });
  }

  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.2, delay: i * 0.14 }));
  }

  lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.2, delay: i * 0.16 }));
  }
}
