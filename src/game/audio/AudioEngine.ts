type CueName = "deploy" | "scan" | "hack" | "alarm" | "shot" | "impact" | "success" | "fail" | "ui";

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class AudioEngine {
  private context: AudioContext | null = null;

  private master: GainNode | null = null;

  private ambience: GainNode | null = null;

  private combat: GainNode | null = null;

  private alarm: GainNode | null = null;

  private initialized = false;

  async unlock() {
    if (this.initialized) {
      await this.context?.resume();
      return;
    }

    const audioWindow = window as WindowWithWebkitAudio;
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }

    this.context = new AudioContextConstructor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.context.destination);

    this.ambience = this.context.createGain();
    this.ambience.gain.value = 0.14;
    this.ambience.connect(this.master);

    this.combat = this.context.createGain();
    this.combat.gain.value = 0;
    this.combat.connect(this.master);

    this.alarm = this.context.createGain();
    this.alarm.gain.value = 0;
    this.alarm.connect(this.master);

    this.createAmbientBed();
    this.initialized = true;
    await this.context.resume();
  }

  setAlert(active: boolean, exposure = 0) {
    if (!this.context || !this.combat || !this.alarm) {
      return;
    }

    const now = this.context.currentTime;
    this.combat.gain.cancelScheduledValues(now);
    this.combat.gain.linearRampToValueAtTime(active ? 0.2 + exposure * 0.12 : exposure * 0.04, now + 0.3);
    this.alarm.gain.cancelScheduledValues(now);
    this.alarm.gain.linearRampToValueAtTime(active ? 0.08 : 0, now + 0.2);
  }

  playCue(cue: CueName) {
    if (!this.context || !this.master) {
      return;
    }

    const now = this.context.currentTime;
    switch (cue) {
      case "deploy":
        this.blit("triangle", 280, 0.18, now, 0.18);
        this.blit("triangle", 410, 0.14, now + 0.06, 0.24);
        break;
      case "scan":
        this.blit("sine", 680, 0.16, now, 0.1);
        this.blit("sine", 920, 0.12, now + 0.08, 0.12);
        break;
      case "hack":
        this.blit("square", 320, 0.18, now, 0.15);
        this.blit("triangle", 540, 0.14, now + 0.09, 0.22);
        break;
      case "alarm":
        this.blit("sawtooth", 220, 0.12, now, 0.08);
        this.blit("sawtooth", 160, 0.12, now + 0.12, 0.08);
        break;
      case "shot":
        this.noiseBurst(0.09, 0.09);
        this.blit("square", 520, 0.12, now, 0.07);
        break;
      case "impact":
        this.noiseBurst(0.11, 0.11);
        this.blit("triangle", 120, 0.12, now, 0.12);
        break;
      case "success":
        this.blit("triangle", 360, 0.12, now, 0.16);
        this.blit("triangle", 540, 0.12, now + 0.14, 0.22);
        break;
      case "fail":
        this.blit("sawtooth", 120, 0.16, now, 0.2);
        this.blit("sawtooth", 90, 0.1, now + 0.18, 0.28);
        break;
      case "ui":
        this.blit("sine", 440, 0.05, now, 0.06);
        break;
    }
  }

  private createAmbientBed() {
    if (!this.context || !this.ambience || !this.combat || !this.alarm) {
      return;
    }

    const droneA = this.context.createOscillator();
    droneA.type = "triangle";
    droneA.frequency.value = 58;
    const droneAGain = this.context.createGain();
    droneAGain.gain.value = 0.08;
    droneA.connect(droneAGain).connect(this.ambience);
    droneA.start();

    const droneB = this.context.createOscillator();
    droneB.type = "sine";
    droneB.frequency.value = 87;
    const droneBGain = this.context.createGain();
    droneBGain.gain.value = 0.04;
    droneB.connect(droneBGain).connect(this.ambience);
    droneB.start();

    const lfo = this.context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(droneAGain.gain);
    lfo.start();

    const pulse = this.context.createOscillator();
    pulse.type = "square";
    pulse.frequency.value = 92;
    const pulseGain = this.context.createGain();
    pulseGain.gain.value = 0.04;
    pulse.connect(pulseGain).connect(this.combat);
    pulse.start();

    const pulseLfo = this.context.createOscillator();
    pulseLfo.type = "triangle";
    pulseLfo.frequency.value = 2.1;
    const pulseLfoGain = this.context.createGain();
    pulseLfoGain.gain.value = 0.025;
    pulseLfo.connect(pulseLfoGain).connect(pulseGain.gain);
    pulseLfo.start();

    const alarmTone = this.context.createOscillator();
    alarmTone.type = "sawtooth";
    alarmTone.frequency.value = 215;
    const alarmGain = this.context.createGain();
    alarmGain.gain.value = 0.03;
    alarmTone.connect(alarmGain).connect(this.alarm);
    alarmTone.start();

    const alarmPulse = this.context.createOscillator();
    alarmPulse.type = "square";
    alarmPulse.frequency.value = 1.25;
    const alarmPulseGain = this.context.createGain();
    alarmPulseGain.gain.value = 0.03;
    alarmPulse.connect(alarmPulseGain).connect(alarmGain.gain);
    alarmPulse.start();
  }

  private blit(type: OscillatorType, frequency: number, volume: number, start: number, duration: number) {
    if (!this.context || !this.master) {
      return;
    }

    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.45), start + duration);

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noiseBurst(volume: number, duration: number) {
    if (!this.context || !this.master) {
      return;
    }

    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 720;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}
