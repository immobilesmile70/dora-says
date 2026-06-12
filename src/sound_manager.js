const SoundManager = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,

  bgmElement: null,
  bgmSource: null,
  currentTrack: null,

  sfxBuffers: {},
  isInitialized: false,
  isPaused: false,

  async init() {
    if (this.isInitialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.bgmGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    const sfxFiles = [
      "red",
      "green",
      "blue",
      "orange",
      "pink",
      "purple",
      "yellow",
    ];
    for (let color of sfxFiles) {
      try {
        const res = await fetch(
          `${window.location.origin}/color_sounds/${color}.mp3`,
        );
        const arrayBuffer = await res.arrayBuffer();
        this.sfxBuffers[color] = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(
          `Could not load SFX: ${window.location.origin}/color_sounds/${color}.mp3`,
          e,
        );
      }
    }

    this.bgmElement = new Audio();
    this.bgmElement.loop = true;
    this.bgmSource = this.ctx.createMediaElementSource(this.bgmElement);
    this.bgmSource.connect(this.bgmGain);

    this.isInitialized = true;
  },

  playSFX(colorName) {
    if (!this.isInitialized || !this.sfxBuffers[colorName]) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.sfxBuffers[colorName];
    source.connect(this.sfxGain);
    source.start(0);
  },

  playBGM(trackName) {
    if (!this.isInitialized) this.init();
    if (this.currentTrack === trackName) return;

    this.currentTrack = trackName;
    this.isPaused = false;

    this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1);

    setTimeout(() => {
      this.bgmElement.src = `${window.location.origin}/music/${trackName}.mp3`;
      this.bgmElement
        .play()
        .catch((e) => console.warn("BGM Play prevented:", e));

      this.bgmGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.bgmGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 2);
    }, 1000);
  },

  pauseAll() {
    if (!this.isInitialized || this.isPaused) return;
    this.isPaused = true;

    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(
      0.01,
      this.ctx.currentTime + 0.5,
    );
    setTimeout(() => this.bgmElement.pause(), 500);
  },

  resumeAll() {
    if (!this.isInitialized || !this.isPaused) return;
    this.isPaused = false;

    this.bgmElement.play();
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.5);
  },
};

document.body.addEventListener(
  "pointerdown",
  () => {
    if (!SoundManager.isInitialized) {
      SoundManager.init().then(() => {
        SoundManager.playBGM("title_screen");
      });
    }
  },
  { once: true },
);

export default SoundManager;