const SubtitleSystem = {
  container: document.getElementById("subtitle-container"),
  textEl: document.getElementById("subtitle-text"),
  timeoutId: null,

  show(text, duration = 0) {
    this.container.classList.remove("hidden");
    this.textEl.innerText = text;
    if (this.timeoutId) clearTimeout(this.timeoutId);

    if (duration > 0) {
      this.timeoutId = setTimeout(() => this.hide(), duration);
    }
  },
  hide() {
    this.container.classList.add("hidden");
    this.textEl.innerText = "";
  },
};

export default SubtitleSystem;
