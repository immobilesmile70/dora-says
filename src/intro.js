import SubtitleSystem from "./subtitles.js";

const InstructionSystem = {
  audio: new Audio(`${window.location.origin}/tts_intro.mp3`),
  isPlaying: false,

  subtitles: [
    { time: 0.0, text: "Welcome to Dora Says." },
    { time: 1.8, text: "WASD to move, mouse to look, and F to interact." },
    {
      time: 6.5,
      text: "On mobile, use the left side to move, the right side to look, and the interact button to activate objects.",
    },
    {
      time: 13.5,
      text: "Watch the screens carefully and memorize the pattern they display. Then, repeat that pattern by pressing the buttons around you in the correct order.",
    },
    { time: 22.5, text: "Ready? Let's see how much you can remember." },
    { time: 27.0, text: "" },
  ],

  async play() {
    this.isPlaying = true;
    this.audio.currentTime = 0;

    try {
      await this.audio.play();
    } catch (e) {
      console.warn("TTS Playback prevented", e);
      return;
    }

    return new Promise((resolve) => {
      const checkSubtitles = () => {
        if (!this.isPlaying) return resolve();

        const time = this.audio.currentTime;
        let currentSub = "";

        for (let i = 0; i < this.subtitles.length; i++) {
          if (time >= this.subtitles[i].time) {
            currentSub = this.subtitles[i].text;
          }
        }

        if (currentSub) SubtitleSystem.show(currentSub);
        else SubtitleSystem.hide();

        if (this.audio.ended) {
          SubtitleSystem.hide();
          this.isPlaying = false;
          resolve();
        } else {
          requestAnimationFrame(checkSubtitles);
        }
      };
      checkSubtitles();
    });
  },

  pause() {
    this.audio.pause();
  },
  resume() {
    if (this.isPlaying) this.audio.play();
  },
  cancel() {
    this.isPlaying = false;
    this.audio.pause();
    SubtitleSystem.hide();
  },
};

export default InstructionSystem;