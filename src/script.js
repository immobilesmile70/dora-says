document.addEventListener("DOMContentLoaded", async () => {

  // ==========================================
  // MODULAR SYSTEM 1: SUBTITLES
  // ==========================================
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

  // ==========================================
  // MODULAR SYSTEM 2: SOUND MANAGER (Pre-baked MP3s)
  // ==========================================
  const SoundManager = {
    ctx: null,
    masterGain: null,
    bgmGain: null,
    sfxGain: null,

    bgmElement: null,
    bgmSource: null,
    currentTrack: null,

    sfxBuffers: {}, // Pre-loading buffers allows instant, overlapping rapid clicks
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

      // 1. Preload SFX into memory for zero-latency playback
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
          const res = await fetch(`public/color_sounds/${color}.mp3`);
          const arrayBuffer = await res.arrayBuffer();
          this.sfxBuffers[color] = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.warn(
            `Could not load SFX: public/color_sounds/${color}.mp3`,
            e,
          );
        }
      }

      // 2. Setup BGM Element for streaming
      this.bgmElement = new Audio();
      this.bgmElement.loop = true;
      this.bgmSource = this.ctx.createMediaElementSource(this.bgmElement);
      this.bgmSource.connect(this.bgmGain);

      this.isInitialized = true;
    },

    playSFX(colorName) {
      if (!this.isInitialized || !this.sfxBuffers[colorName]) return;

      // Creates a new voice for every click, preventing cut-offs on rapid clicking
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

      // Fade out current track
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1);

      // Swap source and fade in
      setTimeout(() => {
        this.bgmElement.src = `public/music/${trackName}.mp3`;
        this.bgmElement
          .play()
          .catch((e) => console.warn("BGM Play prevented:", e));

        this.bgmGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
        this.bgmGain.gain.linearRampToValueAtTime(
          0.5,
          this.ctx.currentTime + 2,
        ); // Target volume 0.5
      }, 1000);
    },

    pauseAll() {
      if (!this.isInitialized || this.isPaused) return;
      this.isPaused = true;

      // Fade out master volume, then physically pause the BGM element
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
      this.masterGain.gain.linearRampToValueAtTime(
        1,
        this.ctx.currentTime + 0.5,
      );
    },
  };

  // Initialize Audio on first user interaction anywhere to bypass browser autoplay blocks
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

  // ==========================================
  // MODULAR SYSTEM 3: INSTRUCTIONS (Pre-baked TTS)
  // ==========================================
  const InstructionSystem = {
    audio: new Audio("public/tts_intro.mp3"),
    isPlaying: false,

    // TWEAK THESE TIMES (in seconds) to match your specific tts_intro.mp3
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
      { time: 27.0, text: "" }, // Clears the text at the end
    ],

    async play() {
      this.isPlaying = true;
      this.audio.currentTime = 0;

      try {
        await this.audio.play();
      } catch (e) {
        console.warn("TTS Playback prevented", e);
        return; // Fallback: just skip to game if audio fails
      }

      return new Promise((resolve) => {
        const checkSubtitles = () => {
          if (!this.isPlaying) return resolve();

          const time = this.audio.currentTime;
          let currentSub = "";

          // Find the applicable subtitle based on current audio time
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

  // ==========================================
  // GAME LOGIC VARIABLES
  // ==========================================
  let buttons = [];
  let buttonGroups = [];
  let screens = [];
  let intersectedObjects = [];

  // Core Game Data (Updated with your 7 specific colors)
  const colorNames = [
    "red",
    "green",
    "blue",
    "orange",
    "pink",
    "purple",
    "yellow",
  ];
  const colorsPool = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffa500, 0xffc0cb, 0x800080, 0xffff00,
  ];

  let activeColors = 2; // Starts with 2, scales up to 7
  let sequence = [];
  let playerStep = 0;
  let score = 0;
  let round = 1;
  let isWaitingInput = false;
  let gameState = "MENU"; // MENU, INSTRUCTIONS, PLAYING, GAME_OVER

  let maxTime = 10.0;
  let timeLeft = maxTime;

  // Movement & Engine Data
  let isPaused = false;
  let lastFrameTime = performance.now();
  const fpsInterval = 1000 / 60;

  let activeCameraTouchId = null;
  let lastCameraTouchX = 0,
    lastCameraTouchY = 0;
  let cameraRotationX = 0,
    cameraRotationY = 0;
  let cameraDistance = 0.1,
    lookAtOffsetY = 1.2;

  let activeJoystickTouchId = null;
  let moveDirection = { x: 0, z: 0 };
  let joystickActive = false;
  let cameraControlsActive = false;
  let keys = { w: false, a: false, s: false, d: false };
  let isPointerLocked = false;

  // DOM Elements
  const scoreEl = document.getElementById("score");
  const finalScoreEl = document.getElementById("final-score");
  const timeoutBar = document.getElementById("timeout-bar");
  const hud = document.getElementById("hud");
  const controlsUi = document.getElementById("controls-ui");

  const mMenu = document.getElementById("menu-panel");
  const pMenu = document.getElementById("pause-panel");
  const gameOverMenu = document.getElementById("game-over-menu");

  const playBtn = document.getElementById("playBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  const retryBtn = document.getElementById("retryBtn");
  const interactBtn = document.getElementById("mobile-interact");

  // ==========================================
  // THREE.JS SCENE SETUP
  // ==========================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.Fog(0x050505, 10, 50);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("game-container").appendChild(renderer.domElement);

  const movementRaycaster = new THREE.Raycaster();
  const interactionRaycaster = new THREE.Raycaster();

  const floorRadius = 12;
  const floorGeometry = new THREE.CylinderGeometry(
    floorRadius,
    floorRadius,
    1,
    64,
  );
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0xbe3939,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(0, 1, 0);
  cylinder.castShadow = false;
  scene.add(cylinder);
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 15, 10).normalize();
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  buildDoraEnvironment();

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  playBtn.addEventListener("click", () => {
    mMenu.classList.add("hid");
    startSimulation();
  });

  retryBtn.addEventListener("click", () => {
    gameOverMenu.classList.add("hid");
    startSimulation();
  });

  pauseBtn.addEventListener("click", () => {
    pMenu.classList.remove("hid");
    isPaused = true;
    SoundManager.pauseAll();
    InstructionSystem.pause();
    if (isPointerLocked) document.exitPointerLock();
  });

  resumeBtn.addEventListener("click", () => {
    pMenu.classList.add("hid");
    isPaused = false;
    SoundManager.resumeAll();
    InstructionSystem.resume();
    if (window.innerWidth >= 768) document.body.requestPointerLock();
  });

  restartBtn.addEventListener("click", () => {
    pMenu.classList.add("hid");
    startSimulation();
  });

  interactBtn.addEventListener("click", handleInteract);

  // Relock cursor on click if it was unlocked via Escape
  document
    .getElementById("game-container")
    .addEventListener("mousedown", () => {
      if (
        (gameState === "PLAYING" || gameState === "INSTRUCTIONS") &&
        !isPaused &&
        !isPointerLocked &&
        window.innerWidth >= 768
      ) {
        document.body.requestPointerLock();
      }
    });

  // Desktop
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyW") keys.w = true;
    if (e.code === "KeyA") keys.a = true;
    if (e.code === "KeyS") keys.s = true;
    if (e.code === "KeyD") keys.d = true;
    if (e.code === "KeyF") handleInteract();
    if (
      e.code === "Escape" &&
      (gameState === "PLAYING" || gameState === "INSTRUCTIONS")
    ) {
      pMenu.classList.remove("hid");
      isPaused = true;
      SoundManager.pauseAll();
      InstructionSystem.pause();
      if (isPointerLocked) document.exitPointerLock();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "KeyW") keys.w = false;
    if (e.code === "KeyA") keys.a = false;
    if (e.code === "KeyS") keys.s = false;
    if (e.code === "KeyD") keys.d = false;
  });

  document.addEventListener("pointerlockchange", () => {
    isPointerLocked = document.pointerLockElement === document.body;
  });

  document.addEventListener("mousemove", (event) => {
    if (!isPointerLocked || isPaused) return;
    const sensitivity = 0.002;
    cameraRotationX -= event.movementX * sensitivity;

    // FLIPPED: + instead of - to invert Y Axis
    cameraRotationY = clamp(
      cameraRotationY + event.movementY * sensitivity,
      -Math.PI / 2.5,
      Math.PI / 2.5,
    );
  });

  setupMobileControls();

  // ==========================================
  // DORA SAYS FUNCTIONS
  // ==========================================
  function buildDoraEnvironment() {
    const screenDist = 18;
    const screenGeo = new THREE.BoxGeometry(18, 10, 1);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const positions = [
      { x: 0, z: -screenDist, rotY: 0 },
      { x: 0, z: screenDist, rotY: Math.PI },
      { x: -screenDist, z: 0, rotY: Math.PI / 2 },
      { x: screenDist, z: 0, rotY: -Math.PI / 2 },
    ];

    positions.forEach((pos) => {
      const screen = new THREE.Mesh(screenGeo, screenMat.clone());
      screen.position.set(pos.x, 6, pos.z);
      screen.rotation.y = pos.rotY;
      scene.add(screen);
      screens.push(screen);
      intersectedObjects.push(screen);
    });
  }

  function createButtons() {
    buttonGroups.forEach((g) => scene.remove(g));
    buttonGroups = [];
    buttons = [];
    intersectedObjects = intersectedObjects.filter(
      (obj) => !obj.userData.isButtonPart,
    );

    const angleStep = (Math.PI * 2) / activeColors;
    const buttonGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 32);
    const outlineGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.1, 32);
    const outlineMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
    });

    for (let i = 0; i < activeColors; i++) {
      const group = new THREE.Group();
      const color = colorsPool[i];
      const buttonMat = new THREE.MeshBasicMaterial({ color: color });

      const buttonMesh = new THREE.Mesh(buttonGeo, buttonMat);
      buttonMesh.userData = {
        colorIndex: i,
        baseColor: color,
        isButtonPart: true,
      };

      const outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
      outlineMesh.position.y = -0.125;
      outlineMesh.userData = { isButtonPart: true };

      group.add(outlineMesh);
      group.add(buttonMesh);

      const angle = i * angleStep;
      const x = Math.cos(angle) * (floorRadius - 1.5);
      const z = Math.sin(angle) * (floorRadius - 1.5);

      group.position.set(x, 1.0, z);
      group.lookAt(0, 1.0, 0);
      group.rotateX(Math.PI / 2);

      scene.add(group);
      buttonGroups.push(group);
      buttons.push(buttonMesh);
      intersectedObjects.push(buttonMesh, outlineMesh);
    }
  }

  async function startSimulation() {
    if (window.innerWidth >= 768) document.body.requestPointerLock();
    if (window.innerWidth < 768) controlsUi.classList.remove("hidden");
    hud.classList.remove("hidden");

    // Init sounds if skipped the menu click
    await SoundManager.init();
    SoundManager.resumeAll();
    SoundManager.playBGM("gameplay"); // Updated to gameplay.mp3

    cylinder.position.set(0, 1, 0);
    cameraRotationX = 0;
    cameraRotationY = 0;
    moveDirection.x = 0;
    moveDirection.z = 0;

    InstructionSystem.cancel();

    isPaused = false;
    score = 0;
    round = 1;
    activeColors = 2; // Resets to first 2 colors
    sequence = [];
    scoreEl.innerText = score;

    createButtons();

    // Play Intro phase
    gameState = "INSTRUCTIONS";
    await InstructionSystem.play();

    if (!isPaused && gameState === "INSTRUCTIONS") {
      gameState = "PLAYING";
      nextRound();
    }
  }

  async function nextRound() {
    if (gameState !== "PLAYING") return;

    isWaitingInput = false;
    playerStep = 0;
    maxTime = Math.max(3.0, 10.0 - round * 0.2);
    timeLeft = maxTime;
    updateTimeoutBar();

    if (round % 2 === 0 && activeColors < colorsPool.length) {
      // Scales up slightly faster to hit all 7
      activeColors++;
      createButtons();
    }

    sequence.push(Math.floor(Math.random() * activeColors));

    await sleep(1000);
    await playSequence();

    isWaitingInput = true;
  }

  async function playSequence() {
    for (let i = 0; i < sequence.length; i++) {
      if (gameState !== "PLAYING") return;

      while (isPaused) {
        await sleep(100);
      } // Wait gracefully if paused

      const colorIndex = sequence[i];
      const colorHex = colorsPool[colorIndex];
      const colorString = colorNames[colorIndex].toUpperCase(); // E.g., "RED"

      SoundManager.playSFX(colorNames[colorIndex]);
      SubtitleSystem.show(colorString, 500);

      screens.forEach((s) => s.material.color.setHex(colorHex));
      await sleep(500);

      screens.forEach((s) => s.material.color.setHex(0x111111));
      await sleep(300);
    }
  }

  function handleInteract() {
    if (!isWaitingInput || gameState !== "PLAYING" || isPaused) return;

    interactionRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = interactionRaycaster.intersectObjects(buttons);

    if (intersects.length > 0) {
      const hitButton = intersects[0].object;
      const chosenColorIndex = hitButton.userData.colorIndex;

      // Audio & Visual Feedback
      SoundManager.playSFX(colorNames[chosenColorIndex]);
      SubtitleSystem.show(colorNames[chosenColorIndex].toUpperCase(), 500);

      hitButton.material.color.setHex(0xffffff);
      setTimeout(() => {
        if (hitButton && hitButton.material) {
          hitButton.material.color.setHex(hitButton.userData.baseColor);
        }
      }, 200);

      if (chosenColorIndex === sequence[playerStep]) {
        playerStep++;
        timeLeft = maxTime; // Reset timer on correct press

        if (playerStep === sequence.length) {
          score++;
          scoreEl.innerText = score;
          round++;
          nextRound();
        }
      } else {
        triggerGameOver();
      }
    }
  }

  function triggerGameOver() {
    gameState = "GAME_OVER";
    isWaitingInput = false;

    // Fade out music and reset elements
    SoundManager.masterGain.gain.linearRampToValueAtTime(
      0.01,
      SoundManager.ctx.currentTime + 1,
    );
    setTimeout(() => SoundManager.bgmElement.pause(), 1000);

    if (isPointerLocked) document.exitPointerLock();

    hud.classList.add("hidden");
    controlsUi.classList.add("hidden");
    SubtitleSystem.hide();
    gameOverMenu.classList.remove("hid");
    finalScoreEl.innerText = score;
  }

  function updateTimeoutBar() {
    const percentage = Math.max(0, timeLeft / maxTime);
    timeoutBar.style.transform = `scaleX(${percentage})`;
    if (percentage > 0.5) timeoutBar.style.backgroundColor = "#0f0";
    else if (percentage > 0.2) timeoutBar.style.backgroundColor = "#ff0";
    else timeoutBar.style.backgroundColor = "#f00";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================
  // MOBILE CONTROLS & CAMERA LOGIC
  // ==========================================
  function setupMobileControls() {
    const rightPanel = document.getElementById("right-panel");

    rightPanel.addEventListener("touchstart", (event) => {
      for (let touch of event.changedTouches) {
        if (activeCameraTouchId === null) {
          activeCameraTouchId = touch.identifier;
          lastCameraTouchX = touch.clientX;
          lastCameraTouchY = touch.clientY;
          cameraControlsActive = true;
        }
      }
    });

    rightPanel.addEventListener("touchmove", (event) => {
      if (!cameraControlsActive || isPaused) return;
      for (let touch of event.touches) {
        if (touch.identifier === activeCameraTouchId) {
          const currentX = touch.clientX;
          const currentY = touch.clientY;
          const deltaX = currentX - lastCameraTouchX;
          const deltaY = currentY - lastCameraTouchY;
          const sensitivity = 2;

          cameraRotationX -= deltaX * 0.005 * sensitivity;
          // FLIPPED: + instead of -
          cameraRotationY = clamp(
            cameraRotationY + deltaY * 0.01 * sensitivity,
            -Math.PI / 2.5,
            Math.PI / 2.5,
          );

          lastCameraTouchX = currentX;
          lastCameraTouchY = currentY;
        }
      }
    });

    rightPanel.addEventListener("touchend", (event) => {
      for (let touch of event.changedTouches) {
        if (touch.identifier === activeCameraTouchId) {
          activeCameraTouchId = null;
          cameraControlsActive = false;
        }
      }
    });

    const joystick = nipplejs.create({
      zone: document.getElementById("left-panel"),
      mode: "dynamic",
      position: { left: "100px", bottom: "100px" },
      color: "white",
      size: 150,
    });

    joystick.on("start", (evt, data) => {
      if (activeJoystickTouchId === null) {
        activeJoystickTouchId = evt.identifier;
        joystickActive = true;
      }
    });

    joystick.on("move", (evt, data) => {
      if (data.angle && !isPaused) {
        const adjustedAngle = data.angle.radian - Math.PI / 2;
        const distance = data.distance / 400;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3()
          .crossVectors(forward, new THREE.Vector3(0, 1, 0))
          .normalize();

        moveDirection.x =
          forward.x * Math.cos(adjustedAngle) * distance -
          right.x * Math.sin(adjustedAngle) * distance;
        moveDirection.z =
          forward.z * Math.cos(adjustedAngle) * distance -
          right.z * Math.sin(adjustedAngle) * distance;
      }
    });

    joystick.on("end", (evt, data) => {
      if (evt.identifier === activeJoystickTouchId) {
        activeJoystickTouchId = null;
        joystickActive = false;
        moveDirection.x = 0;
        moveDirection.z = 0;
      }
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ==========================================
  // MAIN LOOP
  // ==========================================
  function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const elapsed = currentTime - lastFrameTime;
    if (elapsed < fpsInterval) return;

    lastFrameTime = currentTime - (elapsed % fpsInterval);
    const delta = elapsed / 1000;

    if (isPaused || (gameState !== "PLAYING" && gameState !== "INSTRUCTIONS")) {
      renderer.render(scene, camera);
      return;
    }

    // Desktop WASD movement
    if (!joystickActive) {
      let fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      let rgt = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);

      if (fwd !== 0 || rgt !== 0) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3()
          .crossVectors(forward, new THREE.Vector3(0, 1, 0))
          .normalize();

        const speed = 0.12;
        moveDirection.x = forward.x * fwd * speed + right.x * rgt * speed;
        moveDirection.z = forward.z * fwd * speed + right.z * rgt * speed;
      } else {
        moveDirection.x = 0;
        moveDirection.z = 0;
      }
    }

    camera.position.x =
      cylinder.position.x +
      Math.sin(cameraRotationX) * Math.cos(cameraRotationY) * cameraDistance;
    camera.position.z =
      cylinder.position.z +
      Math.cos(cameraRotationX) * Math.cos(cameraRotationY) * cameraDistance;
    camera.position.y =
      cylinder.position.y +
      Math.sin(cameraRotationY) * cameraDistance +
      lookAtOffsetY;
    camera.lookAt(
      cylinder.position.x,
      cylinder.position.y + lookAtOffsetY,
      cylinder.position.z,
    );

    if (moveDirection.x !== 0 || moveDirection.z !== 0) {
      const movementVector = new THREE.Vector3(
        moveDirection.x,
        0,
        moveDirection.z,
      ).normalize();
      movementRaycaster.set(cylinder.position, movementVector);
      const movementIntersects =
        movementRaycaster.intersectObjects(intersectedObjects);

      const nextX = cylinder.position.x + moveDirection.x;
      const nextZ = cylinder.position.z + moveDirection.z;
      const distFromCenter = Math.sqrt(nextX * nextX + nextZ * nextZ);

      if (
        movementIntersects.length > 0 &&
        movementIntersects[0].distance < 0.8
      ) {
        // Blocked
      } else if (distFromCenter > floorRadius - 1) {
        // Blocked by edge
      } else {
        cylinder.position.x += moveDirection.x;
        cylinder.position.z += moveDirection.z;
      }
    }

    if (isWaitingInput) {
      timeLeft -= delta;
      updateTimeoutBar();
      if (timeLeft <= 0) {
        triggerGameOver();
      }
    }

    renderer.render(scene, camera);
  }

  animate();
});
