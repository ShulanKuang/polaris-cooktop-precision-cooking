(() => {
  // SOUND EFFECTS ENGINE
  const SOUND_FILES = {
    touch: "./sounds/Touch.wav",
    tick: "./sounds/Touch.wav", // Alias to selected sound (Touch.wav)
    increase: "./sounds/Increase.wav",
    decrease: "./sounds/Decrease.wav",
    toggleOn: "./sounds/ToggleOn.wav",
    toggleOff: "./sounds/ToggleOff.wav",
    cancel: "./sounds/Cancel.wav",
    timerEnd: "./sounds/TimerChime.wav",
  };

  const audioCache = {};
  for (const [key, path] of Object.entries(SOUND_FILES)) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audioCache[key] = audio;
  }

  // Web Audio API buffer cache for zero-latency, overlapping scheduled playback
  let audioCtx = null;
  const audioBuffers = {};

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  // Unlock AudioContext on first user interaction
  const unlockAudio = () => {
    initAudioContext();
    window.removeEventListener("pointerdown", unlockAudio, true);
    window.removeEventListener("touchstart", unlockAudio, true);
    window.removeEventListener("click", unlockAudio, true);
  };
  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("touchstart", unlockAudio, true);
  window.addEventListener("click", unlockAudio, true);

  // Preload and decode Web Audio buffers
  Object.entries(SOUND_FILES).forEach(([key, path]) => {
    fetch(path)
      .then(res => res.arrayBuffer())
      .then(buf => {
        initAudioContext();
        if (audioCtx) {
          audioCtx.decodeAudioData(buf.slice(0), (decoded) => {
            audioBuffers[key] = decoded;
          }, () => {});
        }
      })
      .catch(() => {});
  });

  // Scheduled tick playback for rotary knob encoder feedback
  let lastScheduledTickTime = 0;
  let lastTickDirection = 0; // +1 for up, -1 for down
  const TICK_INTERVAL = 0.038; // 38ms spacing between ticks (~26 clicks/sec)
  const MAX_QUEUE_TICKS = 12; // allow up to 12 ticks queued ahead (~450ms)

  function resetTickQueue() {
    lastScheduledTickTime = 0;
    lastTickDirection = 0;
  }

  function playTickSound(direction = 0) {
    initAudioContext();
    const useCtx = audioCtx && audioBuffers["touch"] && audioCtx.state !== "closed";
    const now = (useCtx && audioCtx.state === "running") ? audioCtx.currentTime : (performance.now() / 1000);

    // If direction changed (e.g. turned up then suddenly turned down), reset queue for immediate feedback
    if (direction !== 0 && lastTickDirection !== 0 && direction !== lastTickDirection) {
      lastScheduledTickTime = 0;
    }
    if (direction !== 0) {
      lastTickDirection = direction;
    }

    // If last scheduled tick was in the past or clock domain shifted, reset to now
    if (now - lastScheduledTickTime > TICK_INTERVAL || Math.abs(lastScheduledTickTime - now) > 2.0) {
      lastScheduledTickTime = now - TICK_INTERVAL;
    }

    // If queue is full (>12 ticks ahead), drop extra ticks to prevent lagging
    if (lastScheduledTickTime - now > MAX_QUEUE_TICKS * TICK_INTERVAL) {
      return;
    }

    const playAt = Math.max(now, lastScheduledTickTime + TICK_INTERVAL);
    lastScheduledTickTime = playAt;

    window.__tickHistory = window.__tickHistory || [];
    window.__tickHistory.push({ playAt, now, perf: performance.now(), direction });

    if (useCtx) {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffers["touch"];
        source.connect(audioCtx.destination);
        const ctxStart = (audioCtx.state === "running") ? playAt : 0;
        source.start(ctxStart);
        return;
      } catch (e) {}
    }

    // Fallback: HTML5 audio with setTimeout
    const delayMs = Math.max(0, Math.round((playAt - now) * 1000));
    setTimeout(() => {
      try {
        const sound = audioCache["touch"];
        if (sound) {
          const clone = sound.cloneNode();
          clone.play().catch(() => {});
        }
      } catch (e) {}
    }, delayMs);
  }

  function playSound(type) {
    if (type === "tick") {
      playTickSound();
      return;
    }
    initAudioContext();
    if (audioCtx && audioBuffers[type]) {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffers[type];
        source.connect(audioCtx.destination);
        source.start(0);
        return;
      } catch (e) {}
    }
    try {
      const sound = audioCache[type];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }
    } catch (e) {}
  }

  function playTimerNotificationSound() {
    window.__timerChimeCount = (window.__timerChimeCount || 0) + 1;
    window.__lastTimerChimePlayedAt = Date.now();
    initAudioContext();
    if (audioCtx && audioBuffers["timerEnd"]) {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffers["timerEnd"];
        source.connect(audioCtx.destination);
        source.start(0);
        return;
      } catch (e) {}
    }
    try {
      const sound = audioCache["timerEnd"];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
        return;
      }
    } catch (e) {}

    // Web Audio API synthesized dual-harmonic chime fallback
    try {
      if (!audioCtx) return;
      const now = (audioCtx.state === "running") ? audioCtx.currentTime : 0;
      const notes = [
        { t: 0.00, f: 880.00, dur: 0.25, gain: 0.25 },
        { t: 0.18, f: 1174.66, dur: 0.40, gain: 0.30 },
        { t: 0.60, f: 880.00, dur: 0.25, gain: 0.25 },
        { t: 0.78, f: 1174.66, dur: 0.60, gain: 0.32 },
      ];
      notes.forEach(({ t, f, dur, gain }) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + t);
        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.linearRampToValueAtTime(gain, now + t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(now + t);
        osc.stop(now + t + dur);
      });
    } catch (e) {}
  }
  window.playTimerNotificationSound = playTimerNotificationSound;

  // STATE MANAGEMENT
  const state = {
    currentTask: 3,
    shutterHidden: true,
    shutterTimer: null,
    targetTemp: 350,
    selectedBurner: "rear-left",
    burners: {
      "rear-left": { state: "off", temp: 350, mode: null, label: "OFF" },
      "front-left": { state: "off", temp: null, mode: null, label: "OFF" },
      "center": { state: "off", temp: null, mode: null, label: "OFF" },
      "top-right": { state: "off", temp: null, mode: null, label: "OFF" },
      "front-right": { state: "off", temp: null, mode: null, label: "OFF" }
    },
    task2: {
      screen: "explore", // "explore" or "precision"
      tab: "temperature", // Figma 3198:27479 entry is temperature
      tempMode: "picker",// "picker" or "digipad"
      temperature: 375,
      digipadBuffer: "375",
      hasEditedKeypad: false
    },
    task3TargetTemp: 350,
    task3BeefType: "Steak",
    task3BeefDoneness: "Med Rare",
    task3BeefThickness: 0.5,
    selectedCookware: "Cast Iron"
  };

  // DOM ELEMENTS
  const els = {
    btnTask1: document.getElementById("btnTask1"),
    btnTask2: document.getElementById("btnTask2"),
    btnTask3: document.getElementById("btnTask3"),

    taskTitle: document.getElementById("taskTitle"),
    taskPrompt: document.getElementById("taskPrompt"),
    glanceControls: document.getElementById("glanceControls"),
    btnShutterToggle: document.getElementById("btnShutterToggle"),
    glanceStatusPill: document.getElementById("glanceStatusPill"),
    pillStatusText: document.getElementById("pillStatusText"),

    // Screen Inspector & Jumper
    screenInspectorControls: document.getElementById("screenInspectorControls"),
    screenBadgeContainer: document.getElementById("screenBadgeContainer"),
    screenBadgePill: document.getElementById("screenBadgePill"),
    screenCopyHint: document.getElementById("screenCopyHint"),
    screenJumperSelect: document.getElementById("screenJumperSelect"),

    // Toolbar & Physical Scale

    btnScalePhysical: document.getElementById("btnScalePhysical"),
    btnScaleNative: document.getElementById("btnScaleNative"),
    deviceSpec: document.querySelector(".device-spec"),

    task1FullScreen: document.getElementById("task1FullScreen"),
    task1StandbyCover: document.getElementById("task1StandbyCover"),
    screenRail: document.getElementById("screenRail") || document.querySelector(".screen-rail"),
    screenRailBg: document.getElementById("screenRailBg") || document.querySelector(".screen-rail-bg"),
    topStatus: document.getElementById("topStatus") || document.querySelector(".top-status"),
    screenCanvas: document.getElementById("screenCanvas"),
    screenBottomStrip: document.getElementById("screenBottomStrip"),
    cooktopHotIndicator: document.getElementById("cooktopHotIndicator"),

    // Task 2 DOM elements
    viewTask2: document.getElementById("viewTask2"),
    t2ScreenExplore: document.getElementById("t2ScreenExplore"),
    t2ScreenPrecision: document.getElementById("t2ScreenPrecision"),
    t2BtnExplore: document.getElementById("t2BtnExplore"),
    t2BtnBack: document.getElementById("t2BtnBack"),

    t2TabSpotlight: document.getElementById("t2TabSpotlight"),
    t2TabTechnique: document.getElementById("t2TabTechnique"),
    t2TabFood: document.getElementById("t2TabFood"),
    t2TabTemperature: document.getElementById("t2TabTemperature"),

    t2PanelSpotlight: document.getElementById("t2PanelSpotlight"),
    t2PanelTechnique: document.getElementById("t2PanelTechnique"),
    t2PanelFood: document.getElementById("t2PanelFood"),
    t2PanelTemperature: document.getElementById("t2PanelTemperature"),

    t2TechniqueScroll: document.getElementById("t2TechniqueScroll"),
    t2FoodScroll: document.getElementById("t2FoodScroll"),

    t2TempModePicker: document.getElementById("t2TempModePicker"),
    t2TempModeDigipad: document.getElementById("t2TempModeDigipad"),
    t2PickerWheelContainer: document.getElementById("t2PickerWheelContainer"),
    t2PickerTrack: document.getElementById("t2PickerTrack"),
    t2PickerStartBtn: document.getElementById("t2PickerStartBtn"),
    t2DigipadStartBtn: document.getElementById("t2DigipadStartBtn"),
    t2BtnToDigipad: document.getElementById("t2BtnToDigipad"),
    t2BtnToPicker: document.getElementById("t2BtnToPicker"),
    t2DigipadValue: document.getElementById("t2DigipadValue"),

    viewTask3: document.getElementById("viewTask3"),
    cooktopWrapper: document.getElementById("cooktopWrapper"),
    cooktopManifoldPanel: document.getElementById("cooktopManifoldPanel"),
    precisionDrawer: document.getElementById("precisionDrawer"),
    drawerCloseBtn: document.getElementById("drawerCloseBtn"),
    drawerBurnerLabel: document.getElementById("drawerBurnerLabel"),

    // Tabs
    tabTemp: document.getElementById("tabTemp"),
    tabFood: document.getElementById("tabFood"),
    tabTechnique: document.getElementById("tabTechnique"),
    panelTemp: document.getElementById("panelTemp"),
    panelFood: document.getElementById("panelFood"),
    panelTechnique: document.getElementById("panelTechnique"),

    // Temp stepper
    tempNum: document.getElementById("tempNum"),
    tempMinusBtn: document.getElementById("tempMinusBtn"),
    tempPlusBtn: document.getElementById("tempPlusBtn"),
    btnConfirmTemp: document.getElementById("btnConfirmTemp"),
    btnTurnOffPrecision: document.getElementById("btnTurnOffPrecision"),

    // Food & Tech confirms
    btnConfirmFood: document.getElementById("btnConfirmFood"),
    btnConfirmTech: document.getElementById("btnConfirmTech"),

    // Task 3A & 3B DOM elements
    t3ScreenStart: document.getElementById("t3ScreenStart"),
    t3BurnerRoller1: document.getElementById("t3BurnerRoller1"),
    t3BurnerStrip1: document.getElementById("t3BurnerStrip1"),
    t3BurnerRoller2: document.getElementById("t3BurnerRoller2"),
    t3BurnerStrip2: document.getElementById("t3BurnerStrip2"),
    t3BurnerRoller3: document.getElementById("t3BurnerRoller3"),
    t3BurnerStrip3: document.getElementById("t3BurnerStrip3"),
    t3BurnerRoller4: document.getElementById("t3BurnerRoller4"),
    t3BurnerStrip4: document.getElementById("t3BurnerStrip4"),
    t3BurnerRoller5: document.getElementById("t3BurnerRoller5"),
    t3BurnerStrip5: document.getElementById("t3BurnerStrip5"),
    t3ScreenTurnKnob: document.getElementById("t3ScreenTurnKnob"),
    t3ScreenSpotlight: document.getElementById("t3ScreenSpotlight"),
    t3BtnExplore: document.getElementById("t3BtnExplore"),
    t3HotspotRearLeft: document.getElementById("t3HotspotRearLeft"),
    t3HotspotMainBurner: document.getElementById("t3HotspotMainBurner"),
    t3KnobHint: document.getElementById("t3KnobHint"),
    t3ToastCard: document.getElementById("t3ToastCard"),
    t3ToastNum: document.getElementById("t3ToastNum"),
    t3ToastDismiss: document.getElementById("t3ToastDismiss"),
    t3ToastClose: document.getElementById("t3ToastClose"),
    t3BtnBack: document.getElementById("t3BtnBack"),
    t3SpotlightSteak: document.getElementById("t3SpotlightSteak"),
    t3SpotlightBacon: document.getElementById("t3SpotlightBacon"),
    t3SpotlightBeef: document.getElementById("t3SpotlightBeef"),

    // Task 3B: Temperature Picker & Preheat
    t3TabBtnTemperature: document.getElementById("t3TabBtnTemperature"),
    t3ScreenTemperature: document.getElementById("t3ScreenTemperature"),
    t3BtnBackFromTemp: document.getElementById("t3BtnBackFromTemp"),
    t3TabBtnSpotlightFromTemp: document.getElementById("t3TabBtnSpotlightFromTemp"),
    t3TabBtnFoodFromTemp: document.getElementById("t3TabBtnFoodFromTemp"),
    t3PickerWheelContainer: document.getElementById("t3PickerWheelContainer"),
    t3PickerTrack: document.getElementById("t3PickerTrack"),
    t3BtnStartTemp: document.getElementById("t3BtnStartTemp"),
    t3BtnCookwareEdit: document.getElementById("t3BtnCookwareEdit"),
    t3BtnKeypadFromTemp: document.getElementById("t3BtnKeypadFromTemp"),
    t3TempMainContent: document.getElementById("t3TempMainContent"),

    // Task 3B: Select Cookware Screen (Figma 3407:25065 & 3409:25225)
    t3ScreenSelectCookware: document.getElementById("t3ScreenSelectCookware"),
    t3CookwareMainContent: document.getElementById("t3CookwareMainContent"),
    t3BtnBackFromCookware: document.getElementById("t3BtnBackFromCookware"),
    t3SideDrawerCookware: document.getElementById("t3SideDrawerCookware"),
    t3CookwareCarouselViewport: document.getElementById("t3CookwareCarouselViewport"),
    t3CookwareScrollTrack: document.getElementById("t3CookwareScrollTrack"),
    t3CardStainless: document.getElementById("t3CardStainless"),
    t3CardCastIron: document.getElementById("t3CardCastIron"),
    t3CardOther: document.getElementById("t3CardOther"),
    t3CookwarePagination: document.getElementById("t3CookwarePagination"),
    t3BtnSelectCookware: document.getElementById("t3BtnSelectCookware"),
    t3BtnCookwareInfo: document.getElementById("t3BtnCookwareInfo"),

    // Task 3B: Digital Keypad Screen (Figma 3017:25641)
    t3ScreenDigipad: document.getElementById("t3ScreenDigipad"),
    t3BtnBackFromDigipad: document.getElementById("t3BtnBackFromDigipad"),
    t3DigipadTempDisplay: document.getElementById("t3DigipadTempDisplay"),
    t3DigipadTempNum: document.getElementById("t3DigipadTempNum"),
    t3BtnStartDigipad: document.getElementById("t3BtnStartDigipad"),
    t3BtnPickerFromDigipad: document.getElementById("t3BtnPickerFromDigipad"),
    t3DigipadKeyGrid: document.getElementById("t3DigipadKeyGrid"),
    t3TabBtnTempFromDigi: document.getElementById("t3TabBtnTempFromDigi"),
    t3TabBtnFoodFromDigi: document.getElementById("t3TabBtnFoodFromDigi"),
    t3TabBtnTechFromDigi: document.getElementById("t3TabBtnTechFromDigi"),
    t3TabBtnFavFromDigi: document.getElementById("t3TabBtnFavFromDigi"),
    t3TabBtnRecentFromDigi: document.getElementById("t3TabBtnRecentFromDigi"),

    t3ScreenPreheat: document.getElementById("t3ScreenPreheat"),
    t3BtnBackFromPreheat: document.getElementById("t3BtnBackFromPreheat"),
    t3PreheatCurrent: document.getElementById("t3PreheatCurrent"),
    t3PreheatTarget: document.getElementById("t3PreheatTarget"),
    t3BtnEditPreheat: document.getElementById("t3BtnEditPreheat"),

    t3ScreenPreheatComplete: document.getElementById("t3ScreenPreheatComplete"),
    t3BtnBackFromComplete: document.getElementById("t3BtnBackFromComplete"),
    t3CompleteTarget: document.getElementById("t3CompleteTarget"),
    t3ToastPreheatComplete: document.getElementById("t3ToastPreheatComplete"),
    t3ToastCompleteOk: document.getElementById("t3ToastCompleteOk"),
    t3ToastCompleteClose: document.getElementById("t3ToastCompleteClose"),
    t3BtnEditPreheatFromComplete: document.getElementById("t3BtnEditPreheatFromComplete"),

    t3ScreenBurnerStatus: document.getElementById("t3ScreenBurnerStatus"),
    t3BtnBackFromBurnerStatus: document.getElementById("t3BtnBackFromBurnerStatus"),
    t3BurnerStatusTemp: document.getElementById("t3BurnerStatusTemp"),
    t3HotspotActiveBurner: document.getElementById("t3HotspotActiveBurner"),
    t3ActiveBurnerOverlay: document.getElementById("t3ActiveBurnerOverlay"),
    t3BurnerTextTile: document.getElementById("t3BurnerTextTile"),
    t3TileLiveTemp: document.getElementById("t3TileLiveTemp"),
    t3TileTargetText: document.getElementById("t3TileTargetText"),
    t3ToastComplete: document.getElementById("t3ToastComplete"),
    t3ToastBtnOk: document.getElementById("t3ToastBtnOk"),
    t3ToastBtnClose: document.getElementById("t3ToastBtnClose"),
    t3StatusBurnerRoller1: document.getElementById("t3StatusBurnerRoller1"),
    t3StatusBurnerStrip1: document.getElementById("t3StatusBurnerStrip1"),
    t3StatusBurnerRoller3: document.getElementById("t3StatusBurnerRoller3"),
    t3StatusBurnerStrip3: document.getElementById("t3StatusBurnerStrip3"),
    t3StatusBurnerRoller4: document.getElementById("t3StatusBurnerRoller4"),
    t3StatusBurnerStrip4: document.getElementById("t3StatusBurnerStrip4"),
    t3StatusBurnerRoller5: document.getElementById("t3StatusBurnerRoller5"),
    t3StatusBurnerStrip5: document.getElementById("t3StatusBurnerStrip5"),

    t3ScreenTempRun: document.getElementById("t3ScreenTempRun"),
    t3SideDrawerTempRun: document.getElementById("t3SideDrawerTempRun"),
    t3BtnBackFromTempRun: document.getElementById("t3BtnBackFromTempRun"),
    t3RunPickerWheelContainer: document.getElementById("t3RunPickerWheelContainer"),
    t3RunPickerTrack: document.getElementById("t3RunPickerTrack"),
    t3BtnUpdateTemp: document.getElementById("t3BtnUpdateTemp"),
    t3BtnKeypadTemp: document.getElementById("t3BtnKeypadTemp"),

    // Task 3C: Food Mode & Active Cards
    tStartActiveBurner1: document.getElementById("tStartActiveBurner1"),
    tStartBurner1Temp: document.getElementById("tStartBurner1Temp"),
    t3TabBtnFood: document.getElementById("t3TabBtnFood"),

    t3ScreenFoodOptions: document.getElementById("t3ScreenFoodOptions"),
    t3BtnBackFromFoodOptions: document.getElementById("t3BtnBackFromFoodOptions"),
    t3TabFoodToSpotlight: document.getElementById("t3TabFoodToSpotlight"),
    t3TabFoodToTemp: document.getElementById("t3TabFoodToTemp"),
    t3BtnFoodBeef: document.getElementById("t3BtnFoodBeef"),

    t3ScreenBeefMenu: document.getElementById("t3ScreenBeefMenu"),
    t3BeefBgImg: document.getElementById("t3BeefBgImg"),
    t3BeefDrawerTiles: document.getElementById("t3BeefDrawerTiles"),
    t3BtnBackFromBeefMenu: document.getElementById("t3BtnBackFromBeefMenu"),
    t3BtnStartBeef: document.getElementById("t3BtnStartBeef"),
    t3BtnBeefMenuDonenessToggle: document.getElementById("t3BtnBeefMenuDonenessToggle"),
    t3BtnBeefMenuThicknessMinus: document.getElementById("t3BtnBeefMenuThicknessMinus"),
    t3BtnBeefMenuThicknessPlus: document.getElementById("t3BtnBeefMenuThicknessPlus"),
    t3BeefMenuThicknessOverlay: document.getElementById("t3BeefMenuThicknessOverlay"),
    t3BeefMenuThicknessVal: document.getElementById("t3BeefMenuThicknessVal"),
    t3BeefTypeHotspots: document.getElementById("t3BeefTypeHotspots"),
    t3BeefDonenessHotspots: document.getElementById("t3BeefDonenessHotspots"),
    t3BeefValBurner: document.getElementById("t3BeefValBurner"),
    t3BeefValType: document.getElementById("t3BeefValType"),
    t3BeefValDoneness: document.getElementById("t3BeefValDoneness"),
    t3BeefValThickness: document.getElementById("t3BeefValThickness"),
    t3BeefTypeCarouselWrap: document.getElementById("t3BeefTypeCarouselWrap"),
    t3BeefTypeCarousel: document.getElementById("t3BeefTypeCarousel"),
    t3BeefTypeDots: document.getElementById("t3BeefTypeDots"),
    t3BeefDonenessCarouselWrap: document.getElementById("t3BeefDonenessCarouselWrap"),
    t3BeefDonenessCarousel: document.getElementById("t3BeefDonenessCarousel"),
    t3BeefDonenessDots: document.getElementById("t3BeefDonenessDots"),

    t3ScreenBeefType: document.getElementById("t3ScreenBeefType"),
    t3BtnBackFromBeefType: document.getElementById("t3BtnBackFromBeefType"),
    t3RecipeNavType: document.getElementById("t3RecipeNavType"),
    t3RecipeNavDoneness: document.getElementById("t3RecipeNavDoneness"),
    t3RecipeNavThickness: document.getElementById("t3RecipeNavThickness"),
    t3BtnTypeSteak: document.getElementById("t3BtnTypeSteak"),
    t3BtnBeefTypeStart: document.getElementById("t3BtnBeefTypeStart"),

    t3ScreenBeefDoneness: document.getElementById("t3ScreenBeefDoneness"),
    t3BeefDonenessBg: document.getElementById("t3BeefDonenessBg"),
    t3BtnBackFromBeefDoneness: document.getElementById("t3BtnBackFromBeefDoneness"),
    t3RecipeNavType2: document.getElementById("t3RecipeNavType2"),
    t3RecipeNavDoneness2: document.getElementById("t3RecipeNavDoneness2"),
    t3RecipeNavThickness2: document.getElementById("t3RecipeNavThickness2"),
    t3BtnDonenessToggle: document.getElementById("t3BtnDonenessToggle"),
    t3BtnDonenessMedRare: document.getElementById("t3BtnDonenessMedRare"),
    t3BtnBeefDonenessStart: document.getElementById("t3BtnBeefDonenessStart"),

    t3ScreenBeefThickness: document.getElementById("t3ScreenBeefThickness"),
    t3BtnBackFromBeefThickness: document.getElementById("t3BtnBackFromBeefThickness"),
    t3RecipeNavType3: document.getElementById("t3RecipeNavType3"),
    t3RecipeNavDoneness3: document.getElementById("t3RecipeNavDoneness3"),
    t3RecipeNavThickness3: document.getElementById("t3RecipeNavThickness3"),
    t3BtnThicknessMinus: document.getElementById("t3BtnThicknessMinus"),
    t3BtnThicknessPlus: document.getElementById("t3BtnThicknessPlus"),
    t3BtnBeefThicknessStart: document.getElementById("t3BtnBeefThicknessStart"),

    t3ScreenFoodPreheat: document.getElementById("t3ScreenFoodPreheat"),
    t3BtnBackFromFoodPreheat: document.getElementById("t3BtnBackFromFoodPreheat"),
    t3FoodPreheatCurrent: document.getElementById("t3FoodPreheatCurrent"),
    t3BtnEditFoodPreheat: document.getElementById("t3BtnEditFoodPreheat"),

    t3ScreenFoodComplete: document.getElementById("t3ScreenFoodComplete"),
    t3BtnBackFromFoodComplete: document.getElementById("t3BtnBackFromFoodComplete"),
    t3BtnEditFoodComplete: document.getElementById("t3BtnEditFoodComplete"),

    t3ScreenFoodBurnerStatus: document.getElementById("t3ScreenFoodBurnerStatus"),
    t3BtnBackFromFoodBurnerStatus: document.getElementById("t3BtnBackFromFoodBurnerStatus"),
    t3FoodBurnerStatusTemp1: document.getElementById("t3FoodBurnerStatusTemp1"),
    t3FoodBurnerStatusTempDisplay: document.getElementById("t3FoodBurnerStatusTempDisplay"),
    t3FoodBurnerStatusFLText: document.getElementById("t3FoodBurnerStatusFLText"),
    t3FoodBurnerStatusFLType: document.getElementById("t3FoodBurnerStatusFLType"),
    t3FoodBurnerStatusFLDoneness: document.getElementById("t3FoodBurnerStatusFLDoneness"),
    t3FoodBurnerOffRL: document.getElementById("t3FoodBurnerOffRL"),
    t3FoodBurnerOffFL: document.getElementById("t3FoodBurnerOffFL"),
    t3HotspotFrontLeftBurner: document.getElementById("t3HotspotFrontLeftBurner"),
    t3HotspotRearLeftBurner: document.getElementById("t3HotspotRearLeftBurner"),

    // Task 3 Technique and Food option screens
    t3ScreenTechnique: document.getElementById("t3ScreenTechnique"),
    t3BtnBackFromTechnique: document.getElementById("t3BtnBackFromTechnique"),
    t3TechniqueScroll: document.getElementById("t3TechniqueScroll"),
    t3FoodScroll: document.getElementById("t3FoodScroll"),
    t3ScreenTechniquePreheat: document.getElementById("t3ScreenTechniquePreheat"),
    t3BtnBackFromTechPreheat: document.getElementById("t3BtnBackFromTechPreheat"),
    t3TechPreheatCurrent: document.getElementById("t3TechPreheatCurrent"),
    t3BtnEditTechPreheat: document.getElementById("t3BtnEditTechPreheat"),
    t3ScreenTechniqueComplete: document.getElementById("t3ScreenTechniqueComplete"),
    t3BtnBackFromTechComplete: document.getElementById("t3BtnBackFromTechComplete"),
    t3BtnEditTechComplete: document.getElementById("t3BtnEditTechComplete"),

    // Task 3 Recent Used screen
    t3ScreenRecentUsed: document.getElementById("t3ScreenRecentUsed"),
    t3BtnBackFromRecentUsed: document.getElementById("t3BtnBackFromRecentUsed"),
    t3RecentContainer: document.getElementById("t3RecentContainer"),
    t3BtnCookware: document.getElementById("t3BtnCookware"),

    // Task 3C: Pancakes Mode (Figma 3198:22586, 3317:32565, 3299:23383, 3299:23427, 3299:22874)
    t3ScreenPancakes: document.getElementById("t3ScreenPancakes"),
    t3BtnBackFromPancakes: document.getElementById("t3BtnBackFromPancakes"),
    t3PancakesRightPane: document.getElementById("t3PancakesRightPane"),
    t3TileDoneness: document.getElementById("t3TileDoneness"),
    t3TileBurner: document.getElementById("t3TileBurner"),
    t3TileTips: document.getElementById("t3TileTips"),
    t3TileCookware: document.getElementById("t3TileCookware"),
    t3PancakesValDoneness: document.getElementById("t3PancakesValDoneness"),
    t3PancakesValBurner: document.getElementById("t3PancakesValBurner"),
    t3PancakesValCookware: document.getElementById("t3PancakesValCookware"),
    t3PancakesViewDoneness: document.getElementById("t3PancakesViewDoneness"),
    t3PancakesViewBurner: document.getElementById("t3PancakesViewBurner"),
    t3PancakesViewTips: document.getElementById("t3PancakesViewTips"),
    t3PancakesViewCookware: document.getElementById("t3PancakesViewCookware"),
    t3TipsTabInstructions: document.getElementById("t3TipsTabInstructions"),
    t3TipsTabIngredients: document.getElementById("t3TipsTabIngredients"),
    t3TipsPanelInstructions: document.getElementById("t3TipsPanelInstructions"),
    t3TipsPanelIngredients: document.getElementById("t3TipsPanelIngredients"),
    t3BtnStartPancakesDoneness: document.getElementById("t3BtnStartPancakesDoneness"),
    t3BtnStartPancakesBurner: document.getElementById("t3BtnStartPancakesBurner"),
    t3BtnStartPancakesCookware: document.getElementById("t3BtnStartPancakesCookware"),
    t3PancakesDonenessCarousel: document.getElementById("t3PancakesDonenessCarousel"),
    t3PancakesCookwareCarousel: document.getElementById("t3PancakesCookwareCarousel"),
    t3PancakesDonenessDots: document.getElementById("t3PancakesDonenessDots"),
    t3PancakesCookwareDots: document.getElementById("t3PancakesCookwareDots"),
    t3ScreenPancakesPreheat: document.getElementById("t3ScreenPancakesPreheat"),
    t3BtnBackFromPancakesPreheat: document.getElementById("t3BtnBackFromPancakesPreheat"),
    t3PancakesBurnerOffRL: document.getElementById("t3PancakesBurnerOffRL"),
    t3PancakesRLTexts: document.getElementById("t3PancakesRLTexts"),
    t3PancakesRLTemp: document.getElementById("t3PancakesRLTemp"),
    t3PancakesBurnerTile: document.getElementById("t3PancakesBurnerTile"),
    t3PancakesPreheatTemp: document.getElementById("t3PancakesPreheatTemp"),
    t3PancakesPreheatSub: document.getElementById("t3PancakesPreheatSub"),
    t3PancakesChefBtn: document.getElementById("t3PancakesChefBtn"),
    t3BtnEditPancakesPreheat: document.getElementById("t3BtnEditPancakesPreheat"),

    // Guided Cooking Elements (Figma 3321:34955 & Section 3436:25475)
    t3ScreenGuidedCooking: document.getElementById("t3ScreenGuidedCooking"),
    t3GuidedBackBtn: document.getElementById("t3GuidedBackBtn"),
    t3GuidedExitBtn: document.getElementById("t3GuidedExitBtn"),
    t3GuidedViewport: document.getElementById("t3GuidedViewport"),
    t3GuidedTrack: document.getElementById("t3GuidedTrack"),
    t3GuidedCards: Array.from(document.querySelectorAll(".t3-guided-card")),
    t3GuidedCardPreheat: document.getElementById("t3GuidedCardPreheat"),
    t3GuidedPreheatInfo: document.getElementById("t3GuidedPreheatInfo"),
    t3GuidedPreheatFill: document.getElementById("t3GuidedPreheatFill"),
    t3GuidedCard1: document.getElementById("t3GuidedCard1"),
    t3GuidedCard2: document.getElementById("t3GuidedCard2"),
    t3GuidedStartTimer2: document.getElementById("t3GuidedStartTimer2"),
    t3GuidedTimer2: document.getElementById("t3GuidedTimer2"),
    t3GuidedTimerVal2: document.getElementById("t3GuidedTimerVal2"),
    t3GuidedTimerFill2: document.getElementById("t3GuidedTimerFill2"),
    t3GuidedCard2Text: document.getElementById("t3GuidedCard2Text"),
    t3GuidedCard3: document.getElementById("t3GuidedCard3"),
    t3GuidedStartTimer3: document.getElementById("t3GuidedStartTimer3"),
    t3GuidedTimer3: document.getElementById("t3GuidedTimer3"),
    t3GuidedTimerVal3: document.getElementById("t3GuidedTimerVal3"),
    t3GuidedTimerFill3: document.getElementById("t3GuidedTimerFill3"),
    t3GuidedCard3Text: document.getElementById("t3GuidedCard3Text"),
    t3GuidedCard4: document.getElementById("t3GuidedCard4"),
    t3GuidedBtnPreheating: document.getElementById("t3GuidedBtnPreheating"),
    t3GuidedBtnNext: document.getElementById("t3GuidedBtnNext"),
    t3GuidedBtnCooking: document.getElementById("t3GuidedBtnCooking"),
    t3GuidedStep4Btns: document.getElementById("t3GuidedStep4Btns"),
    t3GuidedBtnDone4: document.getElementById("t3GuidedBtnDone4"),
    t3GuidedBtnStartNext4: document.getElementById("t3GuidedBtnStartNext4"),
    t3GuidedDoneModal: document.getElementById("t3GuidedDoneModal"),
    t3GuidedDoneModalBtn: document.getElementById("t3GuidedDoneModalBtn"),
    t3GuidedNextModal: document.getElementById("t3GuidedNextModal"),
    t3GuidedNextModalCancel: document.getElementById("t3GuidedNextModalCancel"),
    t3GuidedNextModalConfirm: document.getElementById("t3GuidedNextModalConfirm"),
    t3GuidedHotIndicator: document.getElementById("t3GuidedHotIndicator"),

    t3SubflowControls: document.getElementById("t3SubflowControls"),
    btnT3FlowTemp: document.getElementById("btnT3FlowTemp"),
    btnT3FlowStatus: document.getElementById("btnT3FlowStatus"),
    btnT3FlowFood: document.getElementById("btnT3FlowFood"),
    btnT3FlowTech: document.getElementById("btnT3FlowTech"),
    btnT3FlowRecent: document.getElementById("btnT3FlowRecent"),
    t3BtnBackFromStart: document.getElementById("t3BtnBackFromStart"),

    clockReadout: document.getElementById("clockReadout"),
    navHomeBtn: document.getElementById("navHomeBtn")
  };

  // CLOCK SYNC
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    if (els.clockReadout) {
      els.clockReadout.textContent = `${hours}:${minutes} ${ampm}`;
    }
  }
  updateClock();
  setInterval(updateClock, 30000);

  // TASK DESCRIPTIONS CHEAT SHEET
  const TASK_INFO = {
    1: {
      title: "Task 1: Awareness Test",
      prompt: "Show the running cooktop screen for a quick glance (0.5s / 1s / 2s). Ask: What info can you get? Which burner is active?"
    },
    2: {
      title: "Task 2: Precision Cooking Concept Evaluation",
      prompt: "Show the Precision Cooking concept screen. Ask user what they think Precision Cooking is and what it means to them."
    },
    3: {
      title: "Task 3: Precision Cooking Flow",
      prompt: "Turn any PRC-enabled knob to PRC (1s delay -> 3s countdown toast -> Spotlight). Tap Temperature tab -> pick temp (e.g. 350°F) -> click START. Live 5s preheat -> complete toast -> Burner status. Turn another burner knob to see live level setting animation, or turn to PRC for Food mode."
    },
    4: {
      title: "Task 4: End & Turn Off",
      prompt: "Ask users to turn off all burners. Observe if they use the touch screen or look for physical knobs."
    }
  };

  // ==============================================
  // SCREEN BADGE & QUICK JUMPER SYNC
  // ==============================================
  function detectCurrentVisibleScreen() {
    if (els.task1FullScreen && !els.task1FullScreen.hidden && els.task1FullScreen.style.display !== "none") {
      return "1-awareness";
    }

    if (els.viewTask2 && !els.viewTask2.hidden && els.viewTask2.style.display !== "none") {
      if (els.t2ScreenPrecision && !els.t2ScreenPrecision.hidden && els.t2ScreenPrecision.style.display !== "none") {
        if (els.t2PanelSpotlight && !els.t2PanelSpotlight.hidden) return "2-spotlight";
        if (els.t2PanelTechnique && !els.t2PanelTechnique.hidden) return "2-technique";
        if (els.t2PanelFood && !els.t2PanelFood.hidden) return "2-food";
        if (els.t2PanelTemperature && !els.t2PanelTemperature.hidden) {
          if (els.t2TempModeDigipad && !els.t2TempModeDigipad.hidden) return "2-digipad";
          return "2-temperature";
        }
        return `2-${state.task2.tab || "spotlight"}`;
      }
      return "2-explore";
    }

    if (els.viewTask3 && !els.viewTask3.hidden && els.viewTask3.style.display !== "none") {
      if (els.t3ScreenPancakes && !els.t3ScreenPancakes.hidden && els.t3ScreenPancakes.style.display !== "none") {
        if (els.t3PancakesViewBurner && !els.t3PancakesViewBurner.hidden) return "3C-pancakesBurner";
        if (els.t3PancakesViewCookware && !els.t3PancakesViewCookware.hidden) return "3C-pancakesCookware";
        if (els.t3PancakesViewTips && !els.t3PancakesViewTips.hidden) {
          if (els.t3TipsPanelIngredients && !els.t3TipsPanelIngredients.hidden) return "3C-pancakesIngredients";
          return "3C-pancakesTips";
        }
        return "3C-pancakesDoneness";
      }

      const screenMap = [
        { el: els.t3ScreenPancakesPreheat, name: "3C-pancakesPreheat" },
        { el: els.t3ScreenTurnKnob, name: "3A-turnknob" },
        { el: els.t3ScreenSpotlight, name: "3A-spotlight" },
        { el: els.t3ScreenTechnique, name: "3E-technique" },
        { el: els.t3ScreenTechniquePreheat, name: "3E-techniquePreheat" },
        { el: els.t3ScreenTechniqueComplete, name: "3E-techniqueComplete" },
        { el: els.t3ScreenRecentUsed, name: "3F-recentUsed" },
        { el: els.t3ScreenFoodOptions, name: "3C-foodOptions" },
        { el: els.t3ScreenBeefMenu, name: "3-beefmenu" },
        { el: els.t3ScreenBeefType, name: "3C-beefType" },
        { el: els.t3ScreenBeefDoneness, name: "3C-beefDoneness" },
        { el: els.t3ScreenBeefThickness, name: "3C-beefThickness" },
        { el: els.t3ScreenFoodPreheat, name: "3C-foodPreheat" },
        { el: els.t3ScreenFoodComplete, name: "3C-foodComplete" },
        { el: els.t3ScreenFoodBurnerStatus, name: "3C-foodBurnerStatus" },
        { el: els.t3ScreenSelectCookware, name: "3B-selectCookware" },
        { el: els.t3ScreenGuidedCooking, name: "3C-guidedCooking" },
        {
          el: els.t3ScreenPancakesPreheat,
          getName: () => (els.t3PancakesBurnerTile && els.t3PancakesBurnerTile.classList.contains("is-reached")) ? "3C-pancakesPreheatDone" : "3C-pancakesPreheat"
        },
        { el: els.t3ScreenTemperature, name: "3B-temperature" },
        { el: els.t3ScreenDigipad, name: "3B-digipad" },
        { el: els.t3ScreenPreheat, name: "3B-preheat" },
        { el: els.t3ScreenPreheatComplete, name: "3B-completed" },
        { el: els.t3ScreenBurnerStatus, name: "3-burnerStatus" },
        { el: els.t3ScreenTempRun, name: "3B-tempRun" },
        { el: els.t3ScreenStart, name: "3-start" }
      ];

      for (const item of screenMap) {
        if (item.el && !item.el.hidden && item.el.style.display !== "none") {
          return item.getName ? item.getName() : item.name;
        }
      }
      return `3-${t3Stage || "start"}`;
    }

    return "3-start";
  }

  function updateScreenBadge(screenName) {
    let cleanBadge = "";
    if (screenName) {
      if (state.currentTask === 3) {
        const t3PrefixMap = {
          start: "3-start",
          burnerStatus: "3-burnerStatus",
          turnknob: "3A-turnknob",
          spotlight: "3A-spotlight",
          temperature: "3B-temperature",
          selectCookware: "3B-selectCookware",
          digipad: "3B-digipad",
          preheat: "3B-preheat",
          completed: "3B-completed",
          tempRun: "3B-tempRun",
          technique: "3E-technique",
          techniquePreheat: "3E-techniquePreheat",
          techniqueComplete: "3E-techniqueComplete",
          foodOptions: "3C-foodOptions",
          pancakesDoneness: "3C-pancakesDoneness",
          pancakesBurner: "3C-pancakesBurner",
          pancakesTips: "3C-pancakesTips",
          pancakesIngredients: "3C-pancakesIngredients",
          pancakesCookware: "3C-pancakesCookware",
          pancakesPreheat: "3C-pancakesPreheat",
          guidedCooking: "3C-guidedCooking",
          beefMenu: "3-beefmenu",
          beefType: "3C-beefType",
          beefDoneness: "3C-beefDoneness",
          beefThickness: "3C-beefThickness",
          foodPreheat: "3C-foodPreheat",
          foodComplete: "3C-foodComplete",
          foodBurnerStatus: "3C-foodBurnerStatus",
          recentUsed: "3F-recentUsed"
        };
        cleanBadge = t3PrefixMap[screenName] || `3-${screenName}`;
      } else if (state.currentTask === 2) {
        cleanBadge = `2-${screenName}`;
      } else if (state.currentTask === 1) {
        cleanBadge = "1-awareness";
      }
    } else {
      cleanBadge = detectCurrentVisibleScreen();
    }

    if (els.screenBadgePill) {
      if (els.screenBadgePill.textContent !== cleanBadge) {
        els.screenBadgePill.textContent = cleanBadge;
        els.screenBadgePill.classList.remove("is-updated");
        void els.screenBadgePill.offsetWidth;
        els.screenBadgePill.classList.add("is-updated");
      }
    }

    if (els.screenJumperSelect) {
      let selectVal = "";
      if (cleanBadge.startsWith("3")) {
        const raw = cleanBadge.replace(/^3[A-Z]?-/, "");
        selectVal = `t3:${raw}`;
      } else if (cleanBadge.startsWith("2")) {
        const raw = cleanBadge.replace(/^2-/, "");
        selectVal = `t2:${raw}`;
      } else if (cleanBadge.startsWith("1")) {
        selectVal = "t1:awareness";
      }

      if (selectVal && els.screenJumperSelect.value !== selectVal) {
        let opt = els.screenJumperSelect.querySelector(`option[value="${selectVal}"]`);
        if (!opt && selectVal.toLowerCase() === "t3:beefmenu") {
          opt = els.screenJumperSelect.querySelector('option[value="t3:beefMenu"]');
        }
        if (opt) {
          els.screenJumperSelect.value = opt.value;
        }
      }
    }
  }

  function initScreenObserver() {
    const target = els.cooktopWrapper || document.getElementById("cooktopWrapper");
    if (!target) return;

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) cancelAnimationFrame(debounceTimer);
      debounceTimer = requestAnimationFrame(() => {
        updateScreenBadge();
      });
    });

    observer.observe(target, {
      attributes: true,
      attributeFilter: ["hidden", "style", "class"],
      subtree: true
    });
  }

  // SWITCH TASK
  function setTask(taskId) {
    playSound("touch");
    state.currentTask = taskId;

    // Update switcher buttons
    [els.btnTask1, els.btnTask2, els.btnTask3].forEach(btn => {
      if (btn) btn.classList.remove("is-active");
    });
    if (taskId === 1 && els.btnTask1) els.btnTask1.classList.add("is-active");
    if (taskId === 2 && els.btnTask2) els.btnTask2.classList.add("is-active");
    if (taskId === 3 && els.btnTask3) els.btnTask3.classList.add("is-active");

    // Update cheat sheet title
    if (TASK_INFO[taskId]) {
      if (els.taskTitle) els.taskTitle.textContent = TASK_INFO[taskId].title;
      if (els.taskPrompt) els.taskPrompt.textContent = TASK_INFO[taskId].prompt;
    }

    // Toggle subbar controls (Task 1 glance controls vs Task 3 flow controls)
    if (taskId !== 1 && state.shutterTimer) {
      clearTimeout(state.shutterTimer);
      state.shutterTimer = null;
    }
    if (els.glanceControls) {
      els.glanceControls.hidden = taskId !== 1;
      els.glanceControls.style.display = taskId === 1 ? "flex" : "none";
    }
    if (els.t3SubflowControls) {
      els.t3SubflowControls.hidden = true;
      els.t3SubflowControls.style.display = "none";
    }

    // Switch screen view
    if (taskId === 1) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = false;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = true;
      if (els.screenRail) els.screenRail.hidden = true;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = true;
      if (els.cooktopHotIndicator) {
        els.cooktopHotIndicator.hidden = true;
        els.cooktopHotIndicator.classList.remove("is-visible");
      }

      // Always start with screen covered in standby
      coverTask1Screen();
      updateScreenBadge("awareness");
    } else if (taskId === 2) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = false;
      if (els.viewTask3) els.viewTask3.hidden = true;
      ensureNavbarVisible();
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;

      // Initialize Task 2 to explore view
      showT2Explore(true);
      updateCooktopActiveState();
    } else if (taskId === 3) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = false;
      ensureNavbarVisible();
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;

      // Initialize Task 3 to start screen
      showT3Screen("start");
      updateCooktopActiveState();
    } else {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = true;
      ensureNavbarVisible();
      if (els.topStatus) els.topStatus.hidden = false;
      if (els.screenCanvas) els.screenCanvas.hidden = false;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = false;
    }

    updateNavbarState();

    // Cooktop Knobs Manifold (Visible in Task 2 and Task 3, 80px below screen)
    const hasKnobs = (taskId === 2 || taskId === 3);
    if (els.cooktopManifoldPanel) {
      els.cooktopManifoldPanel.hidden = !hasKnobs;
    }
    if (els.cooktopWrapper) {
      els.cooktopWrapper.classList.toggle("is-task-3", hasKnobs);
    }

    // Reset drawer
    closeDrawer();

    // Persist active task
    try {
      localStorage.setItem("polaris_active_task", taskId);
      history.replaceState(null, "", `?task=${taskId}#task${taskId}`);
    } catch (e) {}
  }

  // ==============================================
  // TASK 2: PRECISION COOKING CONCEPT LOGIC
  // ==============================================
  function showT2Explore(silent = false) {
    if (!silent) playSound("touch");
    if (state.currentTask === 1) {
      state.currentTask = 2;
      if (state.shutterTimer) {
        clearTimeout(state.shutterTimer);
        state.shutterTimer = null;
      }
    }
    ensureNavbarVisible();
    state.task2.screen = "explore";
    if (els.viewTask2) els.viewTask2.hidden = false;
    if (els.viewTask3) els.viewTask3.hidden = true;
    if (els.t2ScreenExplore) els.t2ScreenExplore.hidden = false;
    if (els.t2ScreenPrecision) els.t2ScreenPrecision.hidden = true;
    if (activePrcKnobIndex) {
      setKnobAngle(activePrcKnobIndex, 0, true, true);
    }
    updateScreenBadge("explore");
  }

  function showT2Precision(tabName = "temperature", tempMode = "picker", silent = false) {
    if (!silent) playSound("touch");
    if (state.currentTask === 1) {
      state.currentTask = 2;
      if (state.shutterTimer) {
        clearTimeout(state.shutterTimer);
        state.shutterTimer = null;
      }
    }
    ensureNavbarVisible();
    state.task2.screen = "precision";
    if (els.viewTask3) els.viewTask3.hidden = true;
    if (els.viewTask2) els.viewTask2.hidden = false;
    if (els.t2ScreenExplore) els.t2ScreenExplore.hidden = true;
    if (els.t2ScreenPrecision) els.t2ScreenPrecision.hidden = false;
    setT2Tab(tabName, tempMode, true);
    updateCooktopActiveState();
    if (tabName === "temperature") {
      requestAnimationFrame(() => {
        scrollToT2Temp(state.task2.temperature || 375, false);
      });
      setTimeout(() => {
        scrollToT2Temp(state.task2.temperature || 375, false);
      }, 50);
    }
  }

  function setT2Tab(tabName, tempMode = null, silent = false) {
    if (!silent) playSound("touch");
    state.task2.tab = tabName;
    if (tempMode) {
      state.task2.tempMode = tempMode;
    }

    const effectivePanel = (tabName === "recent") ? "spotlight" : tabName;
    const panels = {
      spotlight: els.t2PanelSpotlight,
      technique: els.t2PanelTechnique,
      food: els.t2PanelFood,
      temperature: els.t2PanelTemperature
    };

    for (const [key, panel] of Object.entries(panels)) {
      if (panel) {
        panel.hidden = (key !== effectivePanel);
      }
    }

    // Update active pill on Task 2 side drawer
    document.querySelectorAll("#t2SideDrawer .pc-drawer-item").forEach(item => {
      item.classList.toggle("is-active", item.dataset.t2tab === tabName);
    });

    // Reset scroll positions when entering technique or food
    if (tabName === "technique" && els.t2TechniqueScroll) {
      els.t2TechniqueScroll.scrollTop = 0;
    }
    if (tabName === "food" && els.t2FoodScroll) {
      els.t2FoodScroll.scrollTop = 0;
    }

    if (tabName === "temperature") {
      setT2TempMode(state.task2.tempMode, true);
      setTimeout(() => {
        if (state.task2.tempMode === "picker") {
          scrollToT2Temp(state.task2.temperature, false);
        }
      }, 50);
    }

    updateScreenBadge(tabName);
  }

  // TASK 2 TEMPERATURE WHEEL & DIGIPAD LOGIC (200°F - 500°F, 10° increments)
  const T2_TEMP_MIN = 200;
  const T2_TEMP_MAX = 500;
  const T2_TEMP_STEP = 25;
  let lastTickTemp = 375;

  function initT2PickerWheel() {
    if (!els.t2PickerTrack) return;
    els.t2PickerTrack.innerHTML = "";

    for (let t = T2_TEMP_MIN; t <= T2_TEMP_MAX; t += T2_TEMP_STEP) {
      const item = document.createElement("div");
      item.className = "t2-picker-item";
      item.dataset.temp = String(t);
      item.innerHTML = `<span class="t2-item-num">${t}</span><span class="t2-item-unit">°F</span>`;
      item.addEventListener("click", () => {
        scrollToT2Temp(t, true);
      });
      els.t2PickerTrack.appendChild(item);
    }

    let rafId = null;
    els.t2PickerTrack.addEventListener("scroll", () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateT2PickerVisuals();
      });
    }, { passive: true });

    // Enable drag-to-scroll with mouse on desktop
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    els.t2PickerTrack.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - els.t2PickerTrack.offsetLeft;
      scrollLeft = els.t2PickerTrack.scrollLeft;
      els.t2PickerTrack.style.scrollSnapType = "none";
    });
    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        els.t2PickerTrack.style.scrollSnapType = "x mandatory";
        snapToClosestT2Temp();
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - els.t2PickerTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      els.t2PickerTrack.scrollLeft = scrollLeft - walk;
    });

    els.t2PickerTrack.addEventListener("touchend", () => {
      setTimeout(snapToClosestT2Temp, 80);
    }, { passive: true });

    setTimeout(() => {
      scrollToT2Temp(state.task2.temperature || 375, false);
    }, 60);
  }

  function updateT2PickerVisuals() {
    if (!els.t2PickerTrack || els.t2PickerTrack.offsetParent === null || els.t2PickerTrack.clientWidth === 0) return;
    const trackWidth = els.t2PickerTrack.clientWidth || 493;
    const trackCenter = els.t2PickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t2PickerTrack.querySelectorAll(".t2-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      // Hierarchy classes: strictly 3 numbers visible (center active, 1 single immediate neighbor on each side)
      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      if (dist >= 80 && dist < 240) {
        item.classList.add("is-neighbor-1");
      }
    });

    if (closestItem) {
      closestItem.classList.remove("is-neighbor-1");
      closestItem.classList.add("is-active");
      const tempVal = parseInt(closestItem.dataset.temp, 10);
      if (tempVal !== state.task2.temperature) {
        state.task2.temperature = tempVal;
        state.task2.digipadBuffer = String(tempVal);
        if (els.t2DigipadValue) els.t2DigipadValue.textContent = String(tempVal);
        
        if (tempVal !== lastTickTemp) {
          lastTickTemp = tempVal;
          playSound("touch");
        }
      }
    }
  }

  function snapToClosestT2Temp() {
    if (!els.t2PickerTrack) return;
    const trackWidth = els.t2PickerTrack.clientWidth || 493;
    const trackCenter = els.t2PickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t2PickerTrack.querySelectorAll(".t2-picker-item");
    let closestTemp = 375;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestTemp = parseInt(item.dataset.temp, 10);
      }
    });

    scrollToT2Temp(closestTemp, true);
  }

  function scrollToT2Temp(temp, smooth = true) {
    if (!els.t2PickerTrack) return;
    const index = Math.round((temp - T2_TEMP_MIN) / T2_TEMP_STEP);
    const targetScrollLeft = index * 160;
    els.t2PickerTrack.scrollLeft = targetScrollLeft;
    els.t2PickerTrack.scrollTo({
      left: targetScrollLeft,
      behavior: smooth ? "smooth" : "auto"
    });
    state.task2.temperature = temp;
    state.task2.digipadBuffer = String(temp);
    if (els.t2DigipadValue) els.t2DigipadValue.textContent = String(temp);
    updateT2PickerVisuals();
    setTimeout(updateT2PickerVisuals, smooth ? 250 : 50);
  }

  function setT2TempMode(mode, silent = false) {
    if (!silent) playSound("touch");
    state.task2.tempMode = mode;
    if (mode === "picker") {
      // Sync from digipad input if switching to picker
      if (state.task2.digipadBuffer && state.task2.digipadBuffer !== "---") {
        let val = parseInt(state.task2.digipadBuffer, 10);
        if (!isNaN(val)) {
          val = Math.max(T2_TEMP_MIN, Math.min(T2_TEMP_MAX, val));
          val = Math.round(val / T2_TEMP_STEP) * T2_TEMP_STEP;
          state.task2.temperature = val;
          state.task2.digipadBuffer = String(val);
        }
      }
      if (els.t2TempModePicker) els.t2TempModePicker.hidden = false;
      if (els.t2TempModeDigipad) els.t2TempModeDigipad.hidden = true;
      setTimeout(() => {
        scrollToT2Temp(state.task2.temperature, false);
      }, 30);
    } else {
      // Switching to digipad
      state.task2.digipadBuffer = String(state.task2.temperature);
      if (els.t2DigipadValue) els.t2DigipadValue.textContent = state.task2.digipadBuffer;
      state.task2.hasEditedKeypad = false;
      if (els.t2TempModePicker) els.t2TempModePicker.hidden = true;
      if (els.t2TempModeDigipad) els.t2TempModeDigipad.hidden = false;
    }
  }

  function handleDigipadInput(key) {
    if (key === "clear") {
      playSound("cancel");
      state.task2.digipadBuffer = "---";
      state.task2.hasEditedKeypad = true;
    } else if (key === "backspace") {
      playSound("touch");
      if (state.task2.digipadBuffer !== "---" && state.task2.digipadBuffer.length > 0) {
        state.task2.digipadBuffer = state.task2.digipadBuffer.slice(0, -1);
        if (!state.task2.digipadBuffer) {
          state.task2.digipadBuffer = "---";
        }
      }
      state.task2.hasEditedKeypad = true;
    } else {
      // numeric digit (0-9)
      playSound("touch");
      if (state.task2.digipadBuffer === "---" || !state.task2.hasEditedKeypad) {
        state.task2.digipadBuffer = key;
        state.task2.hasEditedKeypad = true;
      } else if (state.task2.digipadBuffer.length < 3) {
        state.task2.digipadBuffer += key;
      }
    }

    if (els.t2DigipadValue) {
      els.t2DigipadValue.textContent = state.task2.digipadBuffer || "---";
    }
  }

  // TASK 1: GLANCE FLASH CONTROLS (0.5s / 1s / 2s) - SILENT FOR USER STUDY
  function flashGlance(durationMs) {
    if (state.shutterTimer) clearTimeout(state.shutterTimer);

    // Uncover immediately (including navbar)
    if (els.task1StandbyCover) {
      els.task1StandbyCover.classList.add("is-revealed");
      els.task1StandbyCover.style.display = "none";
    }
    if (state.currentTask === 1 && els.screenRail) {
      els.screenRail.hidden = false;
      updateNavbarState();
    }
    if (els.glanceStatusPill) els.glanceStatusPill.classList.add("is-active");
    if (els.pillStatusText) {
      const sec = durationMs >= 1000 ? (durationMs / 1000) + "s" : (durationMs / 1000) + "s";
      els.pillStatusText.textContent = `Revealed (${sec})`;
    }

    // Automatically re-cover after exact duration
    state.shutterTimer = setTimeout(() => {
      coverTask1Screen();
    }, durationMs);
  }

  function coverTask1Screen() {
    if (state.currentTask !== 1) return;
    if (state.shutterTimer) {
      clearTimeout(state.shutterTimer);
      state.shutterTimer = null;
    }
    if (els.task1StandbyCover) {
      els.task1StandbyCover.classList.remove("is-revealed");
      els.task1StandbyCover.style.display = "flex";
    }
    if (els.screenRail) {
      els.screenRail.hidden = true;
    }
    if (els.glanceStatusPill) els.glanceStatusPill.classList.remove("is-active");
    if (els.pillStatusText) els.pillStatusText.textContent = "Hidden";
    if (els.btnShutterToggle) {
      els.btnShutterToggle.classList.remove("is-active");
      els.btnShutterToggle.textContent = "Preview";
    }
  }

  function togglePreview() {
    const isCurrentlyRevealed = els.task1StandbyCover && (
      els.task1StandbyCover.style.display === "none" ||
      els.task1StandbyCover.classList.contains("is-revealed")
    );

    if (isCurrentlyRevealed) {
      coverTask1Screen();
    } else {
      if (state.shutterTimer) clearTimeout(state.shutterTimer);
      if (els.task1StandbyCover) {
        els.task1StandbyCover.classList.add("is-revealed");
        els.task1StandbyCover.style.display = "none";
      }
      if (state.currentTask === 1 && els.screenRail) {
        els.screenRail.hidden = false;
        updateNavbarState();
      }
      if (els.glanceStatusPill) els.glanceStatusPill.classList.add("is-active");
      if (els.pillStatusText) els.pillStatusText.textContent = "Preview (On)";
      if (els.btnShutterToggle) {
        els.btnShutterToggle.classList.add("is-active");
        els.btnShutterToggle.textContent = "Hide Screen";
      }
    }
  }

  // SCALE CONTROL (PHYSICAL 1:1 ON IPAD PRO 13" vs 100% CANVAS)
  function setAppScale(scaleFactor, mode) {
    document.documentElement.style.setProperty("--app-scale", scaleFactor);
    if (els.btnScalePhysical && els.btnScaleNative) {
      if (mode === "physical") {
        els.btnScalePhysical.classList.add("is-active");
        els.btnScaleNative.classList.remove("is-active");
        if (els.deviceSpec) els.deviceSpec.textContent = 'Physical 1:1 (160.5 × 60.2 mm on iPad Pro 13")';
      } else {
        els.btnScalePhysical.classList.remove("is-active");
        els.btnScaleNative.classList.add("is-active");
        if (els.deviceSpec) els.deviceSpec.textContent = '100% Native Canvas [1024 × 384 px]';
      }
    }
    try {
      localStorage.setItem("polaris_app_scale_mode", mode);
    } catch (e) {}
  }

  // TASK 3: DRAWER & CONFIGURATION
  function openDrawer(burnerId, defaultTab = "temp") {
    if (!els.precisionDrawer) return;
    playSound("touch");
    state.selectedBurner = burnerId;

    const names = {
      "rear-left": "Rear Left Burner",
      "front-left": "Front Left Burner",
      "center": "Center Burner",
      "top-right": "Rear Right Burner",
      "front-right": "Front Right Burner"
    };
    if (els.drawerBurnerLabel) {
      els.drawerBurnerLabel.textContent = names[burnerId] || burnerId;
    }

    switchTab(defaultTab);
    els.precisionDrawer.hidden = false;
  }

  function closeDrawer() {
    if (els.precisionDrawer) {
      els.precisionDrawer.hidden = true;
    }
  }

  function switchTab(tabKey) {
    playSound("touch");
    [els.tabTemp, els.tabFood, els.tabTechnique].forEach(t => {
      if (t) t.classList.remove("is-active");
    });
    [els.panelTemp, els.panelFood, els.panelTechnique].forEach(p => {
      if (p) p.hidden = true;
    });

    if (tabKey === "temp" && els.tabTemp && els.panelTemp) {
      els.tabTemp.classList.add("is-active");
      els.panelTemp.hidden = false;
    } else if (tabKey === "food" && els.tabFood && els.panelFood) {
      els.tabFood.classList.add("is-active");
      els.panelFood.hidden = false;
    } else if (tabKey === "technique" && els.tabTechnique && els.panelTechnique) {
      els.tabTechnique.classList.add("is-active");
      els.panelTechnique.hidden = false;
    }
  }

  function updateTemp(newTemp) {
    state.targetTemp = Math.max(100, Math.min(550, newTemp));
    els.tempNum.textContent = state.targetTemp;
    els.btnConfirmTemp.textContent = `Start Heating at ${state.targetTemp}°F`;

    // Highlight matching quick pill
    document.querySelectorAll(".quick-pill").forEach(pill => {
      const val = parseInt(pill.dataset.val, 10);
      pill.classList.toggle("is-selected", val === state.targetTemp);
    });
  }

  // CONFIRM TEMPERATURE (TASK A & B)
  function confirmTemperature() {
    playSound("toggleOn");
    const burner = state.burners[state.selectedBurner];
    burner.state = "precision-temp";
    burner.temp = state.targetTemp;
    burner.label = `${state.targetTemp}°F`;

    renderBurnerState(state.selectedBurner);
    closeDrawer();
  }

  // CONFIRM FOOD (TASK C: STEAK)
  function confirmFood(foodName = "Steak") {
    playSound("toggleOn");
    const burner = state.burners[state.selectedBurner];
    burner.state = "precision-food";
    burner.mode = foodName;
    burner.label = `${foodName.toUpperCase()}`;

    renderBurnerState(state.selectedBurner);
    closeDrawer();
  }

  // CONFIRM TECHNIQUE (TASK E: CARAMELIZE)
  function confirmTechnique(techName = "Caramelize") {
    playSound("toggleOn");
    const burner = state.burners[state.selectedBurner];
    burner.state = "precision-tech";
    burner.mode = techName;
    burner.label = `${techName.toUpperCase()}`;

    renderBurnerState(state.selectedBurner);
    closeDrawer();
  }

  // TURN OFF PRECISION (TASK D)
  function turnOffPrecision() {
    playSound("cancel");
    const burner = state.burners[state.selectedBurner];
    burner.state = "off";
    burner.temp = null;
    burner.mode = null;
    burner.label = "OFF";

    renderBurnerState(state.selectedBurner);
    closeDrawer();
  }

  // TURN OFF ALL (TASK 4)
  function turnOffAll() {
    playSound("toggleOff");
    Object.keys(state.burners).forEach(id => {
      state.burners[id] = { state: "off", temp: null, mode: null, label: "OFF" };
      renderBurnerState(id);
    });
    closeDrawer();

    // Cheat sheet update
    els.taskTitle.textContent = TASK_INFO[4].title;
    els.taskPrompt.textContent = TASK_INFO[4].prompt;
  }

  function renderBurnerState(burnerId) {
    const card = document.getElementById(
      burnerId === "rear-left" ? "t3RearLeft" :
      burnerId === "front-left" ? "t3FrontLeft" :
      burnerId === "front-right" ? "t3FrontRight" : null
    );
    const label = document.getElementById(
      burnerId === "rear-left" ? "t3RearLeftState" :
      burnerId === "front-left" ? "t3FrontLeftState" :
      burnerId === "front-right" ? "t3FrontRightState" : null
    );

    if (!card || !label) return;

    const data = state.burners[burnerId];
    if (data.state === "off") {
      card.classList.remove("is-configured");
      label.textContent = "OFF";
      label.style.color = "var(--text-subtle)";
    } else {
      card.classList.add("is-configured");
      label.innerHTML = `<strong>${data.label}</strong><br><small style="color:var(--orange-accent);font-size:10px;">PRECISION</small>`;
    }
  }

  // ==============================================
  // TASK 3: PRECISION COOKING FLOW (FIGMA ARTBOARDS)
  // ==============================================
  const knobsState = [
    { index: 1, burner: "front-left", angle: 0, isOn: false },
    { index: 2, burner: "rear-left", angle: 0, isOn: false },
    { index: 3, burner: "center", angle: 0, isOn: false },
    { index: 4, burner: "top-right", angle: 0, isOn: false },
    { index: 5, burner: "front-right", angle: 0, isOn: false }
  ];

  let t3CountdownInterval = null;
  let t3HoldingTimeout = null;
  let t3PreheatInterval = null;
  const t3PrcQuietTimers = { 1: null, 2: null, 3: null, 4: null, 5: null };
  const currentT3BurnerLevels = { 1: "off", 2: "off", 3: "off", 4: "off", 5: "off" };
  const t3BurnerTargetTemps = { 1: 350, 2: 350, 4: 350, 5: 350 };
  let activePrcKnobIndex = 1;
  let t3Stage = "start"; // "start" | "turnknob" | "spotlight" | "temperature" | "preheat" | "completed" | "burnerStatus"
  let transitionCookwareToTemperature = null;
  let transitionTemperatureToCookware = null;

  function isAnyKnobOrBurnerActive() {
    if (state.currentTask === 1) return false;

    // Check if ANY knob is turned on (angle > 5 or angle < -20 or isOn)
    const anyKnobOn = knobsState.some((k) => k && (Math.abs(k.angle) > 5 || k.isOn));
    if (anyKnobOn) return true;

    // Check if Task 3 is in an active cooking stage
    if (state.currentTask === 3) {
      if (t3Stage === "foodBurnerStatus") {
        const k1On = knobsState[0] && Math.abs(knobsState[0].angle) > 12;
        const k2On = knobsState[1] && Math.abs(knobsState[1].angle) > 12;
        return k1On || k2On;
      }
      if (t3Stage === "burnerStatus") {
        const k2On = knobsState[1] && Math.abs(knobsState[1].angle) > 12;
        return k2On;
      }
      if (t3Stage === "pancakesPreheat") {
        const k1On = knobsState[0] && Math.abs(knobsState[0].angle) > 12;
        const k2On = knobsState[1] && Math.abs(knobsState[1].angle) > 12;
        return k1On || k2On;
      }
      if (
        t3Stage === "beefType" ||
        t3Stage === "beefDoneness" ||
        t3Stage === "beefThickness" ||
        t3Stage === "preheat" ||
        t3Stage === "completed" ||
        t3Stage === "tempRun" ||
        t3Stage === "foodPreheat" ||
        t3Stage === "foodComplete" ||
        t3Stage === "techniquePreheat" ||
        t3Stage === "techniqueComplete" ||
        t3Stage === "guidedCooking" ||
        (t3Stage && t3Stage.startsWith("pancakes") && t3Stage !== "pancakesPreheat")
      ) {
        return true;
      }
    }

    // Check if Task 2 is in precision flow
    if (state.currentTask === 2) {
      if (state.task2 && state.task2.screen === "precision") {
        return true;
      }
    }

    return false;
  }

  function isAnyBurnerRunning() {
    if (state.currentTask === 1) return true;
    return isAnyKnobOrBurnerActive();
  }

  function ensureNavbarVisible() {
    if (state.currentTask !== 1 && els.screenRail) {
      els.screenRail.hidden = false;
      els.screenRail.removeAttribute("hidden");
      els.screenRail.style.display = "block";
    }
    updateNavbarState();
  }

  function updateNavbarState() {
    if (!els.screenRailBg) return;
    const running = isAnyBurnerRunning();
    const targetSrc = running ? "./assets/navbar-running-90px.png" : "./assets/navbar-pinned-90px.png";
    if (els.screenRailBg.getAttribute("src") !== targetSrc) {
      els.screenRailBg.src = targetSrc;
    }
  }

  function updateCooktopActiveState() {
    const isActive = isAnyKnobOrBurnerActive();

    // 1. Activity Bar (Above anything else, even above navbar)
    if (els.screenBottomStrip) {
      if (state.currentTask === 1) {
        els.screenBottomStrip.hidden = true;
        els.screenBottomStrip.style.display = "none";
      } else {
        els.screenBottomStrip.hidden = !isActive;
        els.screenBottomStrip.style.display = isActive ? "block" : "none";
      }
    }

    // 2. Cooktop Hot Red Color Indicator in top status bar (Figma node 2315:14550)
    const isGuided = (t3Stage === "guidedCooking");
    if (els.cooktopHotIndicator) {
      if (state.currentTask === 1 || isGuided) {
        els.cooktopHotIndicator.hidden = true;
        els.cooktopHotIndicator.classList.remove("is-visible");
      } else {
        els.cooktopHotIndicator.hidden = !isActive;
        els.cooktopHotIndicator.classList.toggle("is-visible", isActive);
      }
    }

    // 2b. Guided cooking status bar hot indicator (Figma 3321:34955)
    if (els.t3GuidedHotIndicator) {
      els.t3GuidedHotIndicator.hidden = !isActive;
      els.t3GuidedHotIndicator.classList.toggle("is-visible", isActive);
    }

    // 3. Left Navbar running state
    updateNavbarState();
  }

  function showT3Screen(stage) {
    if (state.currentTask === 1) {
      state.currentTask = 3;
      if (state.shutterTimer) {
        clearTimeout(state.shutterTimer);
        state.shutterTimer = null;
      }
    }
    ensureNavbarVisible();
    t3Stage = stage;
    if (els.viewTask3) els.viewTask3.hidden = false;
    if (els.viewTask2) els.viewTask2.hidden = true;
    if (els.viewTask1) els.viewTask1.hidden = true;

    // Reset lingering animation styles on start and spotlight screens
    if (stage !== "start" && stage !== "burnerStatus") {
      if (els.t3ScreenStart) {
        els.t3ScreenStart.style.transition = "";
        els.t3ScreenStart.style.webkitTransition = "";
        els.t3ScreenStart.style.transform = "";
        els.t3ScreenStart.style.webkitTransform = "";
        els.t3ScreenStart.style.opacity = "";
      }
    }
    if (stage !== "spotlight") {
      if (els.t3ScreenSpotlight) {
        els.t3ScreenSpotlight.style.transition = "";
        els.t3ScreenSpotlight.style.webkitTransition = "";
        els.t3ScreenSpotlight.style.transform = "";
        els.t3ScreenSpotlight.style.webkitTransform = "";
        els.t3ScreenSpotlight.style.boxShadow = "";
        els.t3ScreenSpotlight.style.zIndex = "";
      }
    }
    if (stage !== "temperature") {
      if (els.t3ScreenTemperature) {
        els.t3ScreenTemperature.style.transition = "";
        els.t3ScreenTemperature.style.webkitTransition = "";
        els.t3ScreenTemperature.style.transform = "";
        els.t3ScreenTemperature.style.webkitTransform = "";
        els.t3ScreenTemperature.style.boxShadow = "";
        els.t3ScreenTemperature.style.zIndex = "";
      }
    }
    if (stage !== "selectCookware") {
      if (els.t3ScreenSelectCookware) {
        els.t3ScreenSelectCookware.style.transition = "";
        els.t3ScreenSelectCookware.style.webkitTransition = "";
        els.t3ScreenSelectCookware.style.transform = "";
        els.t3ScreenSelectCookware.style.webkitTransform = "";
        els.t3ScreenSelectCookware.style.boxShadow = "";
        els.t3ScreenSelectCookware.style.zIndex = "";
      }
    }
    if (stage !== "foodOptions") {
      if (els.t3ScreenFoodOptions) {
        els.t3ScreenFoodOptions.style.transition = "";
        els.t3ScreenFoodOptions.style.webkitTransition = "";
        els.t3ScreenFoodOptions.style.transform = "";
        els.t3ScreenFoodOptions.style.webkitTransform = "";
        els.t3ScreenFoodOptions.style.boxShadow = "";
        els.t3ScreenFoodOptions.style.zIndex = "";
      }
    }
    if (stage !== "recentUsed") {
      if (els.t3ScreenRecentUsed) {
        els.t3ScreenRecentUsed.style.transition = "";
        els.t3ScreenRecentUsed.style.webkitTransition = "";
        els.t3ScreenRecentUsed.style.transform = "";
        els.t3ScreenRecentUsed.style.webkitTransform = "";
        els.t3ScreenRecentUsed.style.boxShadow = "";
        els.t3ScreenRecentUsed.style.zIndex = "";
      }
    }
    if (stage !== "beefMenu") {
      if (els.t3ScreenBeefMenu) {
        els.t3ScreenBeefMenu.style.transition = "";
        els.t3ScreenBeefMenu.style.webkitTransition = "";
        els.t3ScreenBeefMenu.style.transform = "";
        els.t3ScreenBeefMenu.style.webkitTransform = "";
        els.t3ScreenBeefMenu.style.boxShadow = "";
        els.t3ScreenBeefMenu.style.zIndex = "";
      }
    }
    if (!stage.startsWith("pancakes") || stage === "pancakesPreheat") {
      if (els.t3ScreenPancakes) {
        els.t3ScreenPancakes.style.transition = "";
        els.t3ScreenPancakes.style.webkitTransition = "";
        els.t3ScreenPancakes.style.transform = "";
        els.t3ScreenPancakes.style.webkitTransform = "";
        els.t3ScreenPancakes.style.boxShadow = "";
        els.t3ScreenPancakes.style.zIndex = "";
      }
    }

    const isStartOverview = (stage === "start");
    if (els.t3ScreenStart) els.t3ScreenStart.hidden = !isStartOverview;
    if (els.t3ScreenTurnKnob) els.t3ScreenTurnKnob.hidden = (stage !== "turnknob");
    if (els.t3ScreenSpotlight) els.t3ScreenSpotlight.hidden = (stage !== "spotlight");
    if (els.t3ScreenTechnique) els.t3ScreenTechnique.hidden = (stage !== "technique");
    if (els.t3ScreenTemperature) els.t3ScreenTemperature.hidden = (stage !== "temperature");
    if (els.t3ScreenSelectCookware) els.t3ScreenSelectCookware.hidden = (stage !== "selectCookware");
    if (els.t3ScreenDigipad) els.t3ScreenDigipad.hidden = (stage !== "digipad");
    if (els.t3ScreenPreheat) els.t3ScreenPreheat.hidden = (stage !== "preheat");
    if (els.t3ScreenPreheatComplete) els.t3ScreenPreheatComplete.hidden = (stage !== "completed");
    if (els.t3ScreenBurnerStatus) els.t3ScreenBurnerStatus.hidden = (stage !== "burnerStatus");
    if (els.t3ScreenTempRun) els.t3ScreenTempRun.hidden = (stage !== "tempRun");

    if (stage !== "burnerStatus") {
      hideT3CompleteToast();
    }

    // Task 3C screens:
    if (els.t3ScreenFoodOptions) els.t3ScreenFoodOptions.hidden = (stage !== "foodOptions");
    const isPancakes = stage.startsWith("pancakes") && stage !== "pancakesPreheat";
    if (els.t3ScreenPancakes) {
      els.t3ScreenPancakes.hidden = !isPancakes;
      if (isPancakes) {
        let subView = "doneness";
        if (stage === "pancakesBurner") subView = "burner";
        else if (stage === "pancakesCookware") subView = "cookware";
        else if (stage === "pancakesTips") subView = "tips";
        else if (stage === "pancakesIngredients") subView = "ingredients";
        showT3PancakesView(subView);
      }
    }
    if (els.t3ScreenPancakesPreheat) els.t3ScreenPancakesPreheat.hidden = (stage !== "pancakesPreheat");
    if (els.t3ScreenGuidedCooking) els.t3ScreenGuidedCooking.hidden = (stage !== "guidedCooking");
    if (els.t3ScreenBeefMenu) els.t3ScreenBeefMenu.hidden = (stage !== "beefMenu");
    if (els.t3ScreenBeefType) els.t3ScreenBeefType.hidden = (stage !== "beefType");
    if (els.t3ScreenBeefDoneness) els.t3ScreenBeefDoneness.hidden = (stage !== "beefDoneness");
    if (els.t3ScreenBeefThickness) els.t3ScreenBeefThickness.hidden = (stage !== "beefThickness");
    if (els.t3ScreenFoodPreheat) els.t3ScreenFoodPreheat.hidden = (stage !== "foodPreheat");
    if (els.t3ScreenFoodComplete) els.t3ScreenFoodComplete.hidden = (stage !== "foodComplete");
    if (els.t3ScreenFoodBurnerStatus) els.t3ScreenFoodBurnerStatus.hidden = (stage !== "foodBurnerStatus");

    // Task 3C Technique screens:
    if (els.t3ScreenTechniquePreheat) els.t3ScreenTechniquePreheat.hidden = (stage !== "techniquePreheat");
    if (els.t3ScreenTechniqueComplete) els.t3ScreenTechniqueComplete.hidden = (stage !== "techniqueComplete");

    // Task 3F Recent Used screen:
    if (els.t3ScreenRecentUsed) els.t3ScreenRecentUsed.hidden = (stage !== "recentUsed");

    // Top status bar visibility (Figma 2323:15134, 3198:22619) - 48px tall status bar on pancakes config screens (bg_purple.png lacks baked status bar)
    const needsTopStatus = (
      stage.startsWith("pancakes") &&
      stage !== "pancakesPreheat" &&
      stage !== "guidedCooking"
    );
    if (els.topStatus) {
      els.topStatus.hidden = !needsTopStatus;
    }

    if (stage !== "completed" && stage !== "foodComplete" && stage !== "techniqueComplete" && els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
    } else if ((stage === "completed" || stage === "foodComplete" || stage === "techniqueComplete") && els.t3ToastPreheatComplete) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if ((t3Stage === "completed" || t3Stage === "foodComplete" || t3Stage === "techniqueComplete") && els.t3ToastPreheatComplete) {
            els.t3ToastPreheatComplete.classList.add("is-visible");
          }
        }, 50);
      });
    }

    // Update active pill on Task 3 side drawers
    if (stage === "temperature") {
      const drawer = document.getElementById("t3SideDrawerTemp");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "temperature");
        });
      }
      requestAnimationFrame(() => {
        scrollToT3Temp(state.task3TargetTemp || 350, false);
      });
      setTimeout(() => {
        scrollToT3Temp(state.task3TargetTemp || 350, false);
      }, 50);
    } else if (stage === "tempRun") {
      const drawer = document.getElementById("t3SideDrawerTempRun");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "temperature");
        });
      }
      requestAnimationFrame(() => {
        scrollToT3RunTemp(state.task3TargetTemp || 350, false);
      });
      setTimeout(() => {
        scrollToT3RunTemp(state.task3TargetTemp || 350, false);
      }, 50);
    } else if (stage === "technique") {
      const drawer = document.getElementById("t3SideDrawerTech");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "technique");
        });
      }
    } else if (stage === "foodOptions") {
      const drawer = document.getElementById("t3SideDrawerFood");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "food");
        });
      }
    } else if (stage === "recentUsed") {
      const drawer = document.getElementById("t3SideDrawerRecent");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "recent");
        });
      }
    } else if (stage === "selectCookware") {
      const drawer = document.getElementById("t3SideDrawerCookware");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "temperature");
        });
      }
    }

    // Activity bar & Cooktop Hot indicator are active whenever any knob is turned on or cooking runs
    updateCooktopActiveState();

    if (stage === "completed") {
      const targetTemp = state.task3TargetTemp || 350;
      if (els.t3CompleteTarget) els.t3CompleteTarget.textContent = targetTemp;
    }
    if (stage === "burnerStatus") {
      const targetTemp = t3BurnerTargetTemps[2] || state.task3TargetTemp || 350;
      if (els.tStartActiveBurner1) {
        els.tStartActiveBurner1.hidden = false;
        if (els.tStartBurner1Temp) {
          els.tStartBurner1Temp.textContent = `${targetTemp}°F`;
        }
      }
      if (els.t3BurnerStatusTemp) {
        els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
      }
      if (els.t3TileLiveTemp) {
        els.t3TileLiveTemp.textContent = `${targetTemp}°F`;
      }
      // Returning to Burner Status (e.g. after Pancakes guided cooking): Rear Left is already at target,
      // so show the 2-row complete card (Temperature / 500°F) and hide the stale "Preheat to" line.
      // startT3Preheat() removes this class again right after calling showT3Screen for a fresh preheat.
      if (els.t3BurnerTextTile) {
        els.t3BurnerTextTile.classList.add("is-complete");
      }
      clearT3Timers();

      // On Burner Status (Figma 2310:12162): Rear Left is running with tStartActiveBurner1.
      // The knob shouldn't auto turn off: Knob 2 stays ON at PRC (-56°) if user didn't turn it off!
      if (!knobsState[1] || Math.abs(knobsState[1].angle) <= 5) {
        setKnobAngle(2, -56, false, false);
      }
      currentT3BurnerLevels[2] = "prc";
      activePrcKnobIndex = 2;

      // Reset DOM setting roller for burner 2 so it is hidden and doesn't cover running status card
      resetT3BurnerToOff(2);
      if (els.t3BurnerRoller2) {
        els.t3BurnerRoller2.classList.remove("is-active");
      }

      // Do NOT turn off any other knobs that the user may have turned on!
      [1, 3, 4, 5].forEach(i => {
        if (!currentT3BurnerLevels[i] || currentT3BurnerLevels[i] === "off") {
          currentT3BurnerLevels[i] = "off";
          resetT3BurnerToOff(i);
        }
      });

      if (els.t3ToastCard) {
        els.t3ToastCard.hidden = true;
        els.t3ToastCard.classList.remove("is-visible", "is-raising-up", "is-dismissing");
      }
      if (els.t3ToastNum) {
        els.t3ToastNum.textContent = "3";
      }
    }
    if (stage === "beefType" || stage === "beefDoneness" || stage === "beefThickness") {
      if (typeof window.__onEnterBeefScreen === "function") {
        window.__onEnterBeefScreen(stage);
      }
    }
    if (stage === "beefMenu") {
      clearT3Timers();
      state.task3Mode = "food";
      if (!knobsState[1] || Math.abs(knobsState[1].angle) <= 5) setKnobAngle(2, -56, false, false);
      currentT3BurnerLevels[2] = "prc";
      if (typeof window.__updateBeefMenuUI === "function") {
        window.__updateBeefMenuUI();
      }
    }
    if (stage === "foodBurnerStatus") {
      clearT3Timers();
      const targetTemp = state.task3TargetTemp || 350;
      if (els.t3FoodBurnerStatusTemp1) els.t3FoodBurnerStatusTemp1.textContent = `${targetTemp}°F`;
      // In foodBurnerStatus (Figma 2327:15934): BOTH Rear Left and Front Left are running!
      if (!knobsState[1] || Math.abs(knobsState[1].angle) <= 5) setKnobAngle(2, -56, false, false);
      if (!knobsState[0] || Math.abs(knobsState[0].angle) <= 5) setKnobAngle(1, -56, false, false);
      currentT3BurnerLevels[2] = "prc";
      currentT3BurnerLevels[1] = "prc";

      if (els.t3FoodBurnerOffRL) els.t3FoodBurnerOffRL.hidden = true;
      if (els.t3FoodBurnerOffFL) els.t3FoodBurnerOffFL.hidden = true;
      if (els.t3FoodBurnerStatusTempDisplay) els.t3FoodBurnerStatusTempDisplay.style.display = "";
      if (els.t3FoodBurnerStatusFLType) els.t3FoodBurnerStatusFLType.textContent = els.t3BeefValType?.textContent || currentBeefType || "Steak";
      if (els.t3FoodBurnerStatusFLDoneness) els.t3FoodBurnerStatusFLDoneness.textContent = els.t3BeefValDoneness?.textContent || currentBeefDoneness || "Med Rare";
      if (els.t3FoodBurnerStatusFLText) els.t3FoodBurnerStatusFLText.style.display = "flex";
      if (els.t3HotspotRearLeftBurner) els.t3HotspotRearLeftBurner.style.pointerEvents = "auto";
      if (els.t3HotspotFrontLeftBurner) els.t3HotspotFrontLeftBurner.style.pointerEvents = "auto";
    }

    if (stage === "pancakesPreheat") {
      const isKnob2Off = !knobsState[1] || Math.abs(knobsState[1].angle) <= 12;
      if (els.t3PancakesBurnerOffRL) {
        els.t3PancakesBurnerOffRL.hidden = !isKnob2Off;
      }
      if (els.t3PancakesRLTexts) {
        els.t3PancakesRLTexts.hidden = isKnob2Off;
      }
      if (els.t3PancakesRLTemp) {
        const rlTemp = t3BurnerTargetTemps[2] || state.task3TargetTemp || 500;
        els.t3PancakesRLTemp.textContent = `${rlTemp}°F`;
      }
    }

    if (stage === "start" || stage === "burnerStatus") {
      tempRunReturnStage = null;
    }
    if (stage === "start") {
      clearT3Timers();
      syncAllT3RollersWithKnobs();
      const anyKnobActive = knobsState.some(k => k && Math.abs(k.angle) > 12);
      if (!anyKnobActive) {
        state.task3Mode = "temp";
        state.task3IsRunning = false;
        activePrcKnobIndex = null;
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
      } else {
        const isKnob2Prc = Boolean(knobsState[1] && knobsState[1].angle < -20 && knobsState[1].angle > -80);
        if (els.tStartActiveBurner1) {
          els.tStartActiveBurner1.hidden = !isKnob2Prc;
          if (els.tStartBurner1Temp) {
            els.tStartBurner1Temp.textContent = `${t3BurnerTargetTemps[2] || state.task3TargetTemp || 350}°F`;
          }
        }
      }
      if (els.t3ToastCard) {
        els.t3ToastCard.hidden = true;
        els.t3ToastCard.classList.remove("is-visible", "is-raising-up", "is-dismissing");
      }
      if (els.t3ToastNum) {
        els.t3ToastNum.textContent = "3";
      }
    }

    updateCooktopActiveState();
    updateScreenBadge(stage);
    updatePancakesLockState();
  }

  // Once the Pancakes burner has started preheating (pancakesPreheat overview, incl. after guided
  // cooking), the nav rail Back caret and the in-screen back hotspot do nothing, and Cooktop stays
  // on this overview. Tapping the Pancakes temperature tile still opens its settings to change them. The only way to change it is to turn the knob OFF and start over.
  function isPancakesLocked() {
    return state.currentTask === 3 && t3Stage === "pancakesPreheat";
  }
  function updatePancakesLockState() {
    const locked = isPancakesLocked();
    ["navBackBtn"].forEach(id => {
      const b = document.getElementById(id);
      if (b) {
        b.classList.toggle("is-disabled", locked);
        b.setAttribute("aria-disabled", locked ? "true" : "false");
      }
    });
  }

  function resetT3BurnerToOff(i) {
    if (i) {
      cancelT3BurnerArc(i);
    } else {
      [1, 2, 4, 5].forEach(idx => cancelT3BurnerArc(idx));
    }
    const burnerConfigs = {
      1: { itemH: 38, baseOffset: 45 },
      2: { itemH: 38, baseOffset: 45 },
      3: { itemH: 36, baseOffset: 36 },
      4: { itemH: 52, baseOffset: 62 },
      5: { itemH: 38, baseOffset: 45 }
    };
    const targets = i ? [i] : [1, 2, 3, 4, 5];
    targets.forEach(idx => {
      const cfg = burnerConfigs[idx];
      if (!cfg) return;
      const rollers = getT3Rollers(idx);
      rollers.forEach(roller => {
        roller.classList.remove("is-active", "is-prc-mode", "has-arc", "is-arcing", "is-confirmed");
        const strip = roller.querySelector(".t3-burner-roller-strip");
        if (strip) {
          strip.style.webkitTransform = `translate3d(0, ${cfg.baseOffset}px, 0)`;
          strip.style.transform = `translate3d(0, ${cfg.baseOffset}px, 0)`;
          const items = strip.querySelectorAll(".t3-burner-roller-item");
          items.forEach(it => {
            const itemIdx = parseInt(it.dataset.index, 10);
            it.classList.toggle("is-selected", itemIdx === 0);
          });
        }
      });
    });
  }

  const t3BurnerArcTimers = {
    1: { preArc: null, arc: null, confirm: null, lastConfirmedLevel: null },
    2: { preArc: null, arc: null, confirm: null, lastConfirmedLevel: null },
    3: { preArc: null, arc: null, confirm: null, lastConfirmedLevel: null },
    4: { preArc: null, arc: null, confirm: null, lastConfirmedLevel: null },
    5: { preArc: null, arc: null, confirm: null, lastConfirmedLevel: null }
  };

  function getBurnerCircumference(index) {
    return (index === 4) ? "527.79" : "376.99";
  }

  function getT3Rollers(index) {
    const list = [];
    const r1 = document.getElementById(`t3BurnerRoller${index}`);
    if (r1) list.push(r1);
    const r2 = document.getElementById(`t3StatusBurnerRoller${index}`);
    if (r2) list.push(r2);
    return list;
  }

  function syncAllT3RollersWithKnobs() {
    [1, 2, 3, 4, 5].forEach(i => {
      const k = knobsState[i - 1];
      const angle = k ? k.angle : 0;
      const isCenter = (i === 3);

      if (isCenter) {
        const isCenterOn = (angle >= 25);
        currentT3BurnerLevels[3] = isCenterOn ? "on" : "off";
        const rollers = getT3Rollers(3);
        const targetY = isCenterOn ? 0 : 36;
        rollers.forEach(roller => {
          roller.classList.toggle("is-active", isCenterOn);
          const strip = roller.querySelector(".t3-burner-roller-strip");
          if (strip) {
            strip.style.webkitTransform = `translate3d(0, ${targetY}px, 0)`;
            strip.style.transform = `translate3d(0, ${targetY}px, 0)`;
            const items = strip.querySelectorAll(".t3-burner-roller-item");
            items.forEach(it => {
              const idx = parseInt(it.dataset.index, 10);
              it.classList.toggle("is-selected", idx === (isCenterOn ? 1 : 0));
            });
          }
        });
        return;
      }

      // Standard / Main burners (1, 2, 4, 5)
      const isPRC = (angle < -20 && angle > -80);
      const isMinToMax = (angle >= 20 && angle <= 285);
      const isOff = (Math.abs(angle) <= 12);

      const burnerConfigs = {
        1: { itemH: 38, baseOffset: 45 },
        2: { itemH: 38, baseOffset: 45 },
        4: { itemH: 52, baseOffset: 62 },
        5: { itemH: 38, baseOffset: 45 }
      };
      const cfg = burnerConfigs[i];
      if (!cfg) return;
      const rollers = getT3Rollers(i);

      function updateStrip(itemIndex) {
        const targetY = cfg.baseOffset - itemIndex * cfg.itemH;
        rollers.forEach(roller => {
          const strip = roller.querySelector(".t3-burner-roller-strip");
          if (strip) {
            strip.style.webkitTransform = `translate3d(0, ${targetY}px, 0)`;
            strip.style.transform = `translate3d(0, ${targetY}px, 0)`;
            const items = strip.querySelectorAll(".t3-burner-roller-item");
            items.forEach(it => {
              const idx = parseInt(it.dataset.index, 10);
              it.classList.toggle("is-selected", idx === itemIndex);
            });
          }
        });
      }

      if (isOff) {
        currentT3BurnerLevels[i] = "off";
        updateStrip(0);
        rollers.forEach(r => r.classList.remove("is-active"));
        if (i === 2 && els.tStartActiveBurner1) {
          els.tStartActiveBurner1.hidden = true;
        }
      } else if (isMinToMax) {
        const clamped = Math.max(55, Math.min(270, angle));
        const progress = (clamped - 55) / (270 - 55);
        const level = Math.max(1, Math.min(10, Math.round(1 + progress * 9)));
        currentT3BurnerLevels[i] = level;
        updateStrip(level);
        rollers.forEach(r => r.classList.add("is-active"));
        if (i === 2 && els.tStartActiveBurner1) {
          els.tStartActiveBurner1.hidden = true;
        }
      } else if (isPRC) {
        currentT3BurnerLevels[i] = "prc";
        if (i === 2 && (t3Stage === "burnerStatus" || (t3Stage === "start" && els.tStartActiveBurner1 && !els.tStartActiveBurner1.hidden))) {
          updateStrip(0);
          rollers.forEach(r => r.classList.remove("is-active"));
        } else {
          updateStrip(11);
          rollers.forEach(r => r.classList.add("is-active"));
        }
      }
    });
  }

  function cancelT3BurnerArc(index) {
    const t = t3BurnerArcTimers[index];
    if (t) {
      if (t.preArc) {
        clearTimeout(t.preArc);
        t.preArc = null;
      }
      if (t.arc) {
        clearTimeout(t.arc);
        t.arc = null;
      }
      if (t.confirm) {
        clearTimeout(t.confirm);
        t.confirm = null;
      }
      t.lastConfirmedLevel = null;
    }
    const rollers = getT3Rollers(index);
    const fullCirc = getBurnerCircumference(index);
    rollers.forEach(roller => {
      roller.classList.remove("is-prc-mode", "has-arc", "is-arcing", "is-confirmed");
      const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
      if (arcCircle) {
        arcCircle.style.transition = "none";
        arcCircle.style.strokeDashoffset = fullCirc;
      }
    });
  }

  // Precision Cooking ONLY: 1s delay -> 2s Magenta Arc closing up quicker -> Confirmed active status (white background disc) -> 1s delay -> Spotlight
  function startT3BurnerArc(index, { transitToSpotlight = true } = {}) {
    const t = t3BurnerArcTimers[index];
    if (!t) return;

    if (t.preArc) {
      clearTimeout(t.preArc);
      t.preArc = null;
    }
    if (t.arc) {
      clearTimeout(t.arc);
      t.arc = null;
    }
    if (t.confirm) {
      clearTimeout(t.confirm);
      t.confirm = null;
    }
    t.lastConfirmedLevel = null;

    const rollers = getT3Rollers(index);
    if (!rollers.length) return;

    const fullCirc = getBurnerCircumference(index);

    rollers.forEach(roller => {
      roller.classList.add("is-prc-mode");
      roller.classList.remove("has-arc", "is-arcing", "is-confirmed");
      const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
      if (arcCircle) {
        arcCircle.style.transition = "none";
        arcCircle.style.strokeDashoffset = fullCirc;
        void arcCircle.offsetWidth; // Force CSS reflow
      }
    });

    // 1s delay when knob turns to Precision Cooking position before magenta arc starts to run
    t.preArc = setTimeout(() => {
      t.preArc = null;
      if (currentT3BurnerLevels[index] !== "prc") return;

      // Begin 1s magenta arc animation from 12 o'clock top point
      rollers.forEach(roller => {
        roller.classList.add("has-arc");
        const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
        requestAnimationFrame(() => {
          if (!roller.classList.contains("has-arc")) return;
          roller.classList.add("is-arcing");
          if (arcCircle) {
            arcCircle.style.transition = "stroke-dashoffset 1000ms linear";
            arcCircle.style.strokeDashoffset = "0";
          }
        });
      });

      // Exactly at 1.0s after arc start: arc finishes full circle -> transition to confirmed active state (white background disc with dark thermometer icon)
      t.arc = setTimeout(() => {
        t.arc = null;
        if (currentT3BurnerLevels[index] !== "prc") return;

        rollers.forEach(roller => {
          roller.classList.remove("has-arc", "is-arcing");
          roller.classList.add("is-confirmed");
          const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
          if (arcCircle) {
            arcCircle.style.transition = "none";
            arcCircle.style.strokeDashoffset = fullCirc;
          }
        });
        playSound("toggleOn");

        if (transitToSpotlight) {
          // Confirmed state hold, then screen scroll switch to Temperature screen
          t.confirm = setTimeout(() => {
            t.confirm = null;
            if (currentT3BurnerLevels[index] !== "prc") return;
            transitionToT3Temperature();
          }, 800);
        }
      }, 1000);
    }, 1000);
  }

  // Power Levels 1-10 ONLY: 1s delay then directly go to active status (white background disc) with NO magenta arc
  function startT3BurnerPowerConfirmation(index, level) {
    const t = t3BurnerArcTimers[index];
    if (!t) return;

    if (t.preArc) {
      clearTimeout(t.preArc);
      t.preArc = null;
    }
    if (t.arc) {
      clearTimeout(t.arc);
      t.arc = null;
    }
    if (t.confirm) {
      clearTimeout(t.confirm);
      t.confirm = null;
    }

    const rollers = getT3Rollers(index);
    if (!rollers.length) return;

    // Ensure NO magenta arc or PRC classes are applied
    const fullCirc = getBurnerCircumference(index);
    rollers.forEach(roller => {
      roller.classList.remove("is-prc-mode", "has-arc", "is-arcing");
      const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
      if (arcCircle) {
        arcCircle.style.transition = "none";
        arcCircle.style.strokeDashoffset = fullCirc;
      }
    });

    // 1s quiet delay after knob stops moving at power level 1-10 before going to active status
    t.confirm = setTimeout(() => {
      t.confirm = null;
      if (currentT3BurnerLevels[index] !== level) return;
      rollers.forEach(roller => roller.classList.add("is-confirmed"));
      t.lastConfirmedLevel = level;
      playSound("toggleOn");
      // Stay permanently at this screen, showing confirmed selected number on white background!
    }, 1000);
  }

  // Backwards compatibility aliases
  function startT3Burner1PrcArc() {
    startT3BurnerArc(1, { transitToSpotlight: true });
  }

  function cancelT3Burner1PrcArc() {
    cancelT3BurnerArc(1);
  }

  function clearT3Timers() {
    [1, 2, 3, 4, 5].forEach(i => cancelT3BurnerArc(i));
    [1, 2, 3, 4, 5].forEach(i => {
      if (t3PrcQuietTimers[i]) {
        clearTimeout(t3PrcQuietTimers[i]);
        t3PrcQuietTimers[i] = null;
      }
    });
    if (t3CountdownInterval) {
      clearInterval(t3CountdownInterval);
      t3CountdownInterval = null;
    }
    if (t3HoldingTimeout) {
      clearTimeout(t3HoldingTimeout);
      t3HoldingTimeout = null;
    }
    if (t3PreheatInterval) {
      clearInterval(t3PreheatInterval);
      t3PreheatInterval = null;
    }
    if (t3PancakesPreheatInterval) {
      clearInterval(t3PancakesPreheatInterval);
      t3PancakesPreheatInterval = null;
    }
    if (typeof clearT3GuidedTimers === "function") {
      clearT3GuidedTimers();
    }
    if (els.t3PancakesBurnerTile) {
      els.t3PancakesBurnerTile.classList.remove("is-reached");
    }
    if (typeof hideT3CompleteToast === "function") {
      hideT3CompleteToast();
    }
  }

  function updateFoodBurnerStatusDisplay() {
    if (t3Stage !== "foodBurnerStatus") return;

    const isKnob1Off = !knobsState[0] || Math.abs(knobsState[0].angle) <= 12;
    const isKnob2Off = !knobsState[1] || Math.abs(knobsState[1].angle) <= 12;

    // 1. Front Left (Knob 1)
    if (els.t3FoodBurnerOffFL) {
      els.t3FoodBurnerOffFL.hidden = !isKnob1Off;
    }
    if (els.t3FoodBurnerStatusFLText) {
      els.t3FoodBurnerStatusFLText.style.display = isKnob1Off ? "none" : "flex";
    }
    if (els.t3HotspotFrontLeftBurner) {
      els.t3HotspotFrontLeftBurner.style.pointerEvents = isKnob1Off ? "none" : "auto";
    }

    // 2. Rear Left (Knob 2)
    if (els.t3FoodBurnerOffRL) {
      els.t3FoodBurnerOffRL.hidden = !isKnob2Off;
    }
    if (els.t3FoodBurnerStatusTempDisplay) {
      els.t3FoodBurnerStatusTempDisplay.style.display = isKnob2Off ? "none" : "";
    }
    if (els.t3HotspotRearLeftBurner) {
      els.t3HotspotRearLeftBurner.style.pointerEvents = isKnob2Off ? "none" : "auto";
    }

    // 3. When ALL TWO knobs are turned off:
    // "When all two knob turned off, the activity bar should off as well. When all off back to screen 3-start."
    if (isKnob1Off && isKnob2Off) {
      state.task3Mode = "temp";
      state.task3IsRunning = false;
      currentT3BurnerLevels[1] = "off";
      currentT3BurnerLevels[2] = "off";
      resetT3BurnerToOff(1);
      resetT3BurnerToOff(2);
      activePrcKnobIndex = null;
      if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
      showT3Screen("start");
      return;
    }

    updateCooktopActiveState();
    updateNavbarState();
  }

  function updateT3BurnerFromKnob(index, angle, animate = false) {
    if (state.currentTask !== 3 && state.currentTask !== 2) return;

    const isBurnerStatus = (t3Stage === "burnerStatus");
    const isFoodBurnerStatus = (t3Stage === "foodBurnerStatus");

    // Standard (1, 2, 5) and Main (4) Burners: OFF (0°), PRC (-56°), MIN (55°) to MAX (270°)
    const isPRC = (angle < -20 && angle > -80);
    const isMinToMax = (angle >= 20 && angle <= 285);
    const isOff = (Math.abs(angle) <= 12);

    // On foodBurnerStatus (Figma 2327:15934): Two active burners (Knob 1 Front Left, Knob 2 Rear Left).
    // When turn knob off, screen burner shows off. When all two knobs turn off, activity bar off, back to 3-start.
    if (isFoodBurnerStatus) {
      if (index === 1) {
        if (isOff) {
          currentT3BurnerLevels[1] = "off";
          resetT3BurnerToOff(1);
          playSound("toggleOff");
        } else if (isPRC || isMinToMax) {
          currentT3BurnerLevels[1] = "prc";
        }
      } else if (index === 2) {
        if (isOff) {
          currentT3BurnerLevels[2] = "off";
          resetT3BurnerToOff(2);
          playSound("toggleOff");
        } else if (isPRC || isMinToMax) {
          currentT3BurnerLevels[2] = "prc";
        }
      }
      updateFoodBurnerStatusDisplay();
      if (index === 1 || index === 2) return;
    }

    // On burnerStatus: Rear Left (Knob 2) is running.
    // If user turns Knob 2 to OFF, turn off Rear Left and return to start!
    if (isBurnerStatus && index === 2) {
      if (isOff) {
        currentT3BurnerLevels[2] = "off";
        resetT3BurnerToOff(2);
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        state.task3Mode = "temp";
        state.task3IsRunning = false;
        showT3Screen("start");
        updateCooktopActiveState();
        updateNavbarState();
        playSound("toggleOff");
        return;
      } else if (isPRC) {
        currentT3BurnerLevels[2] = "prc";
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = false;
        updateCooktopActiveState();
        updateNavbarState();
        return;
      }
    }

    const targetIndex = index;
    const burnerConfigs = {
      1: { type: "standard", itemH: 38, baseOffset: 45 },
      2: { type: "standard", itemH: 38, baseOffset: 45 },
      3: { type: "onoff",    itemH: 36, baseOffset: 36 },
      4: { type: "main",     itemH: 52, baseOffset: 62 },
      5: { type: "standard", itemH: 38, baseOffset: 45 }
    };

    const cfg = burnerConfigs[targetIndex];
    if (!cfg) return;
    const { type, itemH, baseOffset } = cfg;

    const rollers = getT3Rollers(targetIndex);
    if (!rollers.length) return;

    function updateRollersStrip(itemIndex) {
      const targetY = baseOffset - itemIndex * itemH;
      rollers.forEach(roller => {
        const strip = roller.querySelector(".t3-burner-roller-strip");
        if (strip) {
          strip.style.webkitTransform = `translate3d(0, ${targetY}px, 0)`;
          strip.style.transform = `translate3d(0, ${targetY}px, 0)`;
          const items = strip.querySelectorAll(".t3-burner-roller-item");
          items.forEach(it => {
            const idx = parseInt(it.dataset.index, 10);
            it.classList.toggle("is-selected", idx === itemIndex);
          });
        }
      });
    }

    if (t3Stage === "pancakesPreheat") {
      if (index === 2) {
        if (isOff) {
          currentT3BurnerLevels[2] = "off";
          resetT3BurnerToOff(2);
          if (els.t3PancakesBurnerOffRL) {
            els.t3PancakesBurnerOffRL.hidden = false;
          }
          if (els.t3PancakesRLTexts) {
            els.t3PancakesRLTexts.hidden = true;
          }
          playSound("toggleOff");

          const isKnob1Off = !knobsState[0] || Math.abs(knobsState[0].angle) <= 12;
          if (isKnob1Off) {
            state.task3Mode = "temp";
            state.task3IsRunning = false;
            activePrcKnobIndex = null;
            if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
            if (els.t3PancakesBurnerTile) els.t3PancakesBurnerTile.classList.remove("is-reached");
            showT3Screen("start");
          }
          updateCooktopActiveState();
          updateNavbarState();
          return;
        } else if (isPRC) {
          currentT3BurnerLevels[2] = "prc";
          if (els.t3PancakesBurnerOffRL) {
            els.t3PancakesBurnerOffRL.hidden = true;
          }
          if (els.t3PancakesRLTexts) {
            els.t3PancakesRLTexts.hidden = false;
          }
          if (els.t3PancakesRLTemp) {
            const rlTemp = t3BurnerTargetTemps[2] || state.task3TargetTemp || 500;
            els.t3PancakesRLTemp.textContent = `${rlTemp}°F`;
          }
          updateCooktopActiveState();
          updateNavbarState();
          return;
        }
      }
    }

    if (t3Stage !== "start" && t3Stage !== "burnerStatus") {
      const activeKnob = activePrcKnobIndex || 1;
      if (index === activeKnob && isOff) {
        if (t3Stage === "guidedCooking") {
          finishGuidedCookingAndTurnOff();
          return;
        }
        if (t3Stage === "pancakesPreheat" || t3Stage === "preheat" || t3Stage === "foodPreheat" || t3Stage === "techniquePreheat") {
          clearT3Timers();
          clearT3GuidedTimers();
          if (t3PancakesPreheatInterval) {
            clearInterval(t3PancakesPreheatInterval);
            t3PancakesPreheatInterval = null;
          }
          state.task3Mode = "temp";
          state.task3IsRunning = false;
          if (state.burners && state.burners[0]) {
            state.burners[0].state = "off";
          }
          currentT3BurnerLevels[index] = "off";
          resetT3BurnerToOff(index);
          setKnobAngle(index, 0, false, false);

          const isRearLeftActive = Boolean(
            knobsState[1] && Math.abs(knobsState[1].angle) > 12 &&
            currentT3BurnerLevels[2] !== "off"
          );

          if (isRearLeftActive) {
            activePrcKnobIndex = 2;
            if (els.tStartActiveBurner1) {
              els.tStartActiveBurner1.hidden = false;
              if (els.tStartBurner1Temp) {
                els.tStartBurner1Temp.textContent = `${t3BurnerTargetTemps[2] || state.task3TargetTemp || 500}°F`;
              }
            }
            if (els.t3PancakesBurnerTile) {
              els.t3PancakesBurnerTile.classList.remove("is-reached");
            }
            showT3Screen("burnerStatus");
          } else {
            activePrcKnobIndex = null;
            if (els.tStartActiveBurner1) {
              els.tStartActiveBurner1.hidden = true;
            }
            if (els.t3PancakesBurnerTile) {
              els.t3PancakesBurnerTile.classList.remove("is-reached");
            }
            showT3Screen("start");
          }
          updateCooktopActiveState();
          updateNavbarState();
          playSound("toggleOff");
          return;
        }
        // If user turns the active knob to OFF while on another Task 3 screen (like Spotlight/Cookware/Pancakes), cancel back to start
        cancelT3A();
        return;
      }
      // If it is NOT the active precision knob turning OFF, allow execution to fall through
      // so other knobs (2, 3, 4, 5) can turn on/off responsively across any sequence!
    }

    // Center Knob 3 (OFF / ON)
    if (type === "onoff") {
      const isCenterOn = (angle >= 25);
      if (isCenterOn) {
        rollers.forEach(r => r.classList.add("is-active"));
        if (currentT3BurnerLevels[3] !== "on") {
          currentT3BurnerLevels[3] = "on";
          playSound("tick");
        }
        updateRollersStrip(1);
      } else {
        currentT3BurnerLevels[3] = "off";
        updateRollersStrip(0);
        rollers.forEach(r => r.classList.remove("is-active"));
      }
      updateCooktopActiveState();
      updateNavbarState();
      return;
    }

    if (isPRC) {
      // 1. Pointing at PRC (-56 deg): dedicated burner shows temperature icon
      rollers.forEach(r => r.classList.add("is-active"));
      const prevLevel = currentT3BurnerLevels[targetIndex];
      if (prevLevel !== "prc") {
        if (typeof prevLevel === "number" && prevLevel < 10) {
          for (let n = prevLevel + 1; n <= 10; n++) {
            playTickSound();
          }
        }
        playTickSound();
        cancelT3BurnerArc(targetIndex);
      }
      currentT3BurnerLevels[targetIndex] = "prc";
      if (t3Stage === "start" || t3Stage === "burnerStatus") {
        activePrcKnobIndex = index;
      }

      // Translate strip to center index 11 (temp icon)
      updateRollersStrip(11);

      if ((targetIndex === 1 || targetIndex === 2 || targetIndex === 4 || targetIndex === 5) && (t3Stage === "start" || t3Stage === "burnerStatus")) {
        if (els.t3ToastCard) {
          els.t3ToastCard.classList.remove("is-visible", "is-dismissing");
          els.t3ToastCard.setAttribute("hidden", "");
        }
        if (typeof hideT3CompleteToast === "function") {
          hideT3CompleteToast();
        }
        const t = t3BurnerArcTimers[targetIndex];
        const isPrcConfirmed = rollers.some(r => r.classList.contains("is-confirmed") && r.classList.contains("is-prc-mode"));
        const isPrcArcRunning = t && (t.preArc || t.arc);
        if (!isPrcConfirmed && !isPrcArcRunning) {
          startT3BurnerArc(targetIndex, { transitToSpotlight: true });
        }
      }
      updateCooktopActiveState();
      updateNavbarState();
    } else if (isMinToMax) {
      // 2. Turning from Min to Max: dedicated burner changes number 1-10 equally divided
      dismissPrcTimerAndToast(targetIndex);

      rollers.forEach(r => r.classList.add("is-active"));

      // Angle: MIN tick is at 55 deg, MAX tick is at 270 deg (arc span = 215 deg)
      const clamped = Math.max(55, Math.min(270, angle));
      const progress = (clamped - 55) / (270 - 55);
      const level = Math.max(1, Math.min(10, Math.round(1 + progress * 9)));

      const prevLevel = currentT3BurnerLevels[targetIndex];
      if (prevLevel === "prc") {
        cancelT3BurnerArc(targetIndex);
      }

      if (level !== prevLevel) {
        // Collect all numbers passed by between prevLevel and new level
        const passedNumbers = [];

        if (prevLevel === "off") {
          // Came clockwise from OFF: entered at level 1 and swept up to level
          for (let n = 1; n <= level; n++) {
            passedNumbers.push(n);
          }
        } else if (prevLevel === "prc") {
          // Came counter-clockwise from PRC: entered at level 10 and swept down to level
          for (let n = 10; n >= level; n--) {
            passedNumbers.push(n);
          }
        } else if (typeof prevLevel === "number") {
          if (level > prevLevel) {
            for (let n = prevLevel + 1; n <= level; n++) {
              passedNumbers.push(n);
            }
          } else if (level < prevLevel) {
            for (let n = prevLevel - 1; n >= level; n--) {
              passedNumbers.push(n);
            }
          }
        } else {
          passedNumbers.push(level);
        }

        currentT3BurnerLevels[targetIndex] = level;

        // Play the selected sound ("touch") for every number passed by
        for (let i = 0; i < passedNumbers.length; i++) {
          playTickSound();
        }
      }

      // Translate strip to center index level
      updateRollersStrip(level);

      // When the knob stops at a power level (levels 1-10):
      // 1s quiet delay after knob stops moving -> directly go to active status (white background disc, dark numeral) with NO magenta arc -> stay at this screen!
      const t = t3BurnerArcTimers[targetIndex];
      if (t) {
        if (rollers[0].classList.contains("is-confirmed") && t.lastConfirmedLevel === level) {
          // Already confirmed at this exact level, do nothing
        } else {
          // Un-confirm if level changed so moving number and gray neighbors are visible while rotating
          rollers.forEach(r => r.classList.remove("is-confirmed"));
          // Start/debounce 1s quiet delay before entering active white status
          startT3BurnerPowerConfirmation(targetIndex, level);
        }
      }
    } else if (isOff) {
      // 3. Knob at OFF (0 deg)
      dismissPrcTimerAndToast(targetIndex);
      cancelT3BurnerArc(targetIndex);
      lastScheduledTickTime = 0;
      const prevLevel = currentT3BurnerLevels[targetIndex];
      if (typeof prevLevel === "number" && prevLevel > 1) {
        for (let n = prevLevel - 1; n >= 1; n--) {
          playTickSound();
        }
      }
      currentT3BurnerLevels[targetIndex] = "off";
      resetT3BurnerToOff(targetIndex);
      if (prevLevel !== "off") {
        playSound("toggleOff");
      }

      // If Knob 2 (Rear Left) turned off, hide its active burner card
      if (targetIndex === 2 && els.tStartActiveBurner1) {
        els.tStartActiveBurner1.hidden = true;
      }

      // Check if all knobs are now off
      const allOff = knobsState.every(k => !k || Math.abs(k.angle) <= 12);
      if (allOff) {
        state.task3Mode = "temp";
        state.task3IsRunning = false;
        activePrcKnobIndex = null;
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        if (t3Stage === "burnerStatus" || t3Stage === "foodBurnerStatus" || t3Stage === "tempRun") {
          showT3Screen("start");
        }
      }

      updateRollersStrip(0);

      rollers.forEach(r => r.classList.remove("is-active"));
      updateCooktopActiveState();
      updateNavbarState();
    } else {
      dismissPrcTimerAndToast(targetIndex);
      cancelT3BurnerArc(targetIndex);
    }
  }

  function showT3PrcToastAndStartCountdown() {
    if (els.t3ToastCard) {
      els.t3ToastCard.removeAttribute("hidden");
      els.t3ToastCard.classList.remove("is-dismissing");
      void els.t3ToastCard.offsetWidth; // Force CSS reflow
      els.t3ToastCard.classList.add("is-visible");
    }

    let seconds = 3;
    if (els.t3ToastNum) {
      els.t3ToastNum.textContent = String(seconds);
    }

    if (t3CountdownInterval) clearInterval(t3CountdownInterval);
    t3CountdownInterval = setInterval(() => {
      seconds--;
      if (seconds >= 1) {
        if (els.t3ToastNum) els.t3ToastNum.textContent = String(seconds);
        playSound("tick");
      } else {
        clearInterval(t3CountdownInterval);
        t3CountdownInterval = null;
      }
    }, 1000);

    if (t3HoldingTimeout) clearTimeout(t3HoldingTimeout);
    t3HoldingTimeout = setTimeout(() => {
      t3HoldingTimeout = null;
      transitionToT3Spotlight();
    }, 3000);
  }

  function dismissPrcTimerAndToast(index) {
    if (index) {
      const roller = document.getElementById(`t3BurnerRoller${index}`);
      if (roller && roller.classList.contains("is-prc-mode")) {
        cancelT3BurnerArc(index);
      }
    } else {
      [1, 2, 4, 5].forEach(i => {
        const roller = document.getElementById(`t3BurnerRoller${i}`);
        if (roller && roller.classList.contains("is-prc-mode")) {
          cancelT3BurnerArc(i);
        }
      });
    }
    if (index && t3PrcQuietTimers[index]) {
      clearTimeout(t3PrcQuietTimers[index]);
      t3PrcQuietTimers[index] = null;
    }
    [1, 2, 3, 4, 5].forEach(i => {
      if (t3PrcQuietTimers[i]) {
        clearTimeout(t3PrcQuietTimers[i]);
        t3PrcQuietTimers[i] = null;
      }
    });

    if (t3CountdownInterval) {
      clearInterval(t3CountdownInterval);
      t3CountdownInterval = null;
    }
    if (t3HoldingTimeout) {
      clearTimeout(t3HoldingTimeout);
      t3HoldingTimeout = null;
    }
    if (els.t3ToastCard) {
      els.t3ToastCard.classList.remove("is-visible");
      els.t3ToastCard.classList.add("is-dismissing");
      setTimeout(() => {
        if (els.t3ToastCard) {
          els.t3ToastCard.classList.remove("is-dismissing");
          els.t3ToastCard.setAttribute("hidden", "");
        }
      }, 250);
    }
  }

  // Bumped whenever the user navigates back; a slide animation that finishes after that must not
  // hide its outgoing screen (it may be the screen the user just went back to).
  let t3NavSeq = 0;

  function slideTransition(outgoingScreen, incomingScreen, direction = "left", onComplete) {
    const navSeq = ++t3NavSeq;
    ensureNavbarVisible();
    if (!outgoingScreen || !incomingScreen) {
      if (incomingScreen) incomingScreen.hidden = false;
      if (outgoingScreen) outgoingScreen.hidden = true;
      ensureNavbarVisible();
      if (onComplete) onComplete();
      return;
    }

    outgoingScreen.hidden = false;
    outgoingScreen.style.transition = "none";
    outgoingScreen.style.webkitTransition = "none";
    outgoingScreen.style.transform = "translate3d(0, 0, 0)";
    outgoingScreen.style.webkitTransform = "translate3d(0, 0, 0)";
    outgoingScreen.style.opacity = "1";
    outgoingScreen.style.zIndex = "100";

    const incomingStart = direction === "left" ? "100%" : "-100%";
    const outgoingEnd = direction === "left" ? "-25%" : "25%";

    incomingScreen.hidden = false;
    incomingScreen.style.transition = "none";
    incomingScreen.style.webkitTransition = "none";
    incomingScreen.style.transform = `translate3d(${incomingStart}, 0, 0)`;
    incomingScreen.style.webkitTransform = `translate3d(${incomingStart}, 0, 0)`;
    incomingScreen.style.boxShadow = direction === "left" ? "-16px 0 40px rgba(0, 0, 0, 0.75)" : "16px 0 40px rgba(0, 0, 0, 0.75)";
    incomingScreen.style.zIndex = "110";

    void incomingScreen.offsetWidth;
    void outgoingScreen.offsetWidth;

    requestAnimationFrame(() => {
      const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
      const dur = "0.45s";

      incomingScreen.style.transition = `transform ${dur} ${ease}`;
      incomingScreen.style.webkitTransition = `-webkit-transform ${dur} ${ease}`;
      incomingScreen.style.transform = "translate3d(0, 0, 0)";
      incomingScreen.style.webkitTransform = "translate3d(0, 0, 0)";

      outgoingScreen.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease`;
      outgoingScreen.style.webkitTransition = `-webkit-transform ${dur} ${ease}, opacity ${dur} ease`;
      outgoingScreen.style.transform = `translate3d(${outgoingEnd}, 0, 0)`;
      outgoingScreen.style.webkitTransform = `translate3d(${outgoingEnd}, 0, 0)`;
      outgoingScreen.style.opacity = "0.4";

      setTimeout(() => {
        const superseded = navSeq !== t3NavSeq;
        if (!superseded) outgoingScreen.hidden = true;
        outgoingScreen.style.transition = "";
        outgoingScreen.style.webkitTransition = "";
        outgoingScreen.style.transform = "";
        outgoingScreen.style.webkitTransform = "";
        outgoingScreen.style.opacity = "";
        incomingScreen.style.transition = "";
        incomingScreen.style.webkitTransition = "";
        incomingScreen.style.transform = "";
        incomingScreen.style.webkitTransform = "";
        ensureNavbarVisible();
        if (onComplete && !superseded) onComplete();
      }, 480);
    });
  }

  function transitionToT3Temperature() {
    clearT3Timers();
    dismissPrcTimerAndToast();

    playSound("toggleOn");

    state.task3Mode = "temp";

    if (state.currentTask === 2) {
      showT2Precision("temperature", "picker");
      return;
    }

    const activeKnob = activePrcKnobIndex || 1;
    state.task3TargetTemp = t3BurnerTargetTemps[activeKnob] || 350;

    const outgoingScreen = (t3Stage === "burnerStatus" && els.t3ScreenBurnerStatus && !els.t3ScreenBurnerStatus.hidden)
      ? els.t3ScreenBurnerStatus
      : els.t3ScreenStart;

    if (els.t3ScreenTemperature && outgoingScreen) {
      t3Stage = "temperature";
      updateScreenBadge("temperature");
      updateCooktopActiveState();

      const drawer = document.getElementById("t3SideDrawerTemp");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "temperature");
        });
      }

      requestAnimationFrame(() => {
        scrollToT3Temp(state.task3TargetTemp || 350, false);
      });

      slideTransition(outgoingScreen, els.t3ScreenTemperature, "left", () => {
        scrollToT3Temp(state.task3TargetTemp || 350, false);
      });
    } else {
      showT3Screen("temperature");
      requestAnimationFrame(() => {
        scrollToT3Temp(state.task3TargetTemp || 350, false);
      });
    }
    if (stage === "selectCookware") {
      const drawer = document.getElementById("t3SideDrawerCookware");
      if (drawer) {
        drawer.querySelectorAll(".pc-drawer-item").forEach(item => {
          item.classList.toggle("is-active", item.dataset.t3tab === "temperature");
        });
      }
      requestAnimationFrame(() => {
        let targetIdx = 1;
        if (state.selectedCookware === "Stainless") targetIdx = 0;
        else if (state.selectedCookware === "Other") targetIdx = 2;
        if (typeof window.scrollToCookwareIndex === "function") {
          window.scrollToCookwareIndex(targetIdx, false);
        }
      });
    }
  }

  // Content-only slide transition between Precision Cooking tabs (Temperature, Food, Technique)
  let isT3ContentTransitioning = false;
  function contentSlideTransition(fromKey, toKey, onComplete = null) {
    if (fromKey === toKey) return;
    if (isT3ContentTransitioning) return;
    isT3ContentTransitioning = true;
    ensureNavbarVisible();

    const tabOrder = {
      temperature: 0,
      digipad: 0,
      tempRun: 0,
      food: 1,
      foodOptions: 1,
      technique: 2,
      recent: 3,
      recentUsed: 3
    };

    const tabDefs = {
      temperature: {
        stage: "temperature",
        screen: els.t3ScreenTemperature,
        getContent: () => [els.t3PickerWheelContainer, els.t3BtnCookwareEdit, els.t3BtnStartTemp, els.t3BtnKeypadFromTemp].filter(Boolean),
        onInit: () => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
        }
      },
      digipad: {
        stage: "digipad",
        screen: els.t3ScreenDigipad,
        getContent: () => [
          document.getElementById("t3DigipadTempDisplay"),
          document.getElementById("t3BtnStartDigipad"),
          document.getElementById("t3BtnPickerFromDigipad"),
          document.getElementById("t3DigipadKeyGrid")
        ].filter(Boolean)
      },
      tempRun: {
        stage: "tempRun",
        screen: els.t3ScreenTempRun,
        getContent: () => [
          document.getElementById("t3RunPickerWheelContainer"),
          document.getElementById("t3BtnUpdateTemp"),
          document.getElementById("t3BtnKeypadTemp")
        ].filter(Boolean)
      },
      food: {
        stage: "foodOptions",
        screen: els.t3ScreenFoodOptions,
        getContent: () => [els.t3FoodScroll].filter(Boolean),
        onInit: () => {
          if (els.t3FoodScroll) els.t3FoodScroll.scrollTop = 0;
        }
      },
      technique: {
        stage: "technique",
        screen: els.t3ScreenTechnique,
        getContent: () => [els.t3TechniqueScroll].filter(Boolean),
        onInit: () => {
          if (els.t3TechniqueScroll) els.t3TechniqueScroll.scrollTop = 0;
        }
      },
      recent: {
        stage: "recentUsed",
        screen: els.t3ScreenRecentUsed,
        getContent: () => [els.t3RecentContainer].filter(Boolean)
      },
      recentUsed: {
        stage: "recentUsed",
        screen: els.t3ScreenRecentUsed,
        getContent: () => [els.t3RecentContainer].filter(Boolean)
      }
    };

    const fromDef = tabDefs[fromKey];
    const toDef = tabDefs[toKey];
    if (!fromDef || !toDef || !fromDef.screen || !toDef.screen || fromDef.screen === toDef.screen) {
      isT3ContentTransitioning = false;
      showT3Screen(toDef ? toDef.stage : toKey);
      if (typeof onComplete === "function") onComplete();
      return;
    }

    t3Stage = toDef.stage;
    updateScreenBadge(t3Stage);
    if (toDef.onInit) toDef.onInit();

    const fromIdx = tabOrder[fromKey] ?? 0;
    const toIdx = tabOrder[toKey] ?? 1;
    const movingLeft = toIdx > fromIdx;
    const outTranslate = movingLeft ? "translateX(-160px)" : "translateX(160px)";
    const inTranslate = movingLeft ? "translateX(160px)" : "translateX(-160px)";

    const outgoingContent = fromDef.getContent();
    const incomingContent = toDef.getContent();

    // Show incoming screen underneath stationary; neither screen container translates!
    toDef.screen.hidden = false;
    toDef.screen.style.transition = "none";
    toDef.screen.style.webkitTransition = "none";
    toDef.screen.style.transform = "none";
    toDef.screen.style.webkitTransform = "none";
    toDef.screen.style.zIndex = "1";

    if (toKey === "temperature" || toDef.stage === "temperature") {
      scrollToT3Temp(state.task3TargetTemp || 350, false);
    }

    fromDef.screen.style.transition = "none";
    fromDef.screen.style.webkitTransition = "none";
    fromDef.screen.style.transform = "none";
    fromDef.screen.style.webkitTransform = "none";
    fromDef.screen.style.zIndex = "2";

    outgoingContent.forEach(el => {
      el.style.transition = "none";
      el.style.webkitTransition = "none";
      el.style.transform = "translateX(0)";
      el.style.webkitTransform = "translateX(0)";
      el.style.opacity = "1";
    });

    incomingContent.forEach(el => {
      el.style.transition = "none";
      el.style.webkitTransition = "none";
      el.style.transform = inTranslate;
      el.style.webkitTransform = inTranslate;
      el.style.opacity = "0";
    });

    const fromBg = fromDef.screen.querySelector(".t3-screen-bg");
    if (fromBg) {
      fromBg.style.transition = "opacity 0.22s ease";
      fromBg.style.webkitTransition = "opacity 0.22s ease";
    }

    // Force reflow
    void toDef.screen.offsetWidth;

    requestAnimationFrame(() => {
      outgoingContent.forEach(el => {
        el.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease";
        el.style.webkitTransition = "-webkit-transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease";
        el.style.transform = outTranslate;
        el.style.webkitTransform = outTranslate;
        el.style.opacity = "0";
      });

      incomingContent.forEach(el => {
        el.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease";
        el.style.webkitTransition = "-webkit-transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease";
        el.style.transform = "translateX(0)";
        el.style.webkitTransform = "translateX(0)";
        el.style.opacity = "1";
      });

      if (fromBg) {
        fromBg.style.opacity = "0";
      }
    });

    setTimeout(() => {
      fromDef.screen.hidden = true;
      fromDef.screen.style.zIndex = "";
      if (fromBg) {
        fromBg.style.transition = "";
        fromBg.style.webkitTransition = "";
        fromBg.style.opacity = "";
      }
      outgoingContent.forEach(el => {
        el.style.transition = "";
        el.style.webkitTransition = "";
        el.style.transform = "";
        el.style.webkitTransform = "";
        el.style.opacity = "";
      });

      toDef.screen.style.zIndex = "";
      incomingContent.forEach(el => {
        el.style.transition = "";
        el.style.webkitTransition = "";
        el.style.transform = "";
        el.style.webkitTransform = "";
        el.style.opacity = "";
      });

      if (toKey === "temperature" || toDef.stage === "temperature") {
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
        });
      }
      isT3ContentTransitioning = false;
      ensureNavbarVisible();
      if (typeof onComplete === "function") onComplete();
    }, 300);
  }

  function transitionToT3FoodOptions(outgoingScreen = null) {
    playSound("touch");

    const currentScreen = outgoingScreen ||
      (els.t3ScreenTemperature && !els.t3ScreenTemperature.hidden ? els.t3ScreenTemperature :
      (els.t3ScreenSelectCookware && !els.t3ScreenSelectCookware.hidden ? els.t3ScreenSelectCookware :
      (els.t3ScreenDigipad && !els.t3ScreenDigipad.hidden ? els.t3ScreenDigipad :
      (els.t3ScreenTempRun && !els.t3ScreenTempRun.hidden ? els.t3ScreenTempRun : null))));

    if (currentScreen) {
      showT3Screen("foodOptions");
      if (els.t3FoodScroll) els.t3FoodScroll.scrollTop = 0;
    } else {
      t3Stage = "foodOptions";
      updateScreenBadge("foodOptions");
      const outScreen = (els.t3ScreenBurnerStatus && !els.t3ScreenBurnerStatus.hidden) ? els.t3ScreenBurnerStatus : els.t3ScreenStart;
      slideTransition(outScreen, els.t3ScreenFoodOptions, "left");
    }
  }

  function transitionToT3BeefMenu() {
    currentFoodSubflow = "beef";
    t3Stage = "beefMenu";
    state.task3Mode = "food";
    updateScreenBadge("beefMenu");
    if (typeof window.__updateBeefMenuUI === "function") window.__updateBeefMenuUI();
    slideTransition(els.t3ScreenFoodOptions, els.t3ScreenBeefMenu, "left");
  }

  // PANCAKES MODE STATE & HELPERS (Figma 3198:22586, 3317:32565, 3299:23383, 3299:23427, 3299:22874)
  let currentFoodSubflow = "beef"; // "beef" | "pancakes"
  let currentPancakeDoneness = "Golden";
  let currentPancakeCookware = "Cast Iron";

  function showT3PancakesView(viewName) {
    if (!els.t3ScreenPancakes) return;
    currentFoodSubflow = "pancakes";

    // 1. Update side drawer 4 tiles: leave drawer static, only toggle .is-active
    const tiles = [
      { el: els.t3TileDoneness, view: "doneness" },
      { el: els.t3TileBurner, view: "burner" },
      { el: els.t3TileTips, view: "tips" },
      { el: els.t3TileCookware, view: "cookware" }
    ];

    tiles.forEach(tile => {
      if (tile.el) {
        if (tile.view === viewName || (tile.view === "tips" && viewName === "ingredients")) {
          tile.el.classList.add("is-active");
          // Safely keep active tile within view in scrollable container
          const container = tile.el.parentElement;
          if (container && container.classList.contains("t3-pancakes-drawer-tiles")) {
            const tileTop = tile.el.offsetTop;
            const tileBottom = tileTop + tile.el.offsetHeight;
            const viewTop = container.scrollTop;
            const viewBottom = viewTop + container.clientHeight;
            if (tileTop < viewTop) {
              container.scrollTo({ top: tileTop, behavior: "smooth" });
            } else if (tileBottom > viewBottom) {
              container.scrollTo({ top: tileBottom - container.clientHeight, behavior: "smooth" });
            }
          }
        } else {
          tile.el.classList.remove("is-active");
        }
      }
    });

    // 2. Switch right pane views
    if (els.t3PancakesViewDoneness) els.t3PancakesViewDoneness.hidden = (viewName !== "doneness");
    if (els.t3PancakesViewBurner) els.t3PancakesViewBurner.hidden = (viewName !== "burner");
    if (els.t3PancakesViewTips) els.t3PancakesViewTips.hidden = (viewName !== "tips" && viewName !== "ingredients");
    if (els.t3PancakesViewCookware) els.t3PancakesViewCookware.hidden = (viewName !== "cookware");

    // Center selected card if view was hidden
    if (viewName === "doneness" && els.t3PancakesDonenessCarousel) {
      requestAnimationFrame(() => {
        const cards = Array.from(els.t3PancakesDonenessCarousel.querySelectorAll(".t3-pancakes-card"));
        const selected = els.t3PancakesDonenessCarousel.querySelector(".t3-pancakes-card.is-selected");
        const idx = selected ? cards.indexOf(selected) : 1;
        if (idx >= 0) {
          els.t3PancakesDonenessCarousel.scrollLeft = idx * 344;
          const dots = Array.from(document.querySelectorAll("#t3PancakesDonenessDots .t3-pancakes-dot"));
          dots.forEach((dot, dotIdx) => {
            dot.classList.toggle("is-active", dotIdx === idx);
          });
        }
      });
    } else if (viewName === "cookware" && els.t3PancakesCookwareCarousel) {
      requestAnimationFrame(() => {
        const cards = Array.from(els.t3PancakesCookwareCarousel.querySelectorAll(".t3-pancakes-card"));
        const selected = els.t3PancakesCookwareCarousel.querySelector(".t3-pancakes-card.is-selected");
        const idx = selected ? cards.indexOf(selected) : 1;
        if (idx >= 0) {
          els.t3PancakesCookwareCarousel.scrollLeft = idx * 344;
          const dots = Array.from(document.querySelectorAll("#t3PancakesCookwareDots .t3-pancakes-dot"));
          dots.forEach((dot, dotIdx) => {
            dot.classList.toggle("is-active", dotIdx === idx);
          });
        }
      });
    }

    // 3. Handle Cooking Tips subpanels (Instructions vs Ingredients)
    if (viewName === "tips" || viewName === "ingredients") {
      const isIngredients = (viewName === "ingredients");
      if (els.t3TipsTabInstructions) {
        els.t3TipsTabInstructions.classList.toggle("is-active", !isIngredients);
        els.t3TipsTabInstructions.setAttribute("aria-selected", !isIngredients ? "true" : "false");
      }
      if (els.t3TipsTabIngredients) {
        els.t3TipsTabIngredients.classList.toggle("is-active", isIngredients);
        els.t3TipsTabIngredients.setAttribute("aria-selected", isIngredients ? "true" : "false");
      }
      if (els.t3TipsPanelInstructions) els.t3TipsPanelInstructions.hidden = isIngredients;
      if (els.t3TipsPanelIngredients) els.t3TipsPanelIngredients.hidden = !isIngredients;
    }

    // 4. Update stage & badge
    let stageKey = "pancakesDoneness";
    if (viewName === "burner") stageKey = "pancakesBurner";
    else if (viewName === "cookware") stageKey = "pancakesCookware";
    else if (viewName === "tips") stageKey = "pancakesTips";
    else if (viewName === "ingredients") stageKey = "pancakesIngredients";

    t3Stage = stageKey;
    updateScreenBadge(stageKey);
    if (els.topStatus) {
      els.topStatus.hidden = false;
    }
    updateCooktopActiveState();
    updateNavbarState();
  }

  function transitionToT3Pancakes(initialView = "doneness") {
    currentFoodSubflow = "pancakes";
    state.task3Mode = "food";
    let subStage = "pancakesDoneness";
    if (initialView === "burner") subStage = "pancakesBurner";
    else if (initialView === "cookware") subStage = "pancakesCookware";
    else if (initialView === "tips") subStage = "pancakesTips";
    else if (initialView === "ingredients") subStage = "pancakesIngredients";

    t3Stage = subStage;
    updateScreenBadge(subStage);
    showT3PancakesView(initialView);
    const drawerScroll = els.t3ScreenPancakes?.querySelector(".t3-pancakes-drawer-tiles");
    if (drawerScroll && initialView === "doneness") {
      drawerScroll.scrollTop = 0;
    }
    if (els.topStatus) {
      els.topStatus.hidden = false;
    }
    updateCooktopActiveState();
    updateNavbarState();
    slideTransition(els.t3ScreenFoodOptions, els.t3ScreenPancakes, "left");
  }

  // PANCAKES PREHEAT (Figma 3299:24045)
  let t3PancakesPreheatInterval = null;
  let lastPancakesStage = "pancakesCookware";

  function startT3PancakesPreheat() {
    clearT3Timers();
    showT3Screen("pancakesPreheat");
    playSound("toggleOn");

    state.task3Mode = "food";
    state.task3IsRunning = true;
    state.task3TargetTemp = 400;

    // In Pancakes Preheating (Figma 3299:24045): Front Left Burner (Knob 1) is active
    if (!knobsState[0] || Math.abs(knobsState[0].angle) <= 5) {
      setKnobAngle(1, -56, false, false);
    }
    currentT3BurnerLevels[1] = "prc";
    activePrcKnobIndex = 1;

    updateCooktopActiveState();
    updateNavbarState();
    updateScreenBadge("pancakesPreheat");

    if (els.t3PancakesBurnerTile) {
      els.t3PancakesBurnerTile.classList.remove("is-reached");
    }

    const startTemp = 178;
    const targetTemp = 400;
    const durationMs = 5000;
    const startTime = Date.now();

    if (els.t3PancakesPreheatTemp) {
      els.t3PancakesPreheatTemp.textContent = `${startTemp}°F`;
    }

    t3PancakesPreheatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = Math.round(startTemp + progress * (targetTemp - startTemp));
      if (els.t3PancakesPreheatTemp) {
        els.t3PancakesPreheatTemp.textContent = `${current}°F`;
      }

      if (progress >= 1.0) {
        clearInterval(t3PancakesPreheatInterval);
        t3PancakesPreheatInterval = null;
        if (els.t3PancakesPreheatTemp) {
          els.t3PancakesPreheatTemp.textContent = `${targetTemp}°F`;
        }
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.add("is-reached");
        }
        playSound("toggleOn");
      }
    }, 50);
  }
  window.startT3PancakesPreheat = startT3PancakesPreheat;

  // ==========================================================================
  // PANCAKES STEP-BY-STEP GUIDED COOKING (FIGMA 3321:34955 & SECTION 3436:25475)
  // ==========================================================================
  let t3GuidedStep = 1;
  let t3GuidedInterval = null;

  function clearT3GuidedTimers() {
    if (t3GuidedInterval) {
      clearInterval(t3GuidedInterval);
      t3GuidedInterval = null;
    }
  }

  let isMouseDragging = false;
  let isSmoothScrolling = false;
  let hasCardDragged = false;
  let cardScrollStartX = 0;
  let cardScrollStartLeft = 0;
  let dragStartStep = 1;
  let cardVelocitySamples = [];
  let cardMomentumRaf = null;

  function cancelCardMomentum() {
    if (cardMomentumRaf) {
      cancelAnimationFrame(cardMomentumRaf);
      cardMomentumRaf = null;
    }
    isSmoothScrolling = false;
  }

  function smoothScrollGuidedViewport(targetLeft, duration = 500, onDone) {
    const vp = els.t3GuidedViewport;
    if (!vp) return;
    cancelCardMomentum();
    const startLeft = vp.scrollLeft;
    const distance = targetLeft - startLeft;
    if (Math.abs(distance) < 0.5) {
      vp.scrollLeft = targetLeft;
      if (onDone) onDone();
      return;
    }

    isSmoothScrolling = true;
    const startTime = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function stepAnim(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);
      vp.scrollLeft = startLeft + distance * ease;

      if (progress < 1) {
        cardMomentumRaf = requestAnimationFrame(stepAnim);
      } else {
        vp.scrollLeft = targetLeft;
        cardMomentumRaf = null;
        isSmoothScrolling = false;
        if (onDone) onDone();
      }
    }
    cardMomentumRaf = requestAnimationFrame(stepAnim);
  }

  function scrollGuidedCardIntoView(step, smooth = true) {
    if (!els.t3GuidedViewport) return;
    const targetScroll = (step <= 1) ? 0 : (step - 1) * 92;
    if (smooth) {
      smoothScrollGuidedViewport(targetScroll, 500);
    } else {
      cancelCardMomentum();
      els.t3GuidedViewport.scrollLeft = targetScroll;
    }
  }

  function setupGuidedCardsScroll() {
    const vp = els.t3GuidedViewport;
    if (!vp) return;

    function getAppScale() {
      const val = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-scale"));
      return isNaN(val) || val <= 0 ? 1 : val;
    }

    function snapToActiveCard(smooth = true) {
      if (!vp) return;
      const targetScroll = (t3GuidedStep <= 1) ? 0 : (t3GuidedStep - 1) * 92;
      if (smooth) {
        smoothScrollGuidedViewport(targetScroll, 500);
      } else {
        cancelCardMomentum();
        vp.scrollLeft = targetScroll;
      }
    }

    function checkAndExpandCenterCard() {
      if (!vp) return;

      // When in step 0 (Preheat)
      if (t3GuidedStep === 0) {
        if (vp.scrollLeft > 46) {
          setGuidedStep(1, false, false);
        }
        return;
      }

      // Steps 1..4: determine target step from scroll position relative to primary action button
      // Step 1 center: 0px (range: < 46px)
      // Step 2 center: 92px (range: 46px .. 138px)
      // Step 3 center: 184px (range: 138px .. 230px)
      // Step 4 center: 276px (range: >= 230px)
      const s = vp.scrollLeft;
      let targetStep = 1;
      if (s < 46) {
        targetStep = 1;
      } else if (s < 138) {
        targetStep = 2;
      } else if (s < 230) {
        targetStep = 3;
      } else {
        targetStep = 4;
      }

      if (targetStep !== t3GuidedStep && targetStep >= 1 && targetStep <= 4) {
        setGuidedStep(targetStep, false, false);
      }
    }

    function onDragStart(clientX) {
      cancelCardMomentum();
      vp.style.scrollBehavior = "auto";
      isMouseDragging = true;
      hasCardDragged = false;
      cardScrollStartX = clientX;
      cardScrollStartLeft = vp.scrollLeft;
      dragStartStep = t3GuidedStep;
      cardVelocitySamples = [{ x: clientX, t: performance.now() }];
    }

    function onDragMove(clientX) {
      if (!isMouseDragging || !vp) return;
      const now = performance.now();
      const diff = clientX - cardScrollStartX;
      const scale = getAppScale();

      if (Math.abs(diff) > 4) {
        hasCardDragged = true;
      }

      // Weight / dampen the drag motion so it feels tactile, steady, and deliberate
      // DRAG_FACTOR = 0.60 means ~150px of finger movement corresponds to ~90px (1 card) of layout scroll
      const DRAG_FACTOR = 0.60;
      const scaledDiff = (diff / scale) * DRAG_FACTOR;

      let newScroll = cardScrollStartLeft - scaledDiff;

      // Single-gesture pagination boundary constraint:
      // Each swipe should only advance or rewind by at most 1 step relative to dragStartStep
      const minAllowedStep = Math.max(1, dragStartStep - 1);
      const maxAllowedStep = Math.min(4, dragStartStep + 1);
      const minAllowedScroll = (minAllowedStep - 1) * 92;
      const maxAllowedScroll = (maxAllowedStep - 1) * 92;

      // Apply soft rubber-banding beyond the 1-step boundaries
      if (newScroll < minAllowedScroll) {
        newScroll = minAllowedScroll + (newScroll - minAllowedScroll) * 0.25;
      } else if (newScroll > maxAllowedScroll) {
        newScroll = maxAllowedScroll + (newScroll - maxAllowedScroll) * 0.25;
      }

      vp.scrollLeft = newScroll;

      cardVelocitySamples.push({ x: clientX, t: now });
      const cutoff = now - 80;
      while (cardVelocitySamples.length > 1 && cardVelocitySamples[0].t < cutoff) {
        cardVelocitySamples.shift();
      }

      checkAndExpandCenterCard();
    }

    function onDragEnd() {
      if (!isMouseDragging || !vp) return;
      isMouseDragging = false;

      if (hasCardDragged) {
        const now = performance.now();
        const cutoff = now - 80;
        while (cardVelocitySamples.length > 1 && cardVelocitySamples[0].t < cutoff) {
          cardVelocitySamples.shift();
        }

        let velocity = 0;
        if (cardVelocitySamples.length >= 2) {
          const first = cardVelocitySamples[0];
          const last = cardVelocitySamples[cardVelocitySamples.length - 1];
          const dt = last.t - first.t;
          if (dt > 8) {
            const scale = getAppScale();
            velocity = -(last.x - first.x) / dt / scale;
          }
        }

        const FLICK_VELOCITY_THRESHOLD = 0.35;
        let targetStep = dragStartStep;

        if (Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD) {
          // Intentional flick gesture: advance or rewind by exactly 1 step
          if (velocity > FLICK_VELOCITY_THRESHOLD) {
            targetStep = Math.min(4, dragStartStep + 1);
          } else {
            targetStep = Math.max(1, dragStartStep - 1);
          }
        } else {
          // Slow drag release: choose the nearest step based on scroll position
          const s = vp.scrollLeft;
          if (s < 46) {
            targetStep = 1;
          } else if (s < 138) {
            targetStep = 2;
          } else if (s < 230) {
            targetStep = 3;
          } else {
            targetStep = 4;
          }
          // Clamp targetStep to 1 step relative to dragStartStep
          targetStep = Math.max(Math.max(1, dragStartStep - 1), Math.min(Math.min(4, dragStartStep + 1), targetStep));
        }

        // Apply target step and smooth scroll glide
        clearT3GuidedTimers();
        setGuidedStep(targetStep, false, true);

        setTimeout(() => {
          hasCardDragged = false;
        }, 120);
      } else {
        // If no drag occurred (tap), snap neatly
        snapToActiveCard(true);
      }
    }

    // Scroll listener for trackpad / native wheel scrolling
    let scrollSettleTimer = null;
    vp.addEventListener("scroll", () => {
      if (isMouseDragging || isSmoothScrolling) return;
      checkAndExpandCenterCard();
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(() => {
        if (!isMouseDragging && !isSmoothScrolling) {
          snapToActiveCard(true);
        }
      }, 120);
    }, { passive: true });

    // Mouse drag events
    vp.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("#t3GuidedStartTimer2") || e.target.closest("#t3GuidedStartTimer3")) return;
      onDragStart(e.clientX);
    });

    window.addEventListener("mousemove", (e) => {
      if (isMouseDragging) {
        onDragMove(e.clientX);
      }
    });

    window.addEventListener("mouseup", () => {
      if (isMouseDragging) {
        onDragEnd();
      }
    });

    // Native Touch drag events for iPad Pro
    vp.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length === 1) {
        if (e.target.closest("#t3GuidedStartTimer2") || e.target.closest("#t3GuidedStartTimer3")) return;
        onDragStart(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (isMouseDragging && e.touches && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      if (isMouseDragging) {
        onDragEnd();
      }
    });

    window.addEventListener("touchcancel", () => {
      if (isMouseDragging) {
        onDragEnd();
      }
    });
  }

  function setGuidedStep(step, isRunning = false, shouldScroll = true) {
    t3GuidedStep = step;
    if (els.t3GuidedTrack) {
      els.t3GuidedTrack.setAttribute("data-step", String(step));
    }

    const cards = [
      { el: els.t3GuidedCardPreheat, step: 0 },
      { el: els.t3GuidedCard1, step: 1 },
      { el: els.t3GuidedCard2, step: 2 },
      { el: els.t3GuidedCard3, step: 3 },
      { el: els.t3GuidedCard4, step: 4 }
    ];

    cards.forEach(({ el, step: s }) => {
      if (el) {
        if (s === step) {
          el.classList.add("is-active");
        } else {
          el.classList.remove("is-active");
        }
      }
    });

    if (shouldScroll) {
      scrollGuidedCardIntoView(step, true);
    }

    // Step 0: Preheating
    if (els.t3GuidedBtnPreheating) {
      els.t3GuidedBtnPreheating.hidden = (step !== 0);
    }

    // Step 2: Pour batter (inside-card timer & text)
    if (els.t3GuidedTimer2 && els.t3GuidedStartTimer2 && els.t3GuidedCard2Text) {
      if (step === 2 && isRunning) {
        els.t3GuidedTimer2.hidden = false;
        els.t3GuidedStartTimer2.hidden = true;
        els.t3GuidedCard2Text.textContent = "Pour batter. Cook for 3 mins.";
      } else {
        els.t3GuidedTimer2.hidden = true;
        els.t3GuidedStartTimer2.hidden = false;
        els.t3GuidedCard2Text.textContent = "Pour batter. Cook for 3 mins. Then press “Next”.";
        if (els.t3GuidedTimerFill2) els.t3GuidedTimerFill2.style.width = "0%";
        if (els.t3GuidedTimerVal2) els.t3GuidedTimerVal2.textContent = "2:59:00";
      }
    }

    // Step 3: Flip pancake (inside-card timer & text)
    if (els.t3GuidedTimer3 && els.t3GuidedStartTimer3 && els.t3GuidedCard3Text) {
      if (step === 3 && isRunning) {
        els.t3GuidedTimer3.hidden = false;
        els.t3GuidedStartTimer3.hidden = true;
        els.t3GuidedCard3Text.textContent = "Flip pancake. Cook for 1 minute.";
      } else {
        els.t3GuidedTimer3.hidden = true;
        els.t3GuidedStartTimer3.hidden = false;
        els.t3GuidedCard3Text.textContent = "Flip pancake. Cook for 1 minute. Then press “Next”.";
        if (els.t3GuidedTimerFill3) els.t3GuidedTimerFill3.style.width = "0%";
        if (els.t3GuidedTimerVal3) els.t3GuidedTimerVal3.textContent = "0:59:00";
      }
    }

    // Next button: visible on steps 1, 2 (when not running), 3 (when not running)
    const showNext = (step === 1) || (step === 2 && !isRunning) || (step === 3 && !isRunning);
    if (els.t3GuidedBtnNext) els.t3GuidedBtnNext.hidden = !showNext;

    // Cooking button: visible on steps 2 & 3 when running
    const showCooking = (step === 2 || step === 3) && isRunning;
    if (els.t3GuidedBtnCooking) els.t3GuidedBtnCooking.hidden = !showCooking;

    // Step 4 buttons
    if (els.t3GuidedStep4Btns) els.t3GuidedStep4Btns.hidden = (step !== 4);

    // Modals hidden when switching steps
    if (els.t3GuidedDoneModal) els.t3GuidedDoneModal.hidden = true;
    if (els.t3GuidedNextModal) els.t3GuidedNextModal.hidden = true;

    updateScreenBadge("guidedCooking");
  }

  function startGuidedCooking(initialStep = 1) {
    clearT3GuidedTimers();
    if (t3PancakesPreheatInterval) {
      clearInterval(t3PancakesPreheatInterval);
      t3PancakesPreheatInterval = null;
    }
    showT3Screen("guidedCooking");
    setGuidedStep(initialStep, false);
    playSound("touch");

    if (initialStep === 0) {
      startGuidedPreheat();
    }
  }

  function startGuidedPreheat() {
    clearT3GuidedTimers();
    setGuidedStep(0, true);
    playSound("toggleOn");

    const durationMs = 3500;
    const startTime = Date.now();

    t3GuidedInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      if (els.t3GuidedPreheatFill) {
        els.t3GuidedPreheatFill.style.width = `${(progress * 100).toFixed(1)}%`;
      }

      if (progress >= 1.0) {
        clearT3GuidedTimers();
        playSound("toggleOn");
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.add("is-reached");
        }
        if (els.t3PancakesPreheatTemp) {
          els.t3PancakesPreheatTemp.textContent = "400°F";
        }
        setGuidedStep(1, false);
      }
    }, 40);
  }

  function startGuidedTimer(step) {
    clearT3GuidedTimers();
    setGuidedStep(step, true);
    playSound("touch");

    const totalSeconds = (step === 2) ? 179 : 59; // Step 2: 3 min (2:59), Step 3: 1 min (0:59)
    const durationMs = (step === 2) ? 4500 : 3500; // prototype speed
    const startTime = Date.now();

    t3GuidedInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const remainingSec = Math.max(0, Math.ceil(totalSeconds * (1.0 - progress)));

      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const valStr = `${mins}:${String(secs).padStart(2, "0")}:00`;

      if (step === 2) {
        if (els.t3GuidedTimerFill2) els.t3GuidedTimerFill2.style.width = `${(progress * 100).toFixed(1)}%`;
        if (els.t3GuidedTimerVal2) els.t3GuidedTimerVal2.textContent = valStr;
      } else if (step === 3) {
        if (els.t3GuidedTimerFill3) els.t3GuidedTimerFill3.style.width = `${(progress * 100).toFixed(1)}%`;
        if (els.t3GuidedTimerVal3) els.t3GuidedTimerVal3.textContent = valStr;
      }

      if (progress >= 1.0) {
        clearT3GuidedTimers();
        playTimerNotificationSound();
        setGuidedStep(step, false);
      }
    }, 50);
  }

  function exitGuidedCooking() {
    clearT3GuidedTimers();
    showT3Screen("pancakesPreheat");
    playSound("touch");
    if (els.t3PancakesBurnerTile) {
      els.t3PancakesBurnerTile.classList.add("is-reached");
    }
    if (els.t3PancakesPreheatTemp) {
      els.t3PancakesPreheatTemp.textContent = "400°F";
    }
  }

  let isFinishingGuided = false;
  function finishGuidedCookingAndTurnOff() {
    if (isFinishingGuided) return;
    isFinishingGuided = true;
    try {
      clearT3GuidedTimers();
      clearT3Timers();
      if (els.t3GuidedDoneModal) {
        els.t3GuidedDoneModal.hidden = true;
      }
      if (els.t3GuidedNextModal) {
        els.t3GuidedNextModal.hidden = true;
      }
      state.task3Mode = "temp";
      state.task3IsRunning = false;
      const knobToReset = activePrcKnobIndex || 1;
      setKnobAngle(knobToReset, 0, false, false);
      currentT3BurnerLevels[knobToReset] = "off";
      resetT3BurnerToOff(knobToReset);

      const isRearLeftActive = Boolean(
        knobsState[1] && Math.abs(knobsState[1].angle) > 12 &&
        currentT3BurnerLevels[2] !== "off"
      );

      if (isRearLeftActive) {
        activePrcKnobIndex = 2;
        if (els.tStartActiveBurner1) {
          els.tStartActiveBurner1.hidden = false;
          if (els.tStartBurner1Temp) {
            els.tStartBurner1Temp.textContent = `${t3BurnerTargetTemps[2] || state.task3TargetTemp || 500}°F`;
          }
        }
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.remove("is-reached");
        }
        showT3Screen("burnerStatus");
      } else {
        activePrcKnobIndex = null;
        if (els.tStartActiveBurner1) {
          els.tStartActiveBurner1.hidden = true;
        }
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.remove("is-reached");
        }
        showT3Screen("start");
      }
      updateCooktopActiveState();
      updateNavbarState();
      playSound("toggleOff");
    } finally {
      isFinishingGuided = false;
    }
  }

  window.startGuidedCooking = startGuidedCooking;
  window.setGuidedStep = setGuidedStep;
  window.exitGuidedCooking = exitGuidedCooking;
  window.finishGuidedCookingAndTurnOff = finishGuidedCookingAndTurnOff;
  window.startGuidedPreheat = startGuidedPreheat;
  window.startGuidedTimer = startGuidedTimer;

  function transitionToT3Spotlight() {
    transitionToT3Temperature();
  }

  function startT3ACountdown() {
    transitionToT3Temperature();
  }

  let t3ToastCompleteTimeout = null;

  function hideT3CompleteToast() {
    if (t3ToastCompleteTimeout) {
      clearTimeout(t3ToastCompleteTimeout);
      t3ToastCompleteTimeout = null;
    }
    if (els.t3ToastComplete) {
      els.t3ToastComplete.classList.remove("is-visible");
    }
  }

  function showT3CompleteToast() {
    if (t3ToastCompleteTimeout) {
      clearTimeout(t3ToastCompleteTimeout);
      t3ToastCompleteTimeout = null;
    }
    if (els.t3ToastComplete) {
      els.t3ToastComplete.classList.add("is-visible");
      // Toast stays for 10s as specified in user prompt
      t3ToastCompleteTimeout = setTimeout(() => {
        hideT3CompleteToast();
      }, 10000);
    }
  }

  let digipadInput = "350";
  let digipadIsFresh = true;
  let digipadSourceScreen = "temperature";

  function openT3Digipad(source = "temperature") {
    digipadSourceScreen = source;
    digipadInput = String(state.task3TargetTemp || 350);
    digipadIsFresh = true;
    if (els.t3DigipadTempNum) {
      els.t3DigipadTempNum.textContent = digipadInput;
    }
    showT3Screen("digipad");
  }

  function closeT3DigipadToPicker() {
    let temp = parseInt(digipadInput, 10);
    if (isNaN(temp) || temp < T3_TEMP_MIN) temp = 350;
    if (temp > T3_TEMP_MAX) temp = 500;
    temp = Math.round(temp / T3_TEMP_STEP) * T3_TEMP_STEP;
    state.task3TargetTemp = temp;
    t3BurnerTargetTemps[digipadSourceScreen === "tempRun" ? 2 : (activePrcKnobIndex || 1)] = temp;
    if (digipadSourceScreen === "tempRun") {
      showT3Screen("tempRun");
      requestAnimationFrame(() => {
        scrollToT3RunTemp(temp, false);
      });
    } else {
      showT3Screen("temperature");
      requestAnimationFrame(() => {
        scrollToT3Temp(temp, false);
      });
    }
  }

  function handleDigipadKey(key) {
    playSound("touch");
    if (key === "clear") {
      digipadInput = "";
      digipadIsFresh = false;
      if (els.t3DigipadTempNum) els.t3DigipadTempNum.textContent = "--";
      return;
    }
    if (key === "backspace") {
      digipadIsFresh = false;
      if (digipadInput.length > 0) {
        digipadInput = digipadInput.slice(0, -1);
      }
      if (els.t3DigipadTempNum) {
        els.t3DigipadTempNum.textContent = digipadInput || "--";
      }
      if (digipadInput) {
        state.task3TargetTemp = parseInt(digipadInput, 10);
        t3BurnerTargetTemps[activePrcKnobIndex || 1] = state.task3TargetTemp;
      }
      return;
    }
    // Digit 0-9
    if (digipadIsFresh) {
      digipadInput = key;
      digipadIsFresh = false;
    } else {
      if (digipadInput.length < 3) {
        digipadInput += key;
      }
    }
    if (els.t3DigipadTempNum) {
      els.t3DigipadTempNum.textContent = digipadInput;
    }
    const val = parseInt(digipadInput, 10);
    if (!isNaN(val)) {
      state.task3TargetTemp = val;
      t3BurnerTargetTemps[activePrcKnobIndex || 1] = val;
    }
  }

  // TASK 3B: PREHEAT DIRECTLY ON BURNER STATUS (FIGMA 2310:12162 & 3051:42542 & 3051:42525)
  function startT3Preheat() {
    state.task3IsRunning = true;
    clearT3Timers();
    hideT3CompleteToast();
    showT3Screen("burnerStatus");
    playSound("toggleOn");

    const targetTemp = t3BurnerTargetTemps[activePrcKnobIndex || 2] || state.task3TargetTemp || 350;
    const startTemp = 178; // Exact starting number from Figma 2310:12162
    const durationMs = 4000; // 4s smooth temperature growth
    const startTime = Date.now();

    // Reset burner label tile to preheating state
    if (els.t3BurnerTextTile) {
      els.t3BurnerTextTile.classList.remove("is-complete");
    }
    if (els.t3TileTargetText) {
      els.t3TileTargetText.textContent = `Preheat to ${targetTemp}°F`;
      els.t3TileTargetText.style.display = "";
    }
    if (els.t3TileLiveTemp) {
      els.t3TileLiveTemp.textContent = `${startTemp}°F`;
    }

    t3PreheatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = Math.round(startTemp + progress * (targetTemp - startTemp));
      if (els.t3TileLiveTemp) {
        els.t3TileLiveTemp.textContent = `${current}°F`;
      }

      if (progress >= 1.0) {
        clearInterval(t3PreheatInterval);
        t3PreheatInterval = null;
        if (els.t3TileLiveTemp) {
          els.t3TileLiveTemp.textContent = `${targetTemp}°F`;
        }
        if (els.t3BurnerStatusTemp) {
          els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
        }
        if (els.tStartBurner1Temp) {
          els.tStartBurner1Temp.textContent = `${targetTemp}°F`;
        }

        // 1-second delay when temp reaches target temp before changing to two row text card!
        t3HoldingTimeout = setTimeout(() => {
          t3HoldingTimeout = null;
          // 1. Label text changes to two row text card (Figma 3051:42542, hide preheat to line)
          if (els.t3BurnerTextTile) {
            els.t3BurnerTextTile.classList.add("is-complete");
          }
          // 2. Play completion chime
          playSound("toggleOn");
          // 3. Preheat complete toast pops up from bottom and stays for 10s (Figma 3051:42525)
          showT3CompleteToast();
        }, 1000);
      }
    }, 50);
  }

  function startT3PreheatCompleted() {
    clearT3Timers();
    showT3Screen("burnerStatus");
    playSound("toggleOn");
    const targetTemp = t3BurnerTargetTemps[activePrcKnobIndex || 2] || state.task3TargetTemp || 350;
    if (els.t3TileLiveTemp) {
      els.t3TileLiveTemp.textContent = `${targetTemp}°F`;
    }
    if (els.t3BurnerStatusTemp) {
      els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
    }
    if (els.tStartBurner1Temp) {
      els.tStartBurner1Temp.textContent = `${targetTemp}°F`;
    }
    if (els.t3BurnerTextTile) {
      els.t3BurnerTextTile.classList.add("is-complete");
    }
    showT3CompleteToast();
  }

  function finishT3PreheatToBurnerStatus() {
    hideT3CompleteToast();
    showT3Screen("burnerStatus");
    playSound("touch");
  }

  // TASK 3C: FOOD RECIPE PREHEAT AND COMPLETION TIMERS
  function startT3FoodPreheat(overrideTarget) {
    clearT3Timers();
    showT3Screen("foodPreheat");
    playSound("toggleOn");

    const targetTemp = overrideTarget || (state.task3Mode === "food" && t3Stage && t3Stage.startsWith("pancakes") ? 400 : 375);
    const startTemp = 182;
    const durationMs = 5000; // 5s smooth temperature growth
    const startTime = Date.now();

    if (els.t3FoodPreheatCurrent) {
      els.t3FoodPreheatCurrent.textContent = startTemp;
    }

    t3PreheatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = Math.round(startTemp + progress * (targetTemp - startTemp));
      if (els.t3FoodPreheatCurrent) {
        els.t3FoodPreheatCurrent.textContent = current;
      }

      if (progress >= 1.0) {
        clearInterval(t3PreheatInterval);
        t3PreheatInterval = null;
        if (els.t3FoodPreheatCurrent) {
          els.t3FoodPreheatCurrent.textContent = targetTemp;
        }

        // 2s holding delay before completion screen
        t3HoldingTimeout = setTimeout(() => {
          startT3FoodPreheatCompleted();
        }, 2000);
      }
    }, 50);
  }

  function startT3FoodPreheatCompleted() {
    clearT3Timers();
    showT3Screen("foodComplete");
    playSound("toggleOn");

    // Pop up preheat complete toast with spring animation!
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (t3Stage === "foodComplete" && els.t3ToastPreheatComplete) {
            els.t3ToastPreheatComplete.classList.add("is-visible");
          }
        }, 50);
      });
    }

    // Auto-advance to foodBurnerStatus after 4s (or user clicks OK or ✕)
    t3HoldingTimeout = setTimeout(() => {
      finishT3FoodPreheatToBurnerStatus();
    }, 4000);
  }

  function finishT3FoodPreheatToBurnerStatus() {
    clearT3Timers();
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
      setTimeout(() => {
        showT3Screen("foodBurnerStatus");
      }, 250);
    } else {
      showT3Screen("foodBurnerStatus");
    }
    playSound("touch");

    const targetTemp = state.task3TargetTemp || 350;
    if (els.t3FoodBurnerStatusTemp1) {
      els.t3FoodBurnerStatusTemp1.textContent = `${targetTemp}°F`;
    }
  }

  // TASK 3C: TECHNIQUE PREHEAT AND COMPLETION TIMERS
  function startT3TechniquePreheat(techName = "Caramelize") {
    clearT3Timers();
    showT3Screen("techniquePreheat");
    playSound("toggleOn");

    const targetTemp = 375;
    const startTemp = 182;
    const durationMs = 4000;
    const startTime = Date.now();

    if (els.t3TechPreheatCurrent) {
      els.t3TechPreheatCurrent.textContent = startTemp;
    }

    t3PreheatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = Math.round(startTemp + progress * (targetTemp - startTemp));
      if (els.t3TechPreheatCurrent) {
        els.t3TechPreheatCurrent.textContent = current;
      }

      if (progress >= 1.0) {
        clearInterval(t3PreheatInterval);
        t3PreheatInterval = null;
        if (els.t3TechPreheatCurrent) {
          els.t3TechPreheatCurrent.textContent = targetTemp;
        }

        // 1.5s holding delay before completion screen
        t3HoldingTimeout = setTimeout(() => {
          startT3TechniquePreheatCompleted();
        }, 1500);
      }
    }, 50);
  }

  function startT3TechniquePreheatCompleted() {
    clearT3Timers();
    showT3Screen("techniqueComplete");
    playSound("toggleOn");

    // Pop up preheat complete toast with spring animation!
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (t3Stage === "techniqueComplete" && els.t3ToastPreheatComplete) {
            els.t3ToastPreheatComplete.classList.add("is-visible");
          }
        }, 50);
      });
    }

    // Toast remains visible until user taps OK or ✕, or interacts with the cooktop
  }

  function finishT3TechniqueToBurnerStatus() {
    clearT3Timers();
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.add("is-dismissing");
    }
    playSound("touch");
  }

  // Where the Rear Left temperature editor (tempRun) returns to: null = Burner Status (default),
  // "pancakesPreheat" when it was opened from the Pancakes running screen's Rear Left tag.
  var tempRunReturnStage = null; // var: also read by showT3Screen, which can run before this line
  function returnFromTempRunToPancakes(applyNewTemp) {
    tempRunReturnStage = null;
    if (applyNewTemp) {
      t3BurnerTargetTemps[2] = state.task3TargetTemp || t3BurnerTargetTemps[2] || 500;
      playSound("toggleOn");
    }
    state.task3TargetTemp = 400; // Pancakes target
    activePrcKnobIndex = 1;
    showT3Screen("pancakesPreheat"); // refreshes the 500°F (new) Rear Left text
    if (!t3PancakesPreheatInterval && els.t3PancakesBurnerTile) {
      els.t3PancakesBurnerTile.classList.add("is-reached");
      if (els.t3PancakesPreheatTemp) els.t3PancakesPreheatTemp.textContent = "400°F";
    }
    updateCooktopActiveState();
    updateNavbarState();
  }

  // turnOffBurner = true  -> knob turned to OFF: reset burner + knob, slide back to Burners.
  // turnOffBurner = false -> on-screen Back / side-nav buttons: only navigate back to Burners.
  //   Only the physical knobs may turn a burner off, so the knob and burner state are kept.
  function cancelT3A(turnOffBurner = true) {
    t3NavSeq++;
    clearT3Timers();
    dismissPrcTimerAndToast();
    ensureNavbarVisible();
    const knobToReset = activePrcKnobIndex || 1;

    const candidateScreens = [
      els.t3ScreenTemperature,
      els.t3ScreenSelectCookware,
      els.t3ScreenSpotlight,
      els.t3ScreenBeefMenu,
      els.t3ScreenBeefType,
      els.t3ScreenBeefDoneness,
      els.t3ScreenBeefThickness,
      els.t3ScreenPancakes,
      els.t3ScreenPancakesPreheat,
      els.t3ScreenFoodOptions,
      els.t3ScreenRecentUsed,
      els.t3ScreenTechnique,
      els.t3ScreenDigipad,
      els.t3ScreenPreheat,
      els.t3ScreenTempRun
    ];
    const activeScreen = candidateScreens.find(s => s && !s.hidden);

    if (turnOffBurner) {
      currentT3BurnerLevels[knobToReset] = "off";
      resetT3BurnerToOff(knobToReset);
      setKnobAngle(knobToReset, 0, false, false);
    }

    const isRearLeftActive = Boolean(
      (knobsState[1] && knobsState[1].angle < -20 && knobsState[1].angle > -80) ||
      currentT3BurnerLevels[2] === "prc" ||
      (els.tStartActiveBurner1 && !els.tStartActiveBurner1.hidden)
    );
    const targetScreen = (isRearLeftActive && els.t3ScreenBurnerStatus) ? els.t3ScreenBurnerStatus : els.t3ScreenStart;
    const targetStage = targetScreen === els.t3ScreenBurnerStatus ? "burnerStatus" : "start";

    if (isRearLeftActive) {
      activePrcKnobIndex = 2;
    } else if (turnOffBurner) {
      activePrcKnobIndex = null;
    }

    if (activeScreen && targetScreen && activeScreen !== targetScreen) {
      t3Stage = targetStage;
      updateScreenBadge(targetStage);
      updateCooktopActiveState();

      // 1. Prepare target screen positioned slightly to the left (-25%) with opacity 0.4
      targetScreen.hidden = false;
      targetScreen.style.transition = "none";
      targetScreen.style.webkitTransition = "none";
      targetScreen.style.transform = "translate3d(-25%, 0, 0)";
      targetScreen.style.webkitTransform = "translate3d(-25%, 0, 0)";
      targetScreen.style.opacity = "0.4";
      targetScreen.style.zIndex = "100";

      // 2. Active screen is visible at (0, 0, 0)
      activeScreen.hidden = false;
      activeScreen.style.transition = "none";
      activeScreen.style.webkitTransition = "none";
      activeScreen.style.transform = "translate3d(0, 0, 0)";
      activeScreen.style.webkitTransform = "translate3d(0, 0, 0)";
      activeScreen.style.zIndex = "110";

      void activeScreen.offsetWidth;
      void targetScreen.offsetWidth;

      requestAnimationFrame(() => {
        const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
        const dur = "0.40s";

        activeScreen.style.transition = `transform ${dur} ${ease}`;
        activeScreen.style.webkitTransition = `-webkit-transform ${dur} ${ease}`;
        activeScreen.style.transform = "translate3d(100%, 0, 0)";
        activeScreen.style.webkitTransform = "translate3d(100%, 0, 0)";

        targetScreen.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease`;
        targetScreen.style.webkitTransition = `-webkit-transform ${dur} ${ease}, opacity ${dur} ease`;
        targetScreen.style.transform = "translate3d(0, 0, 0)";
        targetScreen.style.webkitTransform = "translate3d(0, 0, 0)";
        targetScreen.style.opacity = "1";

        setTimeout(() => {
          showT3Screen(targetStage);
          ensureNavbarVisible();
          activeScreen.style.transition = "";
          activeScreen.style.webkitTransition = "";
          activeScreen.style.transform = "";
          activeScreen.style.webkitTransform = "";
          targetScreen.style.transition = "";
          targetScreen.style.webkitTransition = "";
          targetScreen.style.transform = "";
          targetScreen.style.webkitTransform = "";
          updateCooktopActiveState();
          updateNavbarState();
        }, 430);
      });
    } else {
      showT3Screen(targetStage);
      updateCooktopActiveState();
      updateNavbarState();
    }
    if (turnOffBurner) playSound("toggleOff");
  }

  // TASK 3: HORIZONTAL TEMPERATURE CAROUSEL PICKER
  const T3_TEMP_MIN = 200;
  const T3_TEMP_MAX = 500;
  const T3_TEMP_STEP = 25;

  function initT3PickerWheel() {
    if (!els.t3PickerTrack) return;
    els.t3PickerTrack.innerHTML = "";

    for (let t = T3_TEMP_MIN; t <= T3_TEMP_MAX; t += T3_TEMP_STEP) {
      const item = document.createElement("div");
      item.className = "t3-picker-item";
      item.dataset.temp = String(t);
      item.innerHTML = `<span class="t3-item-num">${t}</span><span class="t3-item-unit">°F</span>`;
      item.addEventListener("click", () => {
        scrollToT3Temp(t, true);
      });
      els.t3PickerTrack.appendChild(item);
    }

    let rafId = null;
    els.t3PickerTrack.addEventListener("scroll", () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateT3PickerVisuals();
      });
    }, { passive: true });

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    els.t3PickerTrack.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - els.t3PickerTrack.offsetLeft;
      scrollLeft = els.t3PickerTrack.scrollLeft;
      els.t3PickerTrack.style.scrollSnapType = "none";
    });
    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        els.t3PickerTrack.style.scrollSnapType = "x mandatory";
        snapToClosestT3Temp();
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - els.t3PickerTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      els.t3PickerTrack.scrollLeft = scrollLeft - walk;
    });

    els.t3PickerTrack.addEventListener("touchend", () => {
      setTimeout(snapToClosestT3Temp, 80);
    }, { passive: true });

    setTimeout(() => {
      scrollToT3Temp(state.task3TargetTemp || 350, false);
    }, 60);
  }

  let lastT3TickTemp = null;
  function updateT3PickerVisuals() {
    if (!els.t3PickerTrack || els.t3PickerTrack.offsetParent === null || els.t3PickerTrack.clientWidth === 0) return;
    const trackWidth = els.t3PickerTrack.clientWidth || 493;
    const trackCenter = els.t3PickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t3PickerTrack.querySelectorAll(".t3-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      // Dist threshold with 160px items (Figma 3198:27479):
      // Active item: dist < 80
      // Single immediate neighbor on each side (e.g. 350 and 400): 80 <= dist < 240
      // Any further numbers (325, 300, 425, 450): dist >= 240 -> strictly hidden (opacity 0)
      if (dist >= 80 && dist < 240) {
        item.classList.add("is-neighbor-1");
      }
    });

    if (closestItem) {
      closestItem.classList.remove("is-neighbor-1");
      closestItem.classList.add("is-active");
      const tempVal = parseInt(closestItem.dataset.temp, 10);
      if (tempVal !== state.task3TargetTemp) {
        state.task3TargetTemp = tempVal;
        t3BurnerTargetTemps[activePrcKnobIndex || 1] = tempVal;
        if (tempVal !== lastT3TickTemp) {
          lastT3TickTemp = tempVal;
          playSound("touch");
        }
      }
    }
  }

  function snapToClosestT3Temp() {
    if (!els.t3PickerTrack) return;
    const trackWidth = els.t3PickerTrack.clientWidth || 493;
    const trackCenter = els.t3PickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t3PickerTrack.querySelectorAll(".t3-picker-item");
    let closestTemp = 350;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestTemp = parseInt(item.dataset.temp, 10);
      }
    });

    scrollToT3Temp(closestTemp, true);
  }

  function scrollToT3Temp(temp, smooth = true) {
    if (!els.t3PickerTrack) return;
    const index = Math.round((temp - T3_TEMP_MIN) / T3_TEMP_STEP);
    const targetScrollLeft = index * 160;
    els.t3PickerTrack.scrollLeft = targetScrollLeft;
    els.t3PickerTrack.scrollTo({
      left: targetScrollLeft,
      behavior: smooth ? "smooth" : "auto"
    });
    state.task3TargetTemp = temp;
    t3BurnerTargetTemps[activePrcKnobIndex || 1] = temp;
    updateT3PickerVisuals();
    setTimeout(updateT3PickerVisuals, smooth ? 250 : 50);
  }

  // TASK 3: PCTEMPERATURERUN HORIZONTAL TEMPERATURE CAROUSEL PICKER
  function initT3RunPickerWheel() {
    if (!els.t3RunPickerTrack) return;
    els.t3RunPickerTrack.innerHTML = "";

    for (let t = T3_TEMP_MIN; t <= T3_TEMP_MAX; t += T3_TEMP_STEP) {
      const item = document.createElement("div");
      item.className = "t3-picker-item";
      item.dataset.temp = String(t);
      item.innerHTML = `<span class="t3-item-num">${t}</span><span class="t3-item-unit">°F</span>`;
      item.addEventListener("click", () => {
        scrollToT3RunTemp(t, true);
      });
      els.t3RunPickerTrack.appendChild(item);
    }

    let rafId = null;
    els.t3RunPickerTrack.addEventListener("scroll", () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateT3RunPickerVisuals();
      });
    }, { passive: true });

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    els.t3RunPickerTrack.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - els.t3RunPickerTrack.offsetLeft;
      scrollLeft = els.t3RunPickerTrack.scrollLeft;
      els.t3RunPickerTrack.style.scrollSnapType = "none";
    });
    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        els.t3RunPickerTrack.style.scrollSnapType = "x mandatory";
        snapToClosestT3RunTemp();
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - els.t3RunPickerTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      els.t3RunPickerTrack.scrollLeft = scrollLeft - walk;
    });

    els.t3RunPickerTrack.addEventListener("touchend", () => {
      setTimeout(snapToClosestT3RunTemp, 80);
    }, { passive: true });
  }

  let lastT3RunTickTemp = null;
  function updateT3RunPickerVisuals() {
    if (!els.t3RunPickerTrack || els.t3RunPickerTrack.offsetParent === null || els.t3RunPickerTrack.clientWidth === 0) return;
    const trackWidth = els.t3RunPickerTrack.clientWidth || 493;
    const trackCenter = els.t3RunPickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t3RunPickerTrack.querySelectorAll(".t3-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      // Dist threshold with 160px items (Figma 3198:27479 / 3298:17543):
      // Active item: dist < 80
      // Single immediate neighbor on each side (e.g. 350 and 400): 80 <= dist < 240
      // Any further numbers: dist >= 240 -> strictly hidden (opacity 0)
      if (dist >= 80 && dist < 240) {
        item.classList.add("is-neighbor-1");
      }
    });

    if (closestItem) {
      closestItem.classList.remove("is-neighbor-1");
      closestItem.classList.add("is-active");
      const tempVal = parseInt(closestItem.dataset.temp, 10);
      if (tempVal !== state.task3TargetTemp) {
        state.task3TargetTemp = tempVal;
        if (tempVal !== lastT3RunTickTemp) {
          lastT3RunTickTemp = tempVal;
          playSound("touch");
        }
      }
    }
  }

  function snapToClosestT3RunTemp() {
    if (!els.t3RunPickerTrack) return;
    const trackWidth = els.t3RunPickerTrack.clientWidth || 493;
    const trackCenter = els.t3RunPickerTrack.scrollLeft + (trackWidth / 2);
    const items = els.t3RunPickerTrack.querySelectorAll(".t3-picker-item");
    let closestTemp = 350;
    let closestDist = Infinity;

    items.forEach((item, idx) => {
      const paddingLeft = (trackWidth - 160) / 2;
      const itemCenter = (item.offsetLeft > 0)
        ? (item.offsetLeft + (item.offsetWidth / 2))
        : (paddingLeft + idx * 160 + 80);
      const dist = Math.abs(itemCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestTemp = parseInt(item.dataset.temp, 10);
      }
    });

    scrollToT3RunTemp(closestTemp, true);
  }

  function scrollToT3RunTemp(temp, smooth = true) {
    if (!els.t3RunPickerTrack) return;
    const index = Math.round((temp - T3_TEMP_MIN) / T3_TEMP_STEP);
    const targetScrollLeft = index * 160;
    els.t3RunPickerTrack.scrollLeft = targetScrollLeft;
    els.t3RunPickerTrack.scrollTo({
      left: targetScrollLeft,
      behavior: smooth ? "smooth" : "auto"
    });
    state.task3TargetTemp = temp;
    t3BurnerTargetTemps[activePrcKnobIndex || 2] = temp;
    updateT3RunPickerVisuals();
    setTimeout(updateT3RunPickerVisuals, smooth ? 250 : 50);
  }

  window.scrollToT3Temp = scrollToT3Temp;
  window.scrollToT3RunTemp = scrollToT3RunTemp;

  // ==============================================
  // TASK 3: COOKTOP KNOBS MANIFOLD & ROTATABLE DIALS
  // ==============================================
  function setKnobAngle(index, angle, animate = false, updateBurner = true) {
    const k = knobsState[index - 1];
    if (!k) return;
    k.angle = angle;
    const dial = document.getElementById(`knobDial${index}`);
    const light = document.getElementById(`knobLight${index}`);
    const target = document.getElementById(`knobTarget${index}`);

    if (dial) {
      if (animate) dial.classList.add("is-animating");
      dial.style.setProperty("--knob-angle", `${angle}deg`);
      dial.style.webkitTransform = `rotate(${angle}deg) translateZ(0)`;
      dial.style.transform = `rotate(${angle}deg) translateZ(0)`;
      if (animate) setTimeout(() => dial.classList.remove("is-animating"), 260);
    }

    const isOn = Math.abs(angle) > 5;
    if (k.isOn !== isOn) {
      k.isOn = isOn;
      if (light) light.classList.toggle("is-on", isOn);

      if (updateBurner && k.burner && state.burners[k.burner]) {
        if (!isOn) {
          state.burners[k.burner].state = "off";
          state.burners[k.burner].label = "OFF";
          renderBurnerState(k.burner);
        } else {
          // If turned towards PRC (-56 deg)
          if (angle < -20 && angle > -80) {
            state.burners[k.burner].state = "precision";
            if (!state.burners[k.burner].temp && !state.burners[k.burner].mode) {
              state.burners[k.burner].temp = 350;
              state.burners[k.burner].label = "350°F";
            }
            renderBurnerState(k.burner);
          }
        }
      }
    }

    updateCooktopActiveState();

    // TASK 2 & TASK 3 PRECISION COOKING WORKFLOW TRIGGER
    if (updateBurner && (state.currentTask === 3 || state.currentTask === 2)) {
      updateT3BurnerFromKnob(index, angle, animate);
      updateCooktopActiveState();
    }

    if (target) {
      target.setAttribute("aria-valuenow", Math.round(angle));
    }
  }
  window.setKnobAngle = setKnobAngle;
  window.showT3Screen = showT3Screen;

  function setupKnobsListeners() {
    knobsState.forEach((k, idx) => {
      const index = idx + 1;
      const target = document.getElementById(`knobTarget${index}`);
      const dial = document.getElementById(`knobDial${index}`);
      if (!target || !dial) return;

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let hasMoved = false;

      target.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        target.setPointerCapture(e.pointerId);
        resetTickQueue();
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        target.classList.add("is-dragging");
        dial.classList.remove("is-animating");
      });

      target.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const distFromStart = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (distFromStart > 4) hasMoved = true;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        // Angle from 12 o'clock (-dy = up, dx = right)
        const rawDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
        const cwDeg = (rawDeg + 360) % 360;

        let deg = 0;

        // Center Knob (Index 3) - Only OFF (0) and ON (45)
        if (index === 3) {
          if (cwDeg >= 15 && cwDeg <= 120) {
            deg = 45;
          } else {
            deg = 0;
          }
        } else {
          // Knobs 1, 2, 4, 5: OFF (0°), PRC (-56° / 304°), MIN (55°), MAX (270°)
          if (cwDeg <= 15 || cwDeg >= 348) {
            // Dead center OFF (12 o'clock)
            deg = 0;
          } else if (cwDeg >= 280 && cwDeg < 348) {
            // PRC zone (~10 o'clock, 304 deg)
            // Allow turning directly into PRC from either direction without getting locked at MAX!
            deg = -56;
          } else {
            // Power zone (15° to 280°): rolls through MIN (55°) to MAX (270°)
            deg = Math.max(55, Math.min(270, cwDeg));
          }
        }

        setKnobAngle(index, deg, false, true);
      });

      const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        target.classList.remove("is-dragging");
        try { target.releasePointerCapture(e.pointerId); } catch(err) {}

        // If clicked without moving, toggle between OFF (0 deg) and PRC (-56 deg)
        // Center knob (index 3) toggles between OFF (0 deg) and ON (+45 deg)
        if (!hasMoved) {
          playSound("touch");
          const isOff = Math.abs(k.angle) <= 5;
          const targetDeg = isOff ? (index === 3 ? 45 : -56) : 0;
          setKnobAngle(index, targetDeg, true, true);
        } else {
          // Snap to nearest detent on release
          let snapDeg = k.angle;
          if (index === 3) {
            snapDeg = snapDeg > 20 ? 45 : 0;
          } else {
            if (snapDeg === -56 || snapDeg < -20 || (snapDeg >= 280 && snapDeg < 348)) {
              snapDeg = -56;
            } else if (Math.abs(snapDeg) <= 15 || snapDeg >= 348) {
              snapDeg = 0;
            } else {
              // Snap to nearest discrete 1-10 level angle (55° to 270°)
              const clamped = Math.max(55, Math.min(270, snapDeg));
              const progress = (clamped - 55) / (270 - 55);
              const level = Math.max(1, Math.min(10, Math.round(1 + progress * 9)));
              snapDeg = 55 + (level - 1) * ((270 - 55) / 9);
            }
          }
          playSound("touch");
          setKnobAngle(index, snapDeg, true, true);
        }
      };

      target.addEventListener("pointerup", endDrag);
      target.addEventListener("pointercancel", endDrag);

      // Keyboard accessibility
      target.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          playSound("touch");
          const isOff = Math.abs(k.angle) <= 5;
          const targetDeg = isOff ? (index === 3 ? 45 : -56) : 0;
          setKnobAngle(index, targetDeg, true, true);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          playSound("touch");
          if (index === 3) {
            setKnobAngle(index, 0, true, true);
          } else {
            if (k.angle === -56) {
              // From PRC, turning left continues to Level 10 (270°)
              setKnobAngle(index, 270, true, true);
            } else if (k.angle <= 0) {
              // From OFF, turning left goes to PRC (-56°)
              setKnobAngle(index, -56, true, true);
            } else if (k.angle <= 55) {
              // From MIN, turning left goes to OFF (0°)
              setKnobAngle(index, 0, true, true);
            } else {
              const clamped = Math.max(55, Math.min(270, k.angle));
              const progress = (clamped - 55) / (270 - 55);
              const level = Math.max(1, Math.round(1 + progress * 9) - 1);
              if (level === 1 && k.angle <= 55) {
                setKnobAngle(index, 0, true, true);
              } else {
                const prevDeg = 55 + (level - 1) * ((270 - 55) / 9);
                setKnobAngle(index, prevDeg, true, true);
              }
            }
          }
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          playSound("touch");
          if (index === 3) {
            setKnobAngle(index, 45, true, true);
          } else {
            if (k.angle === -56) {
              // From PRC, turning right goes to OFF (0°)
              setKnobAngle(index, 0, true, true);
            } else if (k.angle <= 0) {
              // From OFF, turning right goes to MIN (55° / level 1)
              setKnobAngle(index, 55, true, true);
            } else {
              const clamped = Math.max(55, Math.min(270, k.angle));
              const progress = (clamped - 55) / (270 - 55);
              const currentLevel = Math.round(1 + progress * 9);
              if (currentLevel >= 10) {
                // At Level 10 / MAX, turning right continues to PRC (-56°)!
                setKnobAngle(index, -56, true, true);
              } else {
                const nextLevel = currentLevel + 1;
                const nextDeg = 55 + (nextLevel - 1) * ((270 - 55) / 9);
                setKnobAngle(index, nextDeg, true, true);
              }
            }
          }
        }
      });
    });
  }

  // EVENT LISTENERS
  function setupListeners() {
    // Researcher Task Switchers
    els.btnTask1.addEventListener("click", () => setTask(1));
    els.btnTask2.addEventListener("click", () => setTask(2));
    els.btnTask3.addEventListener("click", () => setTask(3));

    // Setup Cooktop Knobs Listeners
    setupKnobsListeners();

    // Task 1 Glance Flash triggers (0.5s / 1s / 2s)
    document.querySelectorAll("#glanceControls .glance-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const dur = btn.dataset.duration;
        if (dur === "toggle") {
          togglePreview();
        } else {
          flashGlance(parseInt(dur, 10));
        }
      });
    });

    // TASK 2 EVENT LISTENERS
    if (els.t2BtnExplore) {
      els.t2BtnExplore.addEventListener("click", () => showT2Precision("temperature"));
    }
    if (els.t2BtnBack) {
      els.t2BtnBack.addEventListener("click", () => showT2Explore());
    }

    // Task 2 Tab Bar & Side Drawer Navigation
    let lastT2TabTime = 0;
    const bindT2TabBtn = (btn) => {
      const tabTarget = btn.dataset.t2tab;
      if (!tabTarget) return;

      const triggerTab = (e) => {
        if (e) {
          if (e.type === "touchstart" || e.type === "pointerdown") {
            e.preventDefault();
          }
          e.stopPropagation();
        }
        btn.classList.add("is-active-press");
        setTimeout(() => btn.classList.remove("is-active-press"), 150);
        const now = Date.now();
        if (now - lastT2TabTime < 200) return;
        lastT2TabTime = now;
        playSound("touch");
        setT2Tab(tabTarget);
      };

      btn.addEventListener("click", triggerTab);
      btn.addEventListener("touchstart", triggerTab, { passive: false });
      btn.addEventListener("pointerdown", triggerTab);
    };
    document.querySelectorAll(".t2-tab-btn, .pc-drawer-item[data-t2tab]").forEach(bindT2TabBtn);

    // Cookware tabs (Stainless Steel / Cast Iron / Other / Info - Figma 3198:27479)
    document.querySelectorAll(".pc-cookware-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        const parent = tab.closest(".pc-cookware-tabs");
        if (parent) {
          parent.querySelectorAll(".pc-cookware-tab").forEach(t => t.classList.remove("is-active"));
        }
        tab.classList.add("is-active");
      });
    });

    const t2CookwareInfo = document.getElementById("t2CookwareInfo");
    if (t2CookwareInfo) {
      t2CookwareInfo.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }
    const t3CookwareInfo = document.getElementById("t3CookwareInfo");
    if (t3CookwareInfo) {
      t3CookwareInfo.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }

    // Task 2 Temperature Mode Switchers
    if (els.t2BtnToDigipad) {
      els.t2BtnToDigipad.addEventListener("click", () => setT2TempMode("digipad"));
    }
    if (els.t2BtnToPicker) {
      els.t2BtnToPicker.addEventListener("click", () => setT2TempMode("picker"));
    }

    // Task 2 Start Buttons
    if (els.t2PickerStartBtn) {
      els.t2PickerStartBtn.addEventListener("click", () => playSound("toggleOn"));
    }
    if (els.t2DigipadStartBtn) {
      els.t2DigipadStartBtn.addEventListener("click", () => {
        playSound("toggleOn");
        if (state.task2.digipadBuffer && state.task2.digipadBuffer !== "---") {
          let val = parseInt(state.task2.digipadBuffer, 10);
          if (!isNaN(val)) {
            val = Math.max(T2_TEMP_MIN, Math.min(T2_TEMP_MAX, val));
            val = Math.round(val / T2_TEMP_STEP) * T2_TEMP_STEP;
            state.task2.temperature = val;
            state.task2.digipadBuffer = String(val);
            if (els.t2DigipadValue) els.t2DigipadValue.textContent = state.task2.digipadBuffer;
          }
        }
      });
    }

    // Initialize Task 2 Dynamic Horizontal Temperature Picker Wheel
    initT2PickerWheel();

    // Task 2 Digipad Keypad Keys
    document.querySelectorAll(".t2-key-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        handleDigipadInput(btn.dataset.key);
      });
    });

    // Task 2 Spotlight Interactive Cards
    document.querySelectorAll(".t2-hotspot").forEach(btn => {
      btn.addEventListener("click", () => {
        playSound("touch");
      });
    });

    // Option Tiles Click / Selection (Task 2 & Task 3)
    document.querySelectorAll(".buttontile").forEach(tile => {
      tile.addEventListener("click", () => {
        playSound("touch");
        const parentGrid = tile.closest(".t2-tiles-grid, .t3-tiles-grid");
        if (parentGrid) {
          parentGrid.querySelectorAll(".buttontile").forEach(t => t.classList.remove("is-selected"));
        }
        tile.classList.add("is-selected");

        // If inside Task 3 Food Grid
        if (tile.closest("#t3FoodScroll")) {
          setTimeout(() => {
            showT3Screen("beefType");
          }, 250);
        }
        // If inside Task 3 Technique Grid
        else if (tile.closest("#t3TechniqueScroll")) {
          const tech = tile.dataset.technique || tile.querySelector(".buttontile-title, .text")?.textContent?.trim() || "Caramelize";
          setTimeout(() => {
            startT3TechniquePreheat(tech);
          }, 250);
        }
      });
    });

    // ==============================================
    // TASK 3A: PRECISION COOKING FLOW LISTENERS
    // ==============================================
    // Screen burners are display-only indicators (press & start on screen burner disabled).
    // All burner activation, deactivation, and setting levels are operated exclusively via the knobs.

    // Toast Actions: X button immediately advances to Precision Cooking without 3s countdown
    if (els.t3ToastClose) {
      els.t3ToastClose.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        transitionToT3Spotlight();
      });
    }
    if (els.t3ToastDismiss) {
      els.t3ToastDismiss.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        transitionToT3Spotlight();
      });
    }

    // Back button (< Cooktop) on Spotlight screen
    if (els.t3BtnBack) {
      els.t3BtnBack.addEventListener("click", () => {
        playSound("touch");
        cancelT3A(false);
      });
    }

    // Interactive hotspots on Spotlight screen (Steak, Bacon, Beef)
    [els.t3SpotlightSteak, els.t3SpotlightBacon, els.t3SpotlightBeef].forEach(btn => {
      if (btn) {
        btn.addEventListener("click", () => {
          playSound("touch");
        });
      }
    });

    // ==============================================
    // TASK 3B: TEMPERATURE & PREHEAT LISTENERS
    // ==============================================

    // Initialize Task 3 Horizontal Temperature Carousel & PCTemperatureRun Carousel
    initT3PickerWheel();
    initT3RunPickerWheel();

    // Temperature Screen: Back button (< Precision Cooking) -> slides back to Burners
    if (els.t3BtnBackFromTemp) {
      els.t3BtnBackFromTemp.addEventListener("click", () => {
        playSound("touch");
        cancelT3A(false);
      });
    }

    // Temperature Screen: Keypad switcher button
    if (els.t3BtnKeypadFromTemp) {
      els.t3BtnKeypadFromTemp.addEventListener("click", () => {
        playSound("touch");
        openT3Digipad();
      });
    }

    // Digipad Screen: Back button (< Precision Cooking) -> slides back to Burners or tempRun
    if (els.t3BtnBackFromDigipad) {
      els.t3BtnBackFromDigipad.addEventListener("click", () => {
        playSound("touch");
        if (digipadSourceScreen === "tempRun") {
          showT3Screen("tempRun");
          requestAnimationFrame(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          });
        } else {
          cancelT3A(false);
        }
      });
    }

    // Digipad Screen: Picker toggle button (switches back to temp carousel)
    if (els.t3BtnPickerFromDigipad) {
      els.t3BtnPickerFromDigipad.addEventListener("click", () => {
        playSound("touch");
        closeT3DigipadToPicker();
      });
    }

    // Digipad Screen: Tabs
    if (els.t3TabBtnTempFromDigi) {
      els.t3TabBtnTempFromDigi.addEventListener("click", () => {
        playSound("touch");
        closeT3DigipadToPicker();
      });
    }
    if (els.t3TabBtnFoodFromDigi) {
      els.t3TabBtnFoodFromDigi.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("foodOptions");
      });
    }
    if (els.t3TabBtnTechFromDigi) {
      els.t3TabBtnTechFromDigi.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("technique");
      });
    }

    // Digipad Screen: 3x4 Number Keys
    if (els.t3DigipadKeyGrid) {
      els.t3DigipadKeyGrid.querySelectorAll(".t3-digi-key").forEach(k => {
        k.addEventListener("click", (e) => {
          e.stopPropagation();
          handleDigipadKey(k.dataset.key);
        });
      });
    }

    // Digipad Screen: START button
    if (els.t3BtnStartDigipad) {
      let lastStartTimeDigi = 0;
      const handleStartDigi = (e) => {
        if (e) e.preventDefault();
        const now = Date.now();
        if (now - lastStartTimeDigi < 400) return;
        lastStartTimeDigi = now;
        let temp = parseInt(digipadInput, 10);
        if (isNaN(temp) || temp < 100) temp = 350;
        state.task3TargetTemp = temp;
        t3BurnerTargetTemps[activePrcKnobIndex || 1] = temp;
        startT3Preheat();
      };
      els.t3BtnStartDigipad.addEventListener("click", handleStartDigi);
      els.t3BtnStartDigipad.addEventListener("touchstart", handleStartDigi, { passive: false });
    }

    // Temperature Screen: START button -> Triggers Activity Bar & Preheating!
    if (els.t3BtnStartTemp) {
      let lastStartTime = 0;
      const handleStart = (e) => {
        if (e) e.preventDefault();
        const now = Date.now();
        if (now - lastStartTime < 400) return;
        lastStartTime = now;
        startT3Preheat();
      };
      els.t3BtnStartTemp.addEventListener("click", handleStart);
      els.t3BtnStartTemp.addEventListener("touchstart", handleStart, { passive: false });
    }

    // Cookware Selection Carousel Setup (Figma 3407:25065 & 3409:25225)
    const cookwareViewport = els.t3CookwareCarouselViewport;
    const cookwareCards = [
      { el: els.t3CardStainless, name: "Stainless Steel", shortName: "Stainless", index: 0 },
      { el: els.t3CardCastIron, name: "Cast Iron", shortName: "Cast Iron", index: 1 },
      { el: els.t3CardOther, name: "Other", shortName: "Other", index: 2 }
    ];
    const cookwareDots = els.t3CookwarePagination ? Array.from(els.t3CookwarePagination.querySelectorAll(".t3-cookware-dot")) : [];

    const CARD_STEP = 284; // 260px card width + 24px gap
    let isCookwareDragging = false;
    let cookwareStartX = 0;
    let cookwareScrollStart = 0;
    let cookwareHasDragged = false;
    let cookwareScrollRaf = null;
    let cookwareMomentumRaf = null;
    let cookwareVelocitySamples = [];

    function stopCookwareMomentum() {
      if (cookwareMomentumRaf) {
        cancelAnimationFrame(cookwareMomentumRaf);
        cookwareMomentumRaf = null;
      }
    }

    function updateCookwareUI(activeIndex) {
      activeIndex = Math.max(0, Math.min(cookwareCards.length - 1, activeIndex));
      const targetCard = cookwareCards[activeIndex];
      if (targetCard) {
        state.selectedCookware = targetCard.shortName;
      }
      cookwareCards.forEach((c, idx) => {
        if (c.el) c.el.classList.toggle("is-active", idx === activeIndex);
      });
      cookwareDots.forEach((dot, idx) => {
        dot.classList.toggle("is-active", idx === activeIndex);
      });
    }

    function scrollToCookwareIndex(index, smooth = true) {
      if (!cookwareViewport) return;
      stopCookwareMomentum();
      index = Math.max(0, Math.min(cookwareCards.length - 1, index));
      updateCookwareUI(index);
      cookwareViewport.scrollTo({
        left: index * CARD_STEP,
        behavior: smooth ? "smooth" : "auto"
      });
    }
    window.scrollToCookwareIndex = scrollToCookwareIndex;

    if (cookwareViewport) {
      const onCookwareStart = (clientX) => {
        stopCookwareMomentum();
        isCookwareDragging = true;
        cookwareHasDragged = false;
        cookwareStartX = clientX;
        cookwareScrollStart = cookwareViewport.scrollLeft;
        cookwareVelocitySamples = [{ x: clientX, t: performance.now() }];
      };

      const onCookwareMove = (clientX) => {
        if (!isCookwareDragging) return;
        const now = performance.now();
        const diff = clientX - cookwareStartX;
        if (Math.abs(diff) > 5) {
          cookwareHasDragged = true;
        }
        cookwareViewport.scrollLeft = cookwareScrollStart - diff;
        cookwareVelocitySamples.push({ x: clientX, t: now });

        // Keep only velocity samples from the last 80ms
        const cutoff = now - 80;
        while (cookwareVelocitySamples.length > 1 && cookwareVelocitySamples[0].t < cutoff) {
          cookwareVelocitySamples.shift();
        }
      };

      const onCookwareEnd = () => {
        if (!isCookwareDragging) return;
        isCookwareDragging = false;

        if (cookwareHasDragged) {
          // Calculate release velocity in scrollLeft space (-dx / dt)
          const now = performance.now();
          const cutoff = now - 80;
          while (cookwareVelocitySamples.length > 1 && cookwareVelocitySamples[0].t < cutoff) {
            cookwareVelocitySamples.shift();
          }

          let velocity = 0;
          if (cookwareVelocitySamples.length >= 2) {
            const first = cookwareVelocitySamples[0];
            const last = cookwareVelocitySamples[cookwareVelocitySamples.length - 1];
            const dt = last.t - first.t;
            if (dt > 8) {
              velocity = -(last.x - first.x) / dt; // px/ms
            }
          }

          // Cap maximum velocity for natural feel
          const MAX_VELOCITY = 2.4;
          velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));

          // If flicked with sufficient velocity, glide smoothly with momentum
          if (Math.abs(velocity) > 0.08) {
            let lastTime = performance.now();
            const friction = 0.94; // Deceleration rate per frame

            const momentumStep = (currentTime) => {
              const dt = Math.min(32, Math.max(8, currentTime - lastTime));
              lastTime = currentTime;

              const decay = Math.pow(friction, dt / 16.67);
              velocity *= decay;

              cookwareViewport.scrollLeft += velocity * dt;

              const maxScroll = cookwareViewport.scrollWidth - cookwareViewport.clientWidth;
              if (cookwareViewport.scrollLeft <= 0) {
                cookwareViewport.scrollLeft = 0;
                velocity = 0;
              } else if (cookwareViewport.scrollLeft >= maxScroll) {
                cookwareViewport.scrollLeft = maxScroll;
                velocity = 0;
              }

              if (Math.abs(velocity) > 0.015) {
                cookwareMomentumRaf = requestAnimationFrame(momentumStep);
              } else {
                cookwareMomentumRaf = null;
                // Natural stop at ANY point without snapping
              }
            };

            cookwareMomentumRaf = requestAnimationFrame(momentumStep);
          }

          // Reset drag flag after short delay so click event doesn't trigger card selection
          setTimeout(() => {
            cookwareHasDragged = false;
          }, 80);
        }
      };

      // Mouse drag event listeners
      cookwareViewport.addEventListener("mousedown", (e) => {
        onCookwareStart(e.clientX);
      });
      window.addEventListener("mousemove", (e) => {
        onCookwareMove(e.clientX);
      });
      window.addEventListener("mouseup", () => {
        onCookwareEnd();
      });

      // Touch drag event listeners
      cookwareViewport.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches.length > 0) {
          onCookwareStart(e.touches[0].clientX);
        }
      }, { passive: true });

      cookwareViewport.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches.length > 0) {
          const clientX = e.touches[0].clientX;
          if (Math.abs(clientX - cookwareStartX) > 5 && e.cancelable) {
            e.preventDefault();
          }
          onCookwareMove(clientX);
        }
      }, { passive: false });

      cookwareViewport.addEventListener("touchend", () => {
        onCookwareEnd();
      }, { passive: true });
      cookwareViewport.addEventListener("touchcancel", () => {
        onCookwareEnd();
      }, { passive: true });

      // Live scroll listener for active card & pagination indicator
      cookwareViewport.addEventListener("scroll", () => {
        if (cookwareScrollRaf) cancelAnimationFrame(cookwareScrollRaf);
        cookwareScrollRaf = requestAnimationFrame(() => {
          const activeIdx = Math.round(cookwareViewport.scrollLeft / CARD_STEP);
          updateCookwareUI(activeIdx);
        });
      }, { passive: true });
    }

    // Card tap to center and select
    cookwareCards.forEach(({ el, index, shortName }) => {
      if (!el) return;
      const onCardClick = (e) => {
        if (cookwareHasDragged) return;
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        playSound("touch");
        scrollToCookwareIndex(index, true);
      };
      el.addEventListener("click", onCardClick);
    });

    // Pagination dots tap to navigate
    cookwareDots.forEach((dot, idx) => {
      const onDotClick = (e) => {
        e.stopPropagation();
        playSound("touch");
        scrollToCookwareIndex(idx, true);
      };
      dot.addEventListener("click", onDotClick);
    });

    let isCookwareTransitioning = false;

    transitionTemperatureToCookware = function() {
      if (isCookwareTransitioning) return;
      isCookwareTransitioning = true;
      playSound("touch");

      t3Stage = "selectCookware";
      updateScreenBadge("selectCookware");

      let targetIdx = 1; // Default to Cast Iron as in Figma 3407:25065
      if (state.selectedCookware === "Stainless") targetIdx = 0;
      else if (state.selectedCookware === "Other") targetIdx = 2;

      // Both screens remain strictly static at translate3d(0, 0, 0) - NO whole-screen slide!
      if (els.t3ScreenTemperature) {
        els.t3ScreenTemperature.style.transition = "none";
        els.t3ScreenTemperature.style.webkitTransition = "none";
        els.t3ScreenTemperature.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenTemperature.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenTemperature.hidden = false;
        els.t3ScreenTemperature.style.zIndex = "100";
      }
      if (els.t3ScreenSelectCookware) {
        els.t3ScreenSelectCookware.style.transition = "none";
        els.t3ScreenSelectCookware.style.webkitTransition = "none";
        els.t3ScreenSelectCookware.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenSelectCookware.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenSelectCookware.hidden = false;
        els.t3ScreenSelectCookware.style.zIndex = "101";
      }

      scrollToCookwareIndex(targetIdx, false);

      // Animate ONLY the right side content container
      if (els.t3TempMainContent) {
        els.t3TempMainContent.classList.remove("is-entering");
        els.t3TempMainContent.classList.add("is-leaving");
      }
      if (els.t3CookwareMainContent) {
        els.t3CookwareMainContent.classList.remove("is-leaving");
        els.t3CookwareMainContent.classList.add("is-entering");
      }

      setTimeout(() => {
        if (els.t3ScreenTemperature && t3Stage === "selectCookware") {
          els.t3ScreenTemperature.hidden = true;
        }
        if (els.t3TempMainContent) {
          els.t3TempMainContent.classList.remove("is-leaving");
        }
        if (els.t3CookwareMainContent) {
          els.t3CookwareMainContent.classList.remove("is-entering");
        }
        scrollToCookwareIndex(targetIdx, false);
        isCookwareTransitioning = false;
      }, 260);
    };

    transitionCookwareToTemperature = function() {
      if (isCookwareTransitioning) return;
      isCookwareTransitioning = true;
      playSound("touch");

      const selected = state.selectedCookware || "Cast Iron";
      if (els.t3BtnCookwareEdit) {
        const label = els.t3BtnCookwareEdit.querySelector(".t3-cookware-edit-label");
        if (label) {
          label.textContent = selected === "Stainless Steel" ? "Stainless" : selected;
        }
      }

      t3Stage = "temperature";
      updateScreenBadge("temperature");

      // Both screens remain strictly static at translate3d(0, 0, 0) - NO whole-screen slide!
      if (els.t3ScreenTemperature) {
        els.t3ScreenTemperature.style.transition = "none";
        els.t3ScreenTemperature.style.webkitTransition = "none";
        els.t3ScreenTemperature.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenTemperature.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenTemperature.hidden = false;
        els.t3ScreenTemperature.style.zIndex = "101";
      }
      if (els.t3ScreenSelectCookware) {
        els.t3ScreenSelectCookware.style.transition = "none";
        els.t3ScreenSelectCookware.style.webkitTransition = "none";
        els.t3ScreenSelectCookware.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenSelectCookware.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenSelectCookware.hidden = false;
        els.t3ScreenSelectCookware.style.zIndex = "100";
      }

      scrollToT3Temp(state.task3TargetTemp || 350, false);

      // Animate ONLY the right side content container
      if (els.t3CookwareMainContent) {
        els.t3CookwareMainContent.classList.remove("is-entering");
        els.t3CookwareMainContent.classList.add("is-leaving");
      }
      if (els.t3TempMainContent) {
        els.t3TempMainContent.classList.remove("is-leaving");
        els.t3TempMainContent.classList.add("is-entering");
      }

      setTimeout(() => {
        if (els.t3ScreenSelectCookware && t3Stage === "temperature") {
          els.t3ScreenSelectCookware.hidden = true;
        }
        if (els.t3CookwareMainContent) {
          els.t3CookwareMainContent.classList.remove("is-leaving");
        }
        if (els.t3TempMainContent) {
          els.t3TempMainContent.classList.remove("is-entering");
        }
        scrollToT3Temp(state.task3TargetTemp || 350, false);
        isCookwareTransitioning = false;
      }, 260);
    };

    // Cookware Edit button on Temperature Screen (Figma 3382:21184)
    if (els.t3BtnCookwareEdit) {
      const handleCookwareEdit = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        transitionTemperatureToCookware();
      };
      els.t3BtnCookwareEdit.addEventListener("click", handleCookwareEdit);
      els.t3BtnCookwareEdit.addEventListener("touchstart", handleCookwareEdit, { passive: false });
    }

    // Select Cookware Screen Handlers (Figma 3407:25065 / 3409:25243)
    if (els.t3BtnSelectCookware) {
      const handleSelectCookware = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        transitionCookwareToTemperature();
      };
      els.t3BtnSelectCookware.addEventListener("click", handleSelectCookware);
      els.t3BtnSelectCookware.addEventListener("touchstart", handleSelectCookware, { passive: false });
    }

    if (els.t3BtnBackFromCookware) {
      const handleBackFromCookware = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        transitionCookwareToTemperature();
      };
      els.t3BtnBackFromCookware.addEventListener("click", handleBackFromCookware);
      els.t3BtnBackFromCookware.addEventListener("touchstart", handleBackFromCookware, { passive: false });
    }

    if (els.t3BtnCookwareInfo) {
      els.t3BtnCookwareInfo.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
      els.t3BtnCookwareInfo.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        playSound("touch");
      }, { passive: true });
    }

    // 10s Preheat Complete Toast Buttons (Figma 3051:42525)
    if (els.t3ToastBtnOk) {
      els.t3ToastBtnOk.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        hideT3CompleteToast();
      });
    }
    if (els.t3ToastBtnClose) {
      els.t3ToastBtnClose.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        hideT3CompleteToast();
      });
    }

    // Active Burner Text Tile & Circle on Burner Status Screen (Figma 2310:12162 & 3051:42542)
    const handleActiveBurnerClick = () => {
      playSound("touch");
      showT3Screen("tempRun");
      requestAnimationFrame(() => {
        scrollToT3RunTemp(state.task3TargetTemp || 350, false);
      });
    };
    if (els.t3BurnerTextTile) {
      els.t3BurnerTextTile.addEventListener("click", handleActiveBurnerClick);
    }
    if (els.t3ActiveBurnerOverlay) {
      els.t3ActiveBurnerOverlay.addEventListener("click", handleActiveBurnerClick);
    }

    // Preheat Screen: Back & Edit Buttons
    if (els.t3BtnBackFromPreheat) {
      els.t3BtnBackFromPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("temperature");
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      });
    }
    if (els.t3BtnEditPreheat) {
      els.t3BtnEditPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("temperature");
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      });
    }

    // Preheat Completed Screen: Back Button & Toast Actions
    if (els.t3BtnBackFromComplete) {
      els.t3BtnBackFromComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("temperature");
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      });
    }
    if (els.t3ToastCompleteOk) {
      const handleOk = (e) => {
        if (e) e.stopPropagation();
        if (t3Stage === "foodComplete") {
          finishT3FoodPreheatToBurnerStatus();
        } else if (t3Stage === "techniqueComplete") {
          finishT3TechniqueToBurnerStatus();
        } else {
          finishT3PreheatToBurnerStatus();
        }
      };
      els.t3ToastCompleteOk.addEventListener("click", handleOk);
      els.t3ToastCompleteOk.addEventListener("touchstart", handleOk, { passive: true });
    }
    if (els.t3ToastCompleteClose) {
      const handleClose = (e) => {
        if (e) e.stopPropagation();
        if (t3Stage === "foodComplete") {
          finishT3FoodPreheatToBurnerStatus();
        } else if (t3Stage === "techniqueComplete") {
          finishT3TechniqueToBurnerStatus();
        } else {
          finishT3PreheatToBurnerStatus();
        }
      };
      els.t3ToastCompleteClose.addEventListener("click", handleClose);
      els.t3ToastCompleteClose.addEventListener("touchstart", handleClose, { passive: true });
    }
    if (els.t3BtnEditPreheatFromComplete) {
      const handleEdit = (e) => {
        if (e) e.stopPropagation();
        playSound("touch");
        clearT3Timers();
        showT3Screen("temperature");
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      };
      els.t3BtnEditPreheatFromComplete.addEventListener("click", handleEdit);
      els.t3BtnEditPreheatFromComplete.addEventListener("touchstart", handleEdit, { passive: true });
    }

    // Burner Status Screen: Back Button & Active Burner Card Hotspot
    // When task finished, clicking back caret button goes to PCTemperatureRun screen!
    if (els.t3BtnBackFromBurnerStatus) {
      els.t3BtnBackFromBurnerStatus.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("tempRun");
        requestAnimationFrame(() => {
          scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      });
    }
    if (els.t3HotspotActiveBurner) {
      els.t3HotspotActiveBurner.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("tempRun");
        requestAnimationFrame(() => {
          scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      });
    }

    // Active Burner Card on live overview screen (Figma 2315:14540)
    if (els.tStartActiveBurner1) {
      const handleActiveCard = (e) => {
        if (e) e.stopPropagation();
        playSound("touch");
        showT3Screen("tempRun");
        requestAnimationFrame(() => {
          scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          }, 60);
        });
      };
      els.tStartActiveBurner1.addEventListener("click", handleActiveCard);
      els.tStartActiveBurner1.addEventListener("touchstart", handleActiveCard, { passive: true });
    }

    // Back caret on live start/overview screen
    if (els.t3BtnBackFromStart) {
      els.t3BtnBackFromStart.addEventListener("click", () => {
        playSound("touch");
        if (t3Stage === "burnerStatus") {
          showT3Screen("tempRun");
          requestAnimationFrame(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
          });
        }
      });
    }

    // PCTemperatureRun Screen: Back Button, Update Button & Keypad Button
    if (els.t3BtnBackFromTempRun) {
      els.t3BtnBackFromTempRun.addEventListener("click", () => {
        playSound("touch");
        if (tempRunReturnStage === "pancakesPreheat") { returnFromTempRunToPancakes(false); return; }
        showT3Screen("burnerStatus");
      });
    }
    if (els.t3BtnUpdateTemp) {
      let lastUpdateTime = 0;
      const handleUpdate = (e) => {
        if (e) e.preventDefault();
        const now = Date.now();
        if (now - lastUpdateTime < 400) return;
        lastUpdateTime = now;
        if (tempRunReturnStage === "pancakesPreheat") { returnFromTempRunToPancakes(true); return; }
        startT3Preheat();
      };
      els.t3BtnUpdateTemp.addEventListener("click", handleUpdate);
      els.t3BtnUpdateTemp.addEventListener("touchstart", handleUpdate, { passive: false });
    }
    if (els.t3BtnKeypadTemp) {
      els.t3BtnKeypadTemp.addEventListener("click", () => {
        playSound("touch");
        openT3Digipad("tempRun");
      });
    }

    // Cookware info on TempRun screen
    const t3RunCookwareInfo = document.getElementById("t3RunCookwareInfo");
    if (t3RunCookwareInfo) {
      t3RunCookwareInfo.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }

    // ==============================================
    // TASK 3C: FOOD MODE & RECIPE CONFIG LISTENERS
    // ==============================================

    // Subflow switcher buttons
    if (els.btnT3FlowTemp) {
      els.btnT3FlowTemp.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "temperature";
        state.task3TargetTemp = 350;
        els.btnT3FlowTemp.classList.add("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowStatus) els.btnT3FlowStatus.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
        if (els.btnT3FlowRecent) els.btnT3FlowRecent.classList.remove("is-active");
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        setKnobAngle(1, 0, false, true);
        setKnobAngle(2, 0, false, true);
        showT3Screen("start");
      });
    }

    if (els.btnT3FlowStatus) {
      els.btnT3FlowStatus.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "temperature";
        state.task3TargetTemp = 350;
        els.btnT3FlowStatus.classList.add("is-active");
        if (els.btnT3FlowTemp) els.btnT3FlowTemp.classList.remove("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
        if (els.btnT3FlowRecent) els.btnT3FlowRecent.classList.remove("is-active");
        setKnobAngle(2, -56, false, false);
        [1, 3, 4, 5].forEach(i => setKnobAngle(i, 0, false, false));
        showT3Screen("burnerStatus");
      });
    }

    if (els.btnT3FlowFood) {
      els.btnT3FlowFood.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "food";
        els.btnT3FlowFood.classList.add("is-active");
        if (els.btnT3FlowTemp) els.btnT3FlowTemp.classList.remove("is-active");
        if (els.btnT3FlowStatus) els.btnT3FlowStatus.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
        if (els.btnT3FlowRecent) els.btnT3FlowRecent.classList.remove("is-active");
        setKnobAngle(2, -56, false, false);
        showT3Screen("burnerStatus");
        setTimeout(() => {
          setKnobAngle(1, -56, true, true);
        }, 300);
      });
    }

    if (els.btnT3FlowTech) {
      els.btnT3FlowTech.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "technique";
        els.btnT3FlowTech.classList.add("is-active");
        if (els.btnT3FlowTemp) els.btnT3FlowTemp.classList.remove("is-active");
        if (els.btnT3FlowStatus) els.btnT3FlowStatus.classList.remove("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowRecent) els.btnT3FlowRecent.classList.remove("is-active");
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        [1, 2, 3, 5].forEach(i => setKnobAngle(i, 0, false, false));
        showT3Screen("start");
        setTimeout(() => {
          setKnobAngle(4, -56, true, true);
        }, 300);
      });
    }

    if (els.btnT3FlowRecent) {
      els.btnT3FlowRecent.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "recent";
        els.btnT3FlowRecent.classList.add("is-active");
        if (els.btnT3FlowTemp) els.btnT3FlowTemp.classList.remove("is-active");
        if (els.btnT3FlowStatus) els.btnT3FlowStatus.classList.remove("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
        showT3Screen("recentUsed");
      });
    }

    // Unified Tab Navigation for Task 3 (Technique, Food, Temperature, Favorite, Recent)
    function switchT3Tab(tabName) {
      if (tabName === "spotlight") {
        showT3Screen("spotlight");
      } else if (tabName === "technique") {
        if (t3Stage === "technique") return;
        showT3Screen("technique");
        if (els.t3TechniqueScroll) els.t3TechniqueScroll.scrollTop = 0;
      } else if (tabName === "food") {
        if (t3Stage === "foodOptions") return;
        showT3Screen("foodOptions");
        if (els.t3FoodScroll) els.t3FoodScroll.scrollTop = 0;
      } else if (tabName === "temperature") {
        if (state.task3IsRunning) {
          if (t3Stage === "tempRun") {
            scrollToT3RunTemp(state.task3TargetTemp || 350, true);
            return;
          }
          showT3Screen("tempRun");
          requestAnimationFrame(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 350, false);
            setTimeout(() => {
              scrollToT3RunTemp(state.task3TargetTemp || 350, false);
            }, 60);
          });
          return;
        }
        if (t3Stage === "temperature") return;
        if (t3Stage === "beefMenu") {
          t3Stage = "temperature";
          updateScreenBadge("temperature");
          slideTransition(els.t3ScreenBeefMenu, els.t3ScreenTemperature, "right", () => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
          });
        } else if (t3Stage === "selectCookware") {
          if (typeof transitionCookwareToTemperature === "function") {
            transitionCookwareToTemperature();
          } else {
            t3Stage = "temperature";
            updateScreenBadge("temperature");
            showT3Screen("temperature");
          }
        } else {
          showT3Screen("temperature");
          requestAnimationFrame(() => {
            scrollToT3Temp(state.task3TargetTemp || 350, false);
            setTimeout(() => {
              scrollToT3Temp(state.task3TargetTemp || 350, false);
            }, 60);
          });
        }
      } else if (tabName === "recent") {
        if (t3Stage === "recentUsed") return;
        showT3Screen("recentUsed");
      } else if (tabName === "favorite") {
        playSound("touch");
      }
    }

    // Attach unified pointerdown / touchstart / click listeners to all .t3-tab-btn elements across screens
    let lastT3TabTime = 0;
    const bindT3TabBtn = (btn) => {
      const tabTarget = btn.dataset.t3tab;
      if (!tabTarget) return;

      const triggerTab = (e) => {
        if (e) {
          if (e.type === "touchstart" || e.type === "pointerdown") {
            e.preventDefault();
          }
          e.stopPropagation();
        }
        btn.classList.add("is-active-press");
        setTimeout(() => btn.classList.remove("is-active-press"), 150);
        const now = Date.now();
        if (now - lastT3TabTime < 200) return;
        lastT3TabTime = now;
        playSound("touch");
        switchT3Tab(tabTarget);
      };

      btn.addEventListener("click", triggerTab);
      btn.addEventListener("touchstart", triggerTab, { passive: false });
      btn.addEventListener("pointerdown", triggerTab);
    };
    document.querySelectorAll(".t3-tab-btn, .pc-drawer-item[data-t3tab]").forEach(bindT3TabBtn);

    // Food Options Screen Back Button (< Cooktop)
    if (els.t3BtnBackFromFoodOptions) {
      els.t3BtnBackFromFoodOptions.addEventListener("click", () => {
        playSound("touch");
        const targetScreen = (knobsState[1] && Math.abs(knobsState[1].angle) > 20) || (state.task3Mode === "food")
          ? els.t3ScreenBurnerStatus
          : els.t3ScreenStart;
        t3Stage = targetScreen === els.t3ScreenBurnerStatus ? "burnerStatus" : "start";
        updateScreenBadge(t3Stage);
        slideTransition(els.t3ScreenFoodOptions, targetScreen, "right");
      });
    }

    // Food Options 3-Column Grid Cards Selection (Figma 3021:26359 & 3028:28875)
    let isFoodOrDrawerDragging = false;
    const t3FoodCards = document.querySelectorAll("#t3FoodScroll .t3-food-card");
    t3FoodCards.forEach(card => {
      card.addEventListener("click", (e) => {
        if (isFoodOrDrawerDragging) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        playSound("touch");
        t3FoodCards.forEach(c => c.classList.remove("is-selected"));
        card.classList.add("is-selected");

        const foodName = card.dataset.food;
        if (foodName === "Beef") {
          setTimeout(() => {
            transitionToT3BeefMenu();
          }, 220);
        } else if (foodName === "Pancakes") {
          setTimeout(() => {
            transitionToT3Pancakes();
          }, 220);
        }
      });
    });

    // Technique Options 3-Column Grid Cards Selection (Figma 3198:27869 & 3198:27884)
    const t3TechCards = document.querySelectorAll("#t3TechniqueScroll .t3-tech-card");
    t3TechCards.forEach(card => {
      card.addEventListener("click", (e) => {
        if (isFoodOrDrawerDragging) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        playSound("touch");
        t3TechCards.forEach(c => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
      });
    });

    // Recent Used Options Cards Selection (Figma 3098:10875)
    const t3RecentCards = document.querySelectorAll("#t3RecentContainer .t3-recent-card");
    t3RecentCards.forEach(card => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        t3RecentCards.forEach(c => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
      });
    });

    // Beef Menu Screen (Figma 3028:28875): Scrollable 6-tile drawer & view switching
    let currentBeefTab = "burner";
    let isDonenessDesc = false;
    let currentBeefType = "Steak";
    let currentBeefDoneness = "Med Rare";
    const beefThicknessValues = ["0.5", "0.625", "0.75", "0.875", "1.0", "1.25", "1.5"];
    let currentBeefThicknessIdx = 3; // default 0.875
    const BEEF_TYPES = ["Ground", "Steak", "Patties"];
    const BEEF_DONENESSES = ["Rare", "Med Rare", "Medium", "Med Well", "Well"];

    function selectBeefType(type, smoothScroll = true) {
      if (!type) return;
      currentBeefType = type;
      if (els.t3BeefValType) els.t3BeefValType.textContent = type;

      const typeCards = document.querySelectorAll("#t3BeefTypeTrack .t3-beef-card");
      typeCards.forEach(card => {
        card.classList.toggle("is-selected", card.dataset.cardType === type);
      });

      const idx = BEEF_TYPES.indexOf(type);
      const dots = els.t3BeefTypeDots?.querySelectorAll(".t3-carousel-dot");
      dots?.forEach((d, i) => d.classList.toggle("is-active", i === idx));

      if (els.t3BeefTypeCarousel && idx >= 0) {
        const targetLeft = idx * 344;
        if (smoothScroll) {
          els.t3BeefTypeCarousel.scrollTo({ left: targetLeft, behavior: "smooth" });
        } else {
          els.t3BeefTypeCarousel.scrollLeft = targetLeft;
        }
      }
    }

    function selectBeefDoneness(doneness, smoothScroll = true) {
      if (!doneness) return;
      currentBeefDoneness = doneness;
      if (els.t3BeefValDoneness) els.t3BeefValDoneness.textContent = doneness;

      const donenessCards = document.querySelectorAll("#t3BeefDonenessTrack .t3-beef-card");
      donenessCards.forEach(card => {
        card.classList.toggle("is-selected", card.dataset.cardDoneness === doneness);
      });

      const idx = BEEF_DONENESSES.indexOf(doneness);
      const dots = els.t3BeefDonenessDots?.querySelectorAll(".t3-carousel-dot");
      dots?.forEach((d, i) => d.classList.toggle("is-active", i === idx));

      if (els.t3BeefDonenessCarousel && idx >= 0) {
        const targetLeft = idx * 344;
        if (smoothScroll) {
          els.t3BeefDonenessCarousel.scrollTo({ left: targetLeft, behavior: "smooth" });
        } else {
          els.t3BeefDonenessCarousel.scrollLeft = targetLeft;
        }
      }
    }

    function updateBeefMenuUI() {
      const beefTiles = document.querySelectorAll("#t3BeefDrawerTiles .t3-beef-drawer-tile");
      beefTiles.forEach(tile => {
        if (tile.dataset.beefTab === currentBeefTab) {
          tile.classList.add("is-selected");
        } else {
          tile.classList.remove("is-selected");
        }
      });

      if (els.t3BeefBgImg) {
        if (currentBeefTab === "burner") {
          els.t3BeefBgImg.src = "./assets/task3c/beef_bg_clean_burner.png";
        } else if (currentBeefTab === "type") {
          els.t3BeefBgImg.src = "./assets/task3c/beef_bg_clean_type.png";
        } else if (currentBeefTab === "doneness") {
          els.t3BeefBgImg.src = isDonenessDesc ? "./assets/task3c/beef_bg_clean_doneness_desc.png" : "./assets/task3c/beef_bg_clean_doneness_img.png";
        } else if (currentBeefTab === "thickness") {
          els.t3BeefBgImg.src = "./assets/task3c/beef_bg_clean_thickness.png";
        } else if (currentBeefTab === "cookware") {
          els.t3BeefBgImg.src = "./assets/task3c/beef_bg_clean_cookware.png";
        } else if (currentBeefTab === "tips") {
          els.t3BeefBgImg.src = "./assets/task3c/beef_bg_clean_tips.png";
        }
      }

      // Type Carousel
      if (els.t3BeefTypeCarouselWrap) {
        els.t3BeefTypeCarouselWrap.style.display = (currentBeefTab === "type") ? "flex" : "none";
        if (currentBeefTab === "type") {
          selectBeefType(currentBeefType, false);
        }
      }

      // Doneness Carousel
      if (els.t3BeefDonenessCarouselWrap) {
        els.t3BeefDonenessCarouselWrap.style.display = (currentBeefTab === "doneness") ? "flex" : "none";
        if (currentBeefTab === "doneness") {
          selectBeefDoneness(currentBeefDoneness, false);
        }
      }

      // Doneness view mode (Image vs Description)
      const donenessDescWraps = document.querySelectorAll("#t3BeefDonenessTrack .t3-beef-card-desc-wrap");
      const donenessImgWraps = document.querySelectorAll("#t3BeefDonenessTrack .t3-beef-card-img-wrap");
      donenessDescWraps.forEach(w => w.style.display = isDonenessDesc ? "flex" : "none");
      donenessImgWraps.forEach(w => w.style.display = isDonenessDesc ? "none" : "flex");

      if (els.t3BtnBeefMenuDonenessToggle) {
        els.t3BtnBeefMenuDonenessToggle.style.display = (currentBeefTab === "doneness") ? "block" : "none";
      }
      if (els.t3BtnBeefMenuThicknessMinus) {
        els.t3BtnBeefMenuThicknessMinus.style.display = (currentBeefTab === "thickness") ? "block" : "none";
      }
      if (els.t3BtnBeefMenuThicknessPlus) {
        els.t3BtnBeefMenuThicknessPlus.style.display = (currentBeefTab === "thickness") ? "block" : "none";
      }
      if (els.t3BeefMenuThicknessOverlay) {
        els.t3BeefMenuThicknessOverlay.style.display = (currentBeefTab === "thickness") ? "flex" : "none";
      }
    }
    window.__updateBeefMenuUI = updateBeefMenuUI;

    const beefTiles = document.querySelectorAll("#t3BeefDrawerTiles .t3-beef-drawer-tile");
    beefTiles.forEach(tile => {
      tile.addEventListener("click", () => {
        playSound("touch");
        currentBeefTab = tile.dataset.beefTab;
        updateBeefMenuUI();
      });
    });

    // Type Card clicks
    const typeCards = document.querySelectorAll("#t3BeefTypeTrack .t3-beef-card");
    typeCards.forEach(card => {
      card.addEventListener("click", () => {
        playSound("touch");
        selectBeefType(card.dataset.cardType, true);
      });
    });

    // Type Dot clicks
    const typeDots = els.t3BeefTypeDots?.querySelectorAll(".t3-carousel-dot");
    typeDots?.forEach(dot => {
      dot.addEventListener("click", () => {
        playSound("touch");
        const idx = parseInt(dot.dataset.dotIndex, 10);
        if (BEEF_TYPES[idx]) selectBeefType(BEEF_TYPES[idx], true);
      });
    });

    // Doneness Card clicks
    const donenessCards = document.querySelectorAll("#t3BeefDonenessTrack .t3-beef-card");
    donenessCards.forEach(card => {
      card.addEventListener("click", () => {
        playSound("touch");
        selectBeefDoneness(card.dataset.cardDoneness, true);
      });
    });

    // Doneness Dot clicks
    const donenessDots = els.t3BeefDonenessDots?.querySelectorAll(".t3-carousel-dot");
    donenessDots?.forEach(dot => {
      dot.addEventListener("click", () => {
        playSound("touch");
        const idx = parseInt(dot.dataset.dotIndex, 10);
        if (BEEF_DONENESSES[idx]) selectBeefDoneness(BEEF_DONENESSES[idx], true);
      });
    });

    // Carousel Scroll listeners
    if (els.t3BeefTypeCarousel) {
      let scrollEndTimer = null;
      els.t3BeefTypeCarousel.addEventListener("scroll", () => {
        const idx = Math.max(0, Math.min(BEEF_TYPES.length - 1, Math.round(els.t3BeefTypeCarousel.scrollLeft / 344)));
        const dots = els.t3BeefTypeDots?.querySelectorAll(".t3-carousel-dot");
        dots?.forEach((d, i) => d.classList.toggle("is-active", i === idx));

        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => {
          if (BEEF_TYPES[idx] && BEEF_TYPES[idx] !== currentBeefType) {
            selectBeefType(BEEF_TYPES[idx], false);
          }
        }, 150);
      }, { passive: true });
    }

    if (els.t3BeefDonenessCarousel) {
      let scrollEndTimer = null;
      els.t3BeefDonenessCarousel.addEventListener("scroll", () => {
        const idx = Math.max(0, Math.min(BEEF_DONENESSES.length - 1, Math.round(els.t3BeefDonenessCarousel.scrollLeft / 344)));
        const dots = els.t3BeefDonenessDots?.querySelectorAll(".t3-carousel-dot");
        dots?.forEach((d, i) => d.classList.toggle("is-active", i === idx));

        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => {
          if (BEEF_DONENESSES[idx] && BEEF_DONENESSES[idx] !== currentBeefDoneness) {
            selectBeefDoneness(BEEF_DONENESSES[idx], false);
          }
        }, 150);
      }, { passive: true });
    }

    // Generic drag scroll helper
    function enableDragScroll(container, direction = "horizontal") {
      if (!container) return;
      let isDown = false;
      let startPos = 0;
      let scrollPos = 0;
      let hasMoved = false;

      container.addEventListener("mousedown", (e) => {
        isDown = true;
        hasMoved = false;
        startPos = (direction === "horizontal") ? e.pageX : e.pageY;
        scrollPos = (direction === "horizontal") ? container.scrollLeft : container.scrollTop;
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const currentPos = (direction === "horizontal") ? e.pageX : e.pageY;
        const walk = currentPos - startPos;
        if (Math.abs(walk) > 5) {
          hasMoved = true;
        }
        if (direction === "horizontal") {
          container.scrollLeft = scrollPos - walk;
        } else {
          container.scrollTop = scrollPos - walk;
        }
      });

      window.addEventListener("mouseup", () => {
        if (isDown) isDown = false;
      });

      container.addEventListener("click", (e) => {
        if (hasMoved) {
          e.stopPropagation();
          e.preventDefault();
          hasMoved = false;
        }
      }, true);
    }

    enableDragScroll(els.t3BeefTypeCarousel, "horizontal");
    enableDragScroll(els.t3BeefDonenessCarousel, "horizontal");
    enableDragScroll(els.t3BeefDrawerTiles, "vertical");

    if (els.t3BtnBeefMenuDonenessToggle) {
      els.t3BtnBeefMenuDonenessToggle.addEventListener("click", () => {
        playSound("touch");
        isDonenessDesc = !isDonenessDesc;
        updateBeefMenuUI();
      });
    }

    if (els.t3BtnBeefMenuThicknessMinus) {
      els.t3BtnBeefMenuThicknessMinus.addEventListener("click", () => {
        if (currentBeefThicknessIdx > 0) {
          playSound("touch");
          currentBeefThicknessIdx--;
          const val = beefThicknessValues[currentBeefThicknessIdx];
          if (els.t3BeefMenuThicknessVal) els.t3BeefMenuThicknessVal.textContent = val;
          if (els.t3BeefValThickness) els.t3BeefValThickness.textContent = `${val} in`;
          updateBeefMenuUI();
        }
      });
    }

    if (els.t3BtnBeefMenuThicknessPlus) {
      els.t3BtnBeefMenuThicknessPlus.addEventListener("click", () => {
        if (currentBeefThicknessIdx < beefThicknessValues.length - 1) {
          playSound("touch");
          currentBeefThicknessIdx++;
          const val = beefThicknessValues[currentBeefThicknessIdx];
          if (els.t3BeefMenuThicknessVal) els.t3BeefMenuThicknessVal.textContent = val;
          if (els.t3BeefValThickness) els.t3BeefValThickness.textContent = `${val} in`;
          updateBeefMenuUI();
        }
      });
    }

    if (els.t3BtnBackFromBeefMenu) {
      els.t3BtnBackFromBeefMenu.addEventListener("click", () => {
        playSound("touch");
        t3Stage = "foodOptions";
        updateScreenBadge("foodOptions");
        t3FoodCards.forEach(c => c.classList.remove("is-selected"));
        slideTransition(els.t3ScreenBeefMenu, els.t3ScreenFoodOptions, "right");
      });
    }

    // Press START: Navigates to 3C-foodBurnerStatus (Figma 2327:15934) per user directive
    if (els.t3BtnStartBeef) {
      els.t3BtnStartBeef.addEventListener("click", () => {
        playSound("toggleOn");
        state.task3Mode = "food";
        showT3Screen("foodBurnerStatus");
      });
    }

    // Technique Options Screen Back Button (< Cooktop)
    if (els.t3BtnBackFromTechnique) {
      els.t3BtnBackFromTechnique.addEventListener("click", () => {
        playSound("touch");
        const targetScreen = (knobsState[1] && Math.abs(knobsState[1].angle) > 20) || (state.task3Mode === "technique")
          ? els.t3ScreenBurnerStatus
          : els.t3ScreenStart;
        t3Stage = targetScreen === els.t3ScreenBurnerStatus ? "burnerStatus" : "start";
        updateScreenBadge(t3Stage);
        slideTransition(els.t3ScreenTechnique, targetScreen, "right");
      });
    }

    // Recent Used Screen Back Button (< Cooktop)
    if (els.t3BtnBackFromRecentUsed) {
      els.t3BtnBackFromRecentUsed.addEventListener("click", () => {
        playSound("touch");
        const targetScreen = (knobsState[1] && Math.abs(knobsState[1].angle) > 20) || (state.task3Mode === "recent")
          ? els.t3ScreenBurnerStatus
          : els.t3ScreenStart;
        t3Stage = targetScreen === els.t3ScreenBurnerStatus ? "burnerStatus" : "start";
        updateScreenBadge(t3Stage);
        slideTransition(els.t3ScreenRecentUsed, targetScreen, "right");
      });
    }

    if (els.t3BtnCookware) {
      els.t3BtnCookware.addEventListener("click", () => {
        playSound("touch");
      });
    }

    // Technique Preheat & Complete Back/Edit Buttons
    if (els.t3BtnBackFromTechPreheat) {
      els.t3BtnBackFromTechPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("technique");
      });
    }
    if (els.t3BtnBackFromTechComplete) {
      els.t3BtnBackFromTechComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("technique");
      });
    }
    if (els.t3BtnEditTechPreheat) {
      els.t3BtnEditTechPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("technique");
      });
    }
    if (els.t3BtnEditTechComplete) {
      els.t3BtnEditTechComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("technique");
      });
    }

    // =========================================================================
    // TASK 3C: BEEF FLOW (SELECT TYPE, SELECT DONENESS, SELECT THICKNESS)
    // Figma 2323:15104 (Sidepanel Drawer), 2323:14992 / 2323:15050 (Doneness Cards)
    // =========================================================================

    const DONENESS_LEVELS = [
      { id: "rare", name: "Rare", index: 0 },
      { id: "med-rare", name: "Med Rare", index: 1 },
      { id: "medium", name: "Medium", index: 2 },
      { id: "med-well", name: "Med Well", index: 3 },
      { id: "well", name: "Well", index: 4 }
    ];

    function syncBeefDrawers() {
      const beefType = state.task3BeefType || "Steak";
      const doneness = state.task3BeefDoneness || "Med Rare";
      const thickness = `${state.task3BeefThickness || 0.5} in`;

      document.querySelectorAll(".t3-tile-val-type").forEach(el => { el.textContent = beefType; });
      document.querySelectorAll(".t3-tile-val-doneness").forEach(el => { el.textContent = doneness; });
      document.querySelectorAll(".t3-tile-val-thickness").forEach(el => { el.textContent = thickness; });

      // Sync active state on tiles per screen
      const activeScreens = [
        { id: "t3ScreenBeefType", nav: "beefType" },
        { id: "t3ScreenBeefDoneness", nav: "beefDoneness" },
        { id: "t3ScreenBeefThickness", nav: "beefThickness" }
      ];

      activeScreens.forEach(scr => {
        const scrEl = document.getElementById(scr.id);
        if (scrEl) {
          scrEl.querySelectorAll(".t3-drawer-tile").forEach(tile => {
            const isMatch = tile.getAttribute("data-drawer-nav") === scr.nav;
            tile.classList.toggle("is-active", isMatch);
            if (isMatch && scr.nav === "beefThickness") {
              const scrollBox = scrEl.querySelector(".t3-drawer-scrollable-options");
              if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
            }
          });
        }
      });
    }

    function selectDonenessCard(index, smoothScroll = true) {
      const carousel = document.getElementById("t3DonenessCarousel");
      if (!carousel) return;
      const cards = carousel.querySelectorAll(".t3-doneness-card");
      if (index < 0 || index >= cards.length) return;

      cards.forEach((c, i) => {
        c.classList.toggle("is-selected", i === index);
      });

      const donenessName = cards[index].getAttribute("data-doneness") || "Med Rare";
      state.task3BeefDoneness = donenessName;
      syncBeefDrawers();

      updatePaginationDots(index);

      if (smoothScroll) {
        scrollCarouselToCard(index, true);
      }
    }

    function scrollCarouselToCard(index, smooth = true) {
      const carousel = document.getElementById("t3DonenessCarousel");
      if (!carousel) return;
      const cards = carousel.querySelectorAll(".t3-doneness-card");
      if (!cards[index]) return;

      const card = cards[index];
      const cardLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const carouselWidth = carousel.clientWidth;
      const targetScrollLeft = cardLeft - (carouselWidth / 2) + (cardWidth / 2);

      carousel.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? "smooth" : "auto"
      });
    }

    function updateActiveDonenessDotFromScroll() {
      const carousel = document.getElementById("t3DonenessCarousel");
      if (!carousel) return;
      const cards = carousel.querySelectorAll(".t3-doneness-card");
      if (!cards.length) return;

      const carouselCenter = carousel.scrollLeft + (carousel.clientWidth / 2);
      let closestIndex = 0;
      let minDiff = Infinity;

      cards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
        const diff = Math.abs(carouselCenter - cardCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = idx;
        }
      });

      updatePaginationDots(closestIndex);
    }

    function updatePaginationDots(activeIndex) {
      const dots = document.querySelectorAll(".t3-doneness-dot");
      dots.forEach((dot, idx) => {
        dot.classList.toggle("is-active", idx === activeIndex);
      });
    }

    window.__onEnterBeefScreen = function(stage) {
      syncBeefDrawers();
      if (stage === "beefDoneness") {
        setTimeout(() => {
          const selectedIdx = DONENESS_LEVELS.findIndex(d => d.name === (state.task3BeefDoneness || "Med Rare"));
          selectDonenessCard(selectedIdx >= 0 ? selectedIdx : 1, false);
        }, 30);
      } else if (stage === "beefThickness") {
        const thickNum = document.getElementById("t3ThicknessNumber");
        if (thickNum) thickNum.textContent = (state.task3BeefThickness || 0.5).toString();
      }
    };

    // 1. Drawer Option Tiles Click (Type, Doneness, Thickness)
    document.querySelectorAll(".t3-drawer-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        playSound("touch");
        const targetNav = tile.getAttribute("data-drawer-nav");
        if (targetNav) {
          showT3Screen(targetNav);
        }
      });
    });

    // 2. Drawer Back Button Click (< Cooktop | Beef)
    document.querySelectorAll(".t3-drawer-back-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("foodOptions");
      });
    });

    // 3. Side Panel Handle (Figma 2581:7152) - Disabled, Non-collapsible


    // 4. Drawer & Food Scrollable Container Smooth Drag (Mouse & Touch)
    document.querySelectorAll(".t3-drawer-scrollable-options, .t3-food-scroll-container, .t3-tech-scroll-container").forEach(scrollBox => {
      let isDown = false;
      let startClientY = 0;
      let startScrollTop = 0;
      let hasMoved = false;

      const getAppScale = () => {
        return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-scale")) || 1.0;
      };

      // Mouse drag with window-level tracking
      const onMouseMove = (e) => {
        if (!isDown) return;
        const scale = getAppScale();
        const diff = (e.clientY - startClientY) / scale;
        if (Math.abs(diff) > 4) {
          hasMoved = true;
          isFoodOrDrawerDragging = true;
        }
        scrollBox.scrollTop = startScrollTop - diff;
        e.preventDefault();
      };

      const onMouseUp = () => {
        if (!isDown) return;
        isDown = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (hasMoved) {
          setTimeout(() => {
            hasMoved = false;
            isFoodOrDrawerDragging = false;
          }, 120);
        } else {
          isFoodOrDrawerDragging = false;
        }
      };

      scrollBox.addEventListener("mousedown", (e) => {
        isDown = true;
        hasMoved = false;
        startClientY = e.clientY;
        startScrollTop = scrollBox.scrollTop;
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      // Touch drag for iPad Safari and touch monitors
      let touchActive = false;
      let touchStartY = 0;
      let touchScrollTop = 0;
      let touchMoved = false;

      scrollBox.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches.length === 1) {
          touchActive = true;
          touchMoved = false;
          touchStartY = e.touches[0].clientY;
          touchScrollTop = scrollBox.scrollTop;
        }
      }, { passive: true });

      scrollBox.addEventListener("touchmove", (e) => {
        if (!touchActive || !e.touches || e.touches.length !== 1) return;
        const scale = getAppScale();
        const diff = (touchStartY - e.touches[0].clientY) / scale;
        if (Math.abs(diff) > 5) {
          touchMoved = true;
          isFoodOrDrawerDragging = true;
        }
        scrollBox.scrollTop = touchScrollTop + diff;
      }, { passive: true });

      const finishTouch = () => {
        touchActive = false;
        if (touchMoved) {
          setTimeout(() => {
            touchMoved = false;
            isFoodOrDrawerDragging = false;
          }, 150);
        } else {
          isFoodOrDrawerDragging = false;
        }
      };
      scrollBox.addEventListener("touchend", finishTouch, { passive: true });
      scrollBox.addEventListener("touchcancel", finishTouch, { passive: true });

      scrollBox.addEventListener("click", (e) => {
        if (hasMoved || touchMoved || isFoodOrDrawerDragging) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    });

    // 5. Select Type Screen Type Buttons (Ground, Patties, Steak)
    document.querySelectorAll(".t3-type-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        playSound("touch");
        document.querySelectorAll(".t3-type-btn").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.task3BeefType = btn.getAttribute("data-beef-type") || "Steak";
        syncBeefDrawers();
      });
    });

    const btnBeefTypeStart = document.getElementById("t3BtnBeefTypeStart");
    if (btnBeefTypeStart) {
      btnBeefTypeStart.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("beefDoneness");
      });
    }

    // 6. Select Doneness Horizontal Carousel & Cards
    const donenessCarousel = document.getElementById("t3DonenessCarousel");
    const donenessDotsContainer = document.getElementById("t3DonenessPagination");
    const donenessToggleBtn = document.getElementById("t3BtnDonenessToggle");
    const donenessStartBtn = document.getElementById("t3BtnBeefDonenessStart");

    if (donenessCarousel) {
      // Horizontal mouse drag support
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let hasDragged = false;

      donenessCarousel.addEventListener("mousedown", (e) => {
        isDown = true;
        hasDragged = false;
        startX = e.pageX - donenessCarousel.offsetLeft;
        scrollLeft = donenessCarousel.scrollLeft;
      });

      window.addEventListener("mouseup", () => {
        if (isDown) {
          isDown = false;
          setTimeout(() => { hasDragged = false; }, 50);
        }
      });

      donenessCarousel.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const x = e.pageX - donenessCarousel.offsetLeft;
        const walk = (x - startX) * 1.4;
        if (Math.abs(walk) > 6) hasDragged = true;
        donenessCarousel.scrollLeft = scrollLeft - walk;
      });

      // Update pagination dots dynamically on horizontal scroll
      let scrollDebounce = null;
      donenessCarousel.addEventListener("scroll", () => {
        if (scrollDebounce) cancelAnimationFrame(scrollDebounce);
        scrollDebounce = requestAnimationFrame(() => {
          updateActiveDonenessDotFromScroll();
        });
      }, { passive: true });

      // Card click selection
      const cards = donenessCarousel.querySelectorAll(".t3-doneness-card");
      cards.forEach((card, idx) => {
        card.addEventListener("click", () => {
          if (hasDragged) return;
          playSound("touch");
          selectDonenessCard(idx, true);
        });
      });
    }

    // Pagination dots click
    if (donenessDotsContainer) {
      const dots = donenessDotsContainer.querySelectorAll(".t3-doneness-dot");
      dots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
          playSound("touch");
          scrollCarouselToCard(idx, true);
        });
      });
    }

    // Toggle button (Photo Mode vs Text Description Mode)
    if (donenessToggleBtn) {
      donenessToggleBtn.addEventListener("click", () => {
        playSound("touch");
        const isPhotoMode = donenessCarousel && !donenessCarousel.classList.contains("is-text-mode");
        if (donenessCarousel) {
          if (isPhotoMode) {
            donenessCarousel.classList.remove("is-photo-mode");
            donenessCarousel.classList.add("is-text-mode");
          } else {
            donenessCarousel.classList.remove("is-text-mode");
            donenessCarousel.classList.add("is-photo-mode");
          }
        }
        const svgInfo = donenessToggleBtn.querySelector(".t3-toggle-svg-info");
        const svgPhoto = donenessToggleBtn.querySelector(".t3-toggle-svg-photo");
        if (svgInfo && svgPhoto) {
          svgInfo.hidden = isPhotoMode;
          svgPhoto.hidden = !isPhotoMode;
        }
      });
    }

    // Doneness START Button
    if (donenessStartBtn) {
      donenessStartBtn.addEventListener("click", () => {
        playSound("touch");
        startT3FoodPreheat();
      });
    }

    // 7. Select Thickness Stepper
    const btnThicknessMinus = document.getElementById("t3BtnThicknessMinus");
    const btnThicknessPlus = document.getElementById("t3BtnThicknessPlus");
    const thicknessDisplayNum = document.getElementById("t3ThicknessNumber");
    const btnThicknessStart = document.getElementById("t3BtnBeefThicknessStart");

    if (btnThicknessMinus) {
      btnThicknessMinus.addEventListener("click", () => {
        playSound("tick");
        let val = parseFloat(state.task3BeefThickness || 0.5);
        val = Math.max(0.25, Math.round((val - 0.125) * 1000) / 1000);
        state.task3BeefThickness = val;
        if (thicknessDisplayNum) thicknessDisplayNum.textContent = val.toString();
        syncBeefDrawers();
      });
    }

    if (btnThicknessPlus) {
      btnThicknessPlus.addEventListener("click", () => {
        playSound("tick");
        let val = parseFloat(state.task3BeefThickness || 0.5);
        val = Math.min(3.0, Math.round((val + 0.125) * 1000) / 1000);
        state.task3BeefThickness = val;
        if (thicknessDisplayNum) thicknessDisplayNum.textContent = val.toString();
        syncBeefDrawers();
      });
    }

    if (btnThicknessStart) {
      btnThicknessStart.addEventListener("click", () => {
        playSound("touch");
        startT3FoodPreheat();
      });
    }

    // Initial sync
    syncBeefDrawers();

    // Food Preheat & Complete Screens (Figma 2348:17304 & 2348:17501)
    if (els.t3BtnBackFromFoodPreheat) {
      els.t3BtnBackFromFoodPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        if (currentFoodSubflow === "pancakes") {
          showT3Screen("pancakesDoneness");
        } else {
          showT3Screen("beefMenu");
        }
      });
    }
    if (els.t3BtnEditFoodPreheat) {
      els.t3BtnEditFoodPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        if (currentFoodSubflow === "pancakes") {
          showT3Screen("pancakesDoneness");
        } else {
          showT3Screen("beefMenu");
        }
      });
    }
    if (els.t3BtnBackFromFoodComplete) {
      els.t3BtnBackFromFoodComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        if (currentFoodSubflow === "pancakes") {
          showT3Screen("pancakesDoneness");
        } else {
          showT3Screen("beefMenu");
        }
      });
    }
    if (els.t3BtnEditFoodComplete) {
      els.t3BtnEditFoodComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        if (currentFoodSubflow === "pancakes") {
          showT3Screen("pancakesDoneness");
        } else {
          showT3Screen("beefMenu");
        }
      });
    }

    // =========================================================================
    // PANCAKES MODE INTERACTION HANDLERS (FIGMA 3198:22586, 3317:32565, 3299:23383, 3299:23427, 3299:22874)
    // =========================================================================
    const pancakeTiles = [
      { el: els.t3TileDoneness, view: "doneness" },
      { el: els.t3TileBurner, view: "burner" },
      { el: els.t3TileTips, view: "tips" },
      { el: els.t3TileCookware, view: "cookware" }
    ];

    pancakeTiles.forEach(tile => {
      if (tile.el) {
        tile.el.addEventListener("click", (e) => {
          e.stopPropagation();
          playSound("touch");
          showT3PancakesView(tile.view);
        });
      }
    });

    // Cooking Tips Segmented Control Tabs (Instructions vs Ingredients)
    if (els.t3TipsTabInstructions) {
      els.t3TipsTabInstructions.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        showT3PancakesView("tips");
      });
    }

    if (els.t3TipsTabIngredients) {
      els.t3TipsTabIngredients.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        showT3PancakesView("ingredients");
      });
    }

    // =========================================================================
    // NATURAL INERTIA CAROUSEL HELPER (FIGMA 3409:25294 & 3422:25402)
    // Supports natural drag-scroll + momentum deceleration (stops at any point)
    // =========================================================================
    function setupNaturalInertiaCarousel(carouselEl, dots, onSelectIdx) {
      if (!carouselEl) return null;
      let isDragging = false;
      let hasDragged = false;
      let startX = 0;
      let scrollStart = 0;
      let velocitySamples = [];
      let momentumRaf = null;

      const CARD_WIDTH = 320;
      const CARD_GAP = 24;
      const STEP = CARD_WIDTH + CARD_GAP; // 344px

      const cancelMomentum = () => {
        if (momentumRaf) {
          cancelAnimationFrame(momentumRaf);
          momentumRaf = null;
        }
      };

      const updateDots = () => {
        if (!dots || dots.length === 0) return;
        const currentIdx = Math.max(0, Math.min(dots.length - 1, Math.round(carouselEl.scrollLeft / STEP)));
        dots.forEach((dot, dotIdx) => {
          dot.classList.toggle("is-active", dotIdx === currentIdx);
        });
      };

      const onStart = (clientX) => {
        if (isDragging) return;
        cancelMomentum();
        isDragging = true;
        hasDragged = false;
        startX = clientX;
        scrollStart = carouselEl.scrollLeft;
        velocitySamples = [{ x: clientX, t: performance.now() }];
      };

      const onMove = (clientX) => {
        if (!isDragging) return;
        const now = performance.now();
        const diff = clientX - startX;
        if (Math.abs(diff) > 5) {
          hasDragged = true;
        }
        carouselEl.scrollLeft = scrollStart - diff;
        updateDots();
        velocitySamples.push({ x: clientX, t: now });

        const cutoff = now - 80;
        while (velocitySamples.length > 1 && velocitySamples[0].t < cutoff) {
          velocitySamples.shift();
        }
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        if (hasDragged) {
          const now = performance.now();
          const cutoff = now - 80;
          while (velocitySamples.length > 1 && velocitySamples[0].t < cutoff) {
            velocitySamples.shift();
          }

          let velocity = 0;
          if (velocitySamples.length >= 2) {
            const first = velocitySamples[0];
            const last = velocitySamples[velocitySamples.length - 1];
            const dt = last.t - first.t;
            if (dt > 8) {
              velocity = -(last.x - first.x) / dt; // px/ms
            }
          }

          const MAX_VELOCITY = 2.4;
          velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));

          if (Math.abs(velocity) > 0.08) {
            let lastTime = performance.now();
            const friction = 0.94; // Deceleration rate per frame

            const momentumStep = (currentTime) => {
              const dt = Math.min(32, Math.max(8, currentTime - lastTime));
              lastTime = currentTime;

              const decay = Math.pow(friction, dt / 16.67);
              velocity *= decay;

              carouselEl.scrollLeft += velocity * dt;
              updateDots();

              const maxScroll = carouselEl.scrollWidth - carouselEl.clientWidth;
              if (carouselEl.scrollLeft <= 0) {
                carouselEl.scrollLeft = 0;
                velocity = 0;
              } else if (carouselEl.scrollLeft >= maxScroll) {
                carouselEl.scrollLeft = maxScroll;
                velocity = 0;
              }

              if (Math.abs(velocity) > 0.015) {
                momentumRaf = requestAnimationFrame(momentumStep);
              } else {
                momentumRaf = null;
                updateDots();
              }
            };

            momentumRaf = requestAnimationFrame(momentumStep);
          }

          setTimeout(() => {
            hasDragged = false;
          }, 80);
        }
      };

      // Mouse drag event listeners
      carouselEl.addEventListener("mousedown", (e) => onStart(e.clientX));
      window.addEventListener("mousemove", (e) => onMove(e.clientX));
      window.addEventListener("mouseup", () => onEnd());

      // Pointer drag event listeners
      carouselEl.addEventListener("pointerdown", (e) => onStart(e.clientX));
      window.addEventListener("pointermove", (e) => onMove(e.clientX));
      window.addEventListener("pointerup", () => onEnd());
      window.addEventListener("pointercancel", () => onEnd());

      // Touch drag event listeners
      carouselEl.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches.length > 0) onStart(e.touches[0].clientX);
      }, { passive: true });
      window.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches.length > 0) onMove(e.touches[0].clientX);
      }, { passive: true });
      window.addEventListener("touchend", () => onEnd());

      carouselEl.addEventListener("scroll", () => {
        if (!isDragging && !momentumRaf) {
          updateDots();
        }
      }, { passive: true });

      // Click dots to scroll smoothly to that card
      if (dots) {
        dots.forEach((dot, dotIdx) => {
          dot.addEventListener("click", (e) => {
            e.stopPropagation();
            cancelMomentum();
            playSound("touch");
            carouselEl.scrollTo({ left: dotIdx * STEP, behavior: "smooth" });
            if (onSelectIdx) onSelectIdx(dotIdx);
          });
        });
      }

      // Initial sync of dots
      updateDots();

      return {
        get hasDragged() { return hasDragged; },
        cancelMomentum,
        updateDots,
        scrollToIdx(idx, smooth = true) {
          cancelMomentum();
          carouselEl.scrollTo({ left: idx * STEP, behavior: smooth ? "smooth" : "auto" });
          updateDots();
        }
      };
    }

    // Doneness Cards Carousel Selection (Figma 3409:25294)
    const pancakeDonenessCards = Array.from(document.querySelectorAll("#t3PancakesDonenessCarousel .t3-pancakes-card"));
    const pancakeDonenessDots = Array.from(document.querySelectorAll("#t3PancakesDonenessDots .t3-pancakes-dot"));

    const donenessScroller = setupNaturalInertiaCarousel(els.t3PancakesDonenessCarousel, pancakeDonenessDots, (dotIdx) => {
      if (pancakeDonenessCards[dotIdx]) {
        selectDonenessCard(pancakeDonenessCards[dotIdx], dotIdx, false);
      }
    });

    function selectDonenessCard(card, idx, smoothScroll = true) {
      pancakeDonenessCards.forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      currentPancakeDoneness = card.dataset.doneness || "Fluffy";
      if (els.t3PancakesValDoneness) els.t3PancakesValDoneness.textContent = currentPancakeDoneness;

      pancakeDonenessDots.forEach((dot, dotIdx) => {
        dot.classList.toggle("is-active", dotIdx === idx);
      });

      if (smoothScroll && donenessScroller) {
        donenessScroller.scrollToIdx(idx, true);
      }
    }

    pancakeDonenessCards.forEach((card, idx) => {
      card.addEventListener("click", (e) => {
        if (donenessScroller && donenessScroller.hasDragged) return;
        e.stopPropagation();
        playSound("touch");
        selectDonenessCard(card, idx, true);
      });
    });

    // Cookware Cards Carousel Selection (Figma 3422:25402)
    const pancakeCookwareCards = Array.from(document.querySelectorAll("#t3PancakesCookwareCarousel .t3-pancakes-card"));
    const pancakeCookwareDots = Array.from(document.querySelectorAll("#t3PancakesCookwareDots .t3-pancakes-dot"));

    const cookwareScroller = setupNaturalInertiaCarousel(els.t3PancakesCookwareCarousel, pancakeCookwareDots, (dotIdx) => {
      if (pancakeCookwareCards[dotIdx]) {
        selectCookwareCard(pancakeCookwareCards[dotIdx], dotIdx, false);
      }
    });

    function selectCookwareCard(card, idx, smoothScroll = true) {
      pancakeCookwareCards.forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      const rawCookware = card.dataset.cookware || "Cast Iron";
      const tileText = (rawCookware === "Stainless" || rawCookware === "Stainless Steel") ? "Stainless" : rawCookware;
      currentPancakeCookware = rawCookware === "Stainless" ? "Stainless Steel" : rawCookware;
      if (els.t3PancakesValCookware) {
        els.t3PancakesValCookware.textContent = tileText;
      }
      if (els.t3TileCookware) {
        els.t3TileCookware.setAttribute("aria-label", `Cookware: ${tileText}`);
      }

      // Also update Cookware value in Tips prep details
      const tipsCookwareVal = document.querySelector("#t3TipsPanelInstructions .t3-prep-item:last-child .t3-prep-val");
      if (tipsCookwareVal) tipsCookwareVal.textContent = currentPancakeCookware;

      pancakeCookwareDots.forEach((dot, dotIdx) => {
        dot.classList.toggle("is-active", dotIdx === idx);
      });

      if (smoothScroll && cookwareScroller) {
        cookwareScroller.scrollToIdx(idx, true);
      }
    }

    pancakeCookwareCards.forEach((card, idx) => {
      card.addEventListener("click", (e) => {
        if (cookwareScroller && cookwareScroller.hasDragged) return;
        e.stopPropagation();
        playSound("touch");
        selectCookwareCard(card, idx, true);
      });
    });

    // Ingredients Checklist Toggling
    const ingredientItems = document.querySelectorAll(".t3-ingredient-item");
    ingredientItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        item.classList.toggle("is-checked");
      });
    });

    // Add to List & Cart buttons
    const btnAddToList = document.getElementById("t3BtnAddToList");
    const btnCart = document.getElementById("t3BtnCart");
    if (btnAddToList) {
      btnAddToList.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }
    if (btnCart) {
      btnCart.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }

    // Cookware Info button
    const btnCookwareInfo = document.getElementById("t3BtnCookwareInfo");
    if (btnCookwareInfo) {
      btnCookwareInfo.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
      });
    }

    // START Buttons (Doneness, Burner, Cookware)
    [els.t3BtnStartPancakesDoneness, els.t3BtnStartPancakesBurner, els.t3BtnStartPancakesCookware].forEach(btn => {
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          lastPancakesStage = (t3Stage && t3Stage.startsWith("pancakes") && t3Stage !== "pancakesPreheat") ? t3Stage : "pancakesCookware";
          startT3PancakesPreheat();
        });
      }
    });

    // Pancakes Preheat screen back & edit hotspot (Figma 3299:24045)
    if (els.t3BtnBackFromPancakesPreheat) {
      els.t3BtnBackFromPancakesPreheat.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPancakesLocked()) return;
        playSound("touch");
        clearT3Timers();
        const isRearLeftActive = Boolean(
          knobsState[1] && Math.abs(knobsState[1].angle) > 12 &&
          currentT3BurnerLevels[2] !== "off"
        );
        if (isRearLeftActive) {
          showT3Screen("burnerStatus");
        } else {
          showT3Screen("start");
        }
      });
    }
    // Rear Left temperature-mode tag on the Pancakes screen: editable at any stage. Opens the
    // temperature editor (tempRun) for burner 2 and returns to this Pancakes screen afterwards.
    const rlHotspot = document.getElementById("t3PancakesRLHotspot");
    if (rlHotspot) {
      rlHotspot.addEventListener("click", (e) => {
        e.stopPropagation();
        const rlOn = els.t3PancakesRLTexts && !els.t3PancakesRLTexts.hidden &&
          currentT3BurnerLevels[2] !== "off";
        if (!rlOn) return;
        playSound("touch");
        tempRunReturnStage = "pancakesPreheat";
        state.task3TargetTemp = t3BurnerTargetTemps[2] || 500;
        showT3Screen("tempRun");
      });
    }

    // Pancakes running tile / edit hotspot are info-only after START (like all food & technique
    // tags): no tap-to-edit. Only the Rear Left temperature-mode tag reopens its settings.
    // The chef hat button below stays functional and opens step-by-step guided cooking.

    // Chef hat icon button on preheat tile -> Start Guided Cooking (Figma 3345:37922 & 3320:34573 -> 3321:34955)
    // Works BOTH when preheat is running (Figma 3299:24045) AND when preheat is done (Figma 3299:24163)
    if (els.t3PancakesChefBtn) {
      let lastChefTrigger = 0;
      const triggerGuidedCooking = (e) => {
        const now = Date.now();
        if (now - lastChefTrigger < 350) return;
        lastChefTrigger = now;
        if (e) {
          e.stopPropagation();
        }
        playSound("toggleOn");
        const isPreheatDone = !!(els.t3PancakesBurnerTile && els.t3PancakesBurnerTile.classList.contains("is-reached"));
        const initialStep = isPreheatDone ? 1 : 0;
        startGuidedCooking(initialStep);
      };
      els.t3PancakesChefBtn.addEventListener("click", triggerGuidedCooking);
      els.t3PancakesChefBtn.addEventListener("touchend", triggerGuidedCooking);
    }

    // Guided cooking back & exit buttons
    if (els.t3GuidedBackBtn) {
      els.t3GuidedBackBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exitGuidedCooking();
      });
    }
    if (els.t3GuidedExitBtn) {
      els.t3GuidedExitBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exitGuidedCooking();
      });
    }

    // Setup drag/touch horizontal scroll for guided cards viewport
    setupGuidedCardsScroll();

    // Step cards click to switch steps
    if (els.t3GuidedCards && els.t3GuidedCards.length > 0) {
      els.t3GuidedCards.forEach((card) => {
        card.addEventListener("click", (e) => {
          if (hasCardDragged) {
            e.stopPropagation();
            return;
          }
          if (e.target.closest("#t3GuidedStartTimer2") || e.target.closest("#t3GuidedStartTimer3")) {
            return;
          }
          e.stopPropagation();
          const targetStep = parseInt(card.getAttribute("data-step"), 10);
          if (!isNaN(targetStep) && targetStep !== t3GuidedStep) {
            clearT3GuidedTimers();
            setGuidedStep(targetStep, false);
            playSound("touch");
          }
        });
      });
    }

    // Step 0: Preheating button -> click skips preheat and advances to Step 1
    if (els.t3GuidedBtnPreheating) {
      els.t3GuidedBtnPreheating.addEventListener("click", (e) => {
        e.stopPropagation();
        clearT3GuidedTimers();
        playSound("toggleOn");
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.add("is-reached");
        }
        if (els.t3PancakesPreheatTemp) {
          els.t3PancakesPreheatTemp.textContent = "400°F";
        }
        setGuidedStep(1, false);
      });
    }

    // Step 1, 2, 3: Next button
    if (els.t3GuidedBtnNext) {
      els.t3GuidedBtnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        clearT3GuidedTimers();
        const nextStep = Math.min(4, t3GuidedStep + 1);
        setGuidedStep(nextStep, false);
      });
    }

    // Step 2 & 3: Inside-card Start Timer buttons
    if (els.t3GuidedStartTimer2) {
      els.t3GuidedStartTimer2.addEventListener("click", (e) => {
        e.stopPropagation();
        startGuidedTimer(2);
      });
    }
    if (els.t3GuidedStartTimer3) {
      els.t3GuidedStartTimer3.addEventListener("click", (e) => {
        e.stopPropagation();
        startGuidedTimer(3);
      });
    }

    // Step 2 & 3: Cooking... button skips timer and restores Next
    if (els.t3GuidedBtnCooking) {
      els.t3GuidedBtnCooking.addEventListener("click", (e) => {
        e.stopPropagation();
        clearT3GuidedTimers();
        playSound("toggleOn");
        setGuidedStep(t3GuidedStep, false);
      });
    }

    // Step 4: Done -> shows Enjoy modal (Figma 3451:25661)
    if (els.t3GuidedBtnDone4) {
      els.t3GuidedBtnDone4.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        if (els.t3GuidedDoneModal) {
          els.t3GuidedDoneModal.hidden = false;
        }
      });
    }

    // Step 4: + Start Next One -> shows modal dialog (Figma 3330:37455)
    if (els.t3GuidedBtnStartNext4) {
      els.t3GuidedBtnStartNext4.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        if (els.t3GuidedNextModal) {
          els.t3GuidedNextModal.hidden = false;
        }
      });
    }

    // Done Modal: Done button returns to running burner screen (Figma 3299:24163)
    if (els.t3GuidedDoneModalBtn) {
      els.t3GuidedDoneModalBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        clearT3GuidedTimers();
        if (els.t3GuidedDoneModal) {
          els.t3GuidedDoneModal.hidden = true;
        }
        showT3Screen("pancakesPreheat");
        if (els.t3PancakesBurnerTile) {
          els.t3PancakesBurnerTile.classList.add("is-reached");
        }
        if (els.t3PancakesPreheatTemp) {
          els.t3PancakesPreheatTemp.textContent = "400°F";
        }
        currentT3BurnerLevels[1] = "prc";
        updateScreenBadge("pancakesPreheat");
        updateCooktopActiveState();
        updateNavbarState();
      });
    }

    // Done Modal: Backdrop click
    if (els.t3GuidedDoneModal) {
      els.t3GuidedDoneModal.addEventListener("click", (e) => {
        if (e.target === els.t3GuidedDoneModal) {
          els.t3GuidedDoneModal.hidden = true;
        }
      });
    }

    // Start Next Modal: Cancel
    if (els.t3GuidedNextModalCancel) {
      els.t3GuidedNextModalCancel.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        if (els.t3GuidedNextModal) {
          els.t3GuidedNextModal.hidden = true;
        }
      });
    }

    // Start Next Modal: Yes, start next -> pan already hot, start at Step 1 (Figma 3321:35633)
    if (els.t3GuidedNextModalConfirm) {
      els.t3GuidedNextModalConfirm.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("toggleOn");
        if (els.t3GuidedNextModal) {
          els.t3GuidedNextModal.hidden = true;
        }
        startGuidedCooking(1);
      });
    }

    // Start Next Modal: Backdrop click
    if (els.t3GuidedNextModal) {
      els.t3GuidedNextModal.addEventListener("click", (e) => {
        if (e.target === els.t3GuidedNextModal) {
          els.t3GuidedNextModal.hidden = true;
        }
      });
    }

    // Drawer Header Back Button (< Burners | Pancakes)
    if (els.t3BtnBackFromPancakes) {
      els.t3BtnBackFromPancakes.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        t3Stage = "foodOptions";
        updateScreenBadge("foodOptions");
        t3FoodCards.forEach(c => c.classList.remove("is-selected"));
        if (els.topStatus) {
          els.topStatus.hidden = true;
        }
        updateCooktopActiveState();
        updateNavbarState();
        slideTransition(els.t3ScreenPancakes, els.t3ScreenFoodOptions, "right");
      });
    }

    // Food Burner Status Screen (Figma 2327:15934)
    if (els.t3BtnBackFromFoodBurnerStatus) {
      els.t3BtnBackFromFoodBurnerStatus.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("start");
      });
    }
    if (els.t3HotspotFrontLeftBurner) {
      els.t3HotspotFrontLeftBurner.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("beefMenu");
      });
    }
    if (els.t3HotspotRearLeftBurner) {
      els.t3HotspotRearLeftBurner.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("tempRun");
      });
    }

    // Home, Cooktop & Back navbar buttons share onNavReturn below (a second Home listener used to
    // run the same back-navigation twice on mouse click, leaving a blank screen).
    const navBack = document.getElementById("navBackBtn");
    const navCooktop = document.getElementById("navCooktopBtn");
    const navHome = document.getElementById("navHomeBtn");

    const onNavReturn = (e) => {
      if (e) e.preventDefault();
      // Pancakes preheating: only the Back caret is locked (knob OFF is the only way back to settings)
      if (isPancakesLocked() && e && e.currentTarget && e.currentTarget.id === "navBackBtn") return;
      // Cooktop while pancakes is running: this overview already is the Cooktop screen, so stay here
      // (going to the plain Burners screen would drop the Pancakes tile and allow re-setup).
      if (isPancakesLocked() && e && e.currentTarget && e.currentTarget.id === "navCooktopBtn") {
        playSound("touch");
        return;
      }
      t3NavSeq++;
      playSound("touch");
      if (tempRunReturnStage === "pancakesPreheat" && (t3Stage === "tempRun" || t3Stage === "digipad")) {
        returnFromTempRunToPancakes(false);
        return;
      }
      if (state.currentTask === 3 && t3Stage !== "start") {
        if (t3Stage === "selectCookware") {
          if (typeof transitionCookwareToTemperature === "function") {
            transitionCookwareToTemperature();
            return;
          }
        }
        if (t3Stage === "pancakesPreheat") {
          clearT3Timers();
          const isRearLeftActive = Boolean(
            knobsState[1] && Math.abs(knobsState[1].angle) > 12 &&
            currentT3BurnerLevels[2] !== "off"
          );
          if (isRearLeftActive) {
            showT3Screen("burnerStatus");
          } else {
            showT3Screen("start");
          }
          return;
        }
        if (t3Stage === "guidedCooking") {
          exitGuidedCooking();
          return;
        }
        if (t3Stage && t3Stage.startsWith("pancakes")) {
          showT3Screen("foodOptions");
          return;
        }
        cancelT3A(false);
      } else if (state.currentTask === 2) {
        showT2Explore(true);
      }
      closeDrawer();
    };

    [navBack, navCooktop, navHome].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener("click", onNavReturn);
      btn.addEventListener("touchstart", onNavReturn, { passive: false });
    });

    // Scale Switcher (Physical 1:1 for iPad Pro 13" vs 100% Canvas)
    if (els.btnScalePhysical) {
      els.btnScalePhysical.addEventListener("click", () => setAppScale(0.8146, "physical"));
    }
    if (els.btnScaleNative) {
      els.btnScaleNative.addEventListener("click", () => setAppScale(1.0, "native"));
    }

    // TEST MODE: hide researcher toolbar, screen jumper and footer; keep only HMI screen + knobs.
    // Turn on: Test Mode button (or open the link with ?test=1). Stays on after reload.
    // Turn off: triple-tap the top-right corner of the page, or press Esc on a keyboard.
    (function setupTestMode() {
      const btn = document.getElementById("btnTestMode");
      const exitHotspot = document.getElementById("testModeExitHotspot");
      const hint = document.getElementById("testModeHint");
      let hintTimer = null;

      function showHint(text) {
        if (!hint) return;
        hint.textContent = text;
        hint.classList.add("is-visible");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hint.classList.remove("is-visible"), 2500);
      }

      function setTestMode(on, announce = true) {
        document.body.classList.toggle("is-test-mode", on);
        if (btn) btn.classList.toggle("is-active", on);
        try { localStorage.setItem("polaris_test_mode", on ? "1" : "0"); } catch (e) {}
        if (announce) {
          showHint(on ? "Test mode on · triple-tap top-right corner to exit" : "Test mode off");
        }
      }
      window.setTestMode = setTestMode;

      if (btn) {
        btn.addEventListener("click", () => setTestMode(!document.body.classList.contains("is-test-mode")));
      }

      if (exitHotspot) {
        let taps = [];
        exitHotspot.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          const now = Date.now();
          taps = taps.filter(t => now - t < 1200);
          taps.push(now);
          if (taps.length >= 3) {
            taps = [];
            setTestMode(false);
          }
        });
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("is-test-mode")) {
          setTestMode(false);
        }
      });

      // Initial state: ?test=1 / ?test=0 in the URL wins, otherwise the last saved choice.
      let initial = false;
      const param = new URLSearchParams(location.search).get("test");
      if (param === "1" || param === "0") {
        initial = param === "1";
      } else {
        try { initial = localStorage.getItem("polaris_test_mode") === "1"; } catch (e) {}
      }
      setTestMode(initial, false);
    })();
    // Screen Jumper & Screen Badge Copy
    if (els.screenJumperSelect) {
      els.screenJumperSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const [taskPrefix, stage] = val.split(":");
        if (taskPrefix === "t3") {
          if (state.currentTask !== 3) {
            setTask(3);
          }
          if (stage === "burnerStatus") {
            setKnobAngle(2, -56, false, false);
            [1, 3, 4, 5].forEach(i => setKnobAngle(i, 0, false, false));
            showT3Screen("burnerStatus");
          } else if (stage === "start") {
            state.task3Mode = "temp";
            [1, 2, 3, 4, 5].forEach(i => setKnobAngle(i, 0, false, false));
            showT3Screen("start");
          } else if (stage === "foodBurnerStatus") {
            state.task3Mode = "food";
            setKnobAngle(2, -56, false, false);
            setKnobAngle(1, -56, false, false);
            showT3Screen("foodBurnerStatus");
          } else if (stage === "beefMenu" || stage === "beefmenu") {
            state.task3Mode = "food";
            setKnobAngle(2, -56, false, false);
            showT3Screen("beefMenu");
          } else if (stage === "turnknob") {
            showT3Screen("turnknob");
          } else if (stage === "temperature") {
            showT3Screen("temperature");
            requestAnimationFrame(() => scrollToT3Temp(state.task3TargetTemp || 350, false));
          } else if (stage === "digipad") {
            openT3Digipad();
          } else if (stage === "preheat") {
            showT3Screen("preheat");
          } else if (stage === "completed") {
            showT3Screen("completed");
            if (els.t3ToastPreheatComplete) els.t3ToastPreheatComplete.classList.add("is-visible");
          } else if (stage === "tempRun") {
            showT3Screen("tempRun");
          } else if (stage === "techniquePreheat") {
            setKnobAngle(4, -56, false, false);
            [1, 2, 3, 5].forEach(i => setKnobAngle(i, 0, false, false));
            startT3TechniquePreheat("Caramelize");
          } else if (stage === "techniqueComplete") {
            setKnobAngle(4, -56, false, false);
            [1, 2, 3, 5].forEach(i => setKnobAngle(i, 0, false, false));
            showT3Screen("techniqueComplete");
          } else if (stage.startsWith("pancakes")) {
            state.task3Mode = "food";
            if (stage === "pancakesPreheat") {
              startT3PancakesPreheat();
            } else if (stage === "pancakesPreheatDone") {
              clearT3Timers();
              showT3Screen("pancakesPreheat");
              state.task3TargetTemp = 400;
              state.task3IsRunning = true;
              if (els.t3PancakesPreheatTemp) {
                els.t3PancakesPreheatTemp.textContent = "400°F";
              }
              if (els.t3PancakesBurnerTile) {
                els.t3PancakesBurnerTile.classList.add("is-reached");
              }
              updateScreenBadge();
            } else {
              showT3Screen(stage);
            }
          } else if (stage === "guidedCooking") {
            state.task3Mode = "food";
            startGuidedCooking(1);
          } else {
            showT3Screen(stage);
          }
        } else if (taskPrefix === "t2") {
          if (state.currentTask !== 2) {
            setTask(2);
          }
          if (stage === "explore") {
            showT2Explore();
          } else {
            showT2Precision(stage);
          }
        } else if (taskPrefix === "t1") {
          if (state.currentTask !== 1) {
            setTask(1);
          }
        }
      });
    }

    if (els.screenBadgeContainer) {
      const copyScreenId = (e) => {
        if (e && e.type === "touchstart") {
          e.preventDefault();
        }
        const text = detectCurrentVisibleScreen();
        if (els.screenBadgePill) {
          els.screenBadgePill.textContent = text;
        }
        if (text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {
              fallbackCopy(text);
            });
          } else {
            fallbackCopy(text);
          }
          if (els.screenCopyHint) {
            els.screenCopyHint.classList.add("is-shown");
            setTimeout(() => {
              if (els.screenCopyHint) els.screenCopyHint.classList.remove("is-shown");
            }, 1200);
          }
        }
      };

      const fallbackCopy = (str) => {
        try {
          const ta = document.createElement("textarea");
          ta.value = str;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (err) {}
      };

      els.screenBadgeContainer.addEventListener("click", copyScreenId);
      els.screenBadgeContainer.addEventListener("touchend", copyScreenId);
    }
  }

  // RUNNING ACTIVITY BAR RUNNER (Guarantees active liquid flow even if Safari CSS animation is throttled)
  function initRunningActivityBar() {
    const runners = document.querySelectorAll(".activity-bar-runner");
    if (!runners.length) return;

    let offset = -1024;
    let lastTime = performance.now();
    const speed = 1024 / 2.8; // 1024px every 2.8s (~365.7px/s)

    function loop(now) {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      if (delta > 0 && delta < 0.2) {
        offset += speed * delta;
        if (offset >= 0) offset -= 1024;
        for (let i = 0; i < runners.length; i++) {
          runners[i].style.setProperty("--runner-offset", `${offset.toFixed(2)}px`);
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // TOUCH & GESTURE LOCKDOWN (PREVENTS ENLARGING & SHIFTING ON IPAD / TOUCH DEVICES)
  function initGestureLockdown() {
    // 1. Block Safari gesturestart/gesturechange/gestureend (pinch-to-zoom)
    ["gesturestart", "gesturechange", "gestureend"].forEach(name => {
      document.addEventListener(name, (e) => {
        e.preventDefault();
      }, { passive: false });
    });

    // 2. Block multi-touch gestures (2+ fingers zoom/pinch)
    document.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // 3. Block viewport dragging / bounce / shifting outside dedicated scrollable tracks
    document.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      const targetEl = (e.target instanceof Element) ? e.target : (e.target && e.target.parentElement);
      if (!targetEl) {
        e.preventDefault();
        return;
      }

      // Check explicit known scrollable containers and tracks
      const scrollable = typeof targetEl.closest === "function" ? targetEl.closest(
        ".t3-guided-cards-viewport, .t3-guided-cards-track, .t3-guided-card, " +
        ".t3-cookware-carousel-viewport, .t3-pancakes-cards-carousel, .t3-pancakes-drawer-tiles, " +
        ".t3-beef-drawer-tiles, .t3-beef-carousel, .t3-tips-steps-scroll, .t3-ingredients-scroll, " +
        ".t3-tech-scroll-container, .t3-recent-container, " +
        ".t3-picker-track, .t2-picker-track, .t2-options-scroll-container, .t2-tile-scroll-container, " +
        ".t3-options-scroll-container, .t3-drawer-scrollable-options, .t3-doneness-carousel, " +
        ".t3-recipe-cards-track, .t3-food-scroll-container, [data-scrollable='true']"
      ) : null;

      if (scrollable) {
        return; // Allow native/touch scrolling
      }

      // Dynamic check for any overflow container that can scroll
      let el = targetEl;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const ox = style.overflowX;
        const oy = style.overflowY;
        if (
          ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth) ||
          ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight)
        ) {
          return; // Allow touch scrolling
        }
        el = el.parentElement;
      }

      e.preventDefault();
    }, { passive: false });

    // 4. Block double-tap to zoom
    let lastTouchEndTime = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEndTime <= 300) {
        const targetEl = (e.target instanceof Element) ? e.target : (e.target && e.target.parentElement);
        const isClickable = targetEl && typeof targetEl.closest === "function" ? targetEl.closest(
          "button, select, input, a, [role='button'], .task-btn, .scale-btn, " +
          ".t3-guided-card, .t3-doneness-card, .t3-beef-card, .t3-option-card, .t2-buttontile, .t3-tile"
        ) : false;
        if (!isClickable) {
          e.preventDefault();
        }
      }
      lastTouchEndTime = now;
    }, { passive: false });

    // 5. Block double-click zoom
    document.addEventListener("dblclick", (e) => {
      e.preventDefault();
    }, { passive: false });

    // 6. Block long-press context menu / callout loupe
    window.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  // INIT
  const savedScaleMode = localStorage.getItem("polaris_app_scale_mode") || "physical";
  if (savedScaleMode === "native") {
    setAppScale(1.0, "native");
  } else {
    setAppScale(0.8146, "physical");
  }
  setupListeners();
  initGestureLockdown();
  initRunningActivityBar();
  initScreenObserver();

  // Focus exclusively on Task 3 (Task 1 & Task 2 hidden from display)
  const urlParams = new URLSearchParams(window.location.search);
  const taskFromParam = parseInt(urlParams.get("task"), 10);
  const taskFromHash = window.location.hash === "#task3" ? 3 : window.location.hash === "#task2" ? 2 : window.location.hash === "#task1" ? 1 : null;
  const taskFromStorage = parseInt(localStorage.getItem("polaris_active_task"), 10);
  let initialTask = taskFromParam || taskFromHash || taskFromStorage || 3;
  if (initialTask === 1 || initialTask === 2) {
    initialTask = 3; // Focus exclusively on Task 3
  }
  setTask(initialTask);

  window.__polaris = {
    state,
    knobsState,
    setKnobAngle,
    setTask,
    showT3Screen,
    showT3PancakesView,
    updateT3BurnerFromKnob,
    showT2Precision,
    setT2Tab,
    updateScreenBadge,
    updateCooktopActiveState,
    ensureNavbarVisible,
    updateNavbarState,
    scrollToT3Temp,
    scrollToT3RunTemp,
    playSound,
    playTickSound,
    resetTickQueue,
    getAudioCtx: () => audioCtx,
    getAudioBuffers: () => audioBuffers,
    get t3Stage() { return t3Stage; },
    set t3Stage(val) { t3Stage = val; },
    get activePrcKnobIndex() { return activePrcKnobIndex; },
    set activePrcKnobIndex(val) { activePrcKnobIndex = val; },
    t3BurnerTargetTemps,
    currentT3BurnerLevels,
    startT3PreheatCompleted,
    updateFoodBurnerStatusDisplay,
    els
  };
  window.PolarisApp = window.__polaris;
  window.els = els;
  window.knobsState = knobsState;
  window.currentT3BurnerLevels = currentT3BurnerLevels;
  window.updateFoodBurnerStatusDisplay = updateFoodBurnerStatusDisplay;
  window.startT3PreheatCompleted = startT3PreheatCompleted;
  window.t3BurnerTargetTemps = t3BurnerTargetTemps;
  Object.defineProperty(window, "t3Stage", {
    get() { return t3Stage; },
    set(v) { t3Stage = v; },
    configurable: true
  });
  Object.defineProperty(window, "activePrcKnobIndex", {
    get() { return activePrcKnobIndex; },
    set(v) { activePrcKnobIndex = v; },
    configurable: true
  });
})();
