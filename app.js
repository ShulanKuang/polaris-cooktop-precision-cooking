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

  // STATE MANAGEMENT
  const state = {
    currentTask: 1,
    shutterHidden: true,
    shutterTimer: null,
    targetTemp: 375,
    selectedBurner: "rear-left",
    burners: {
      "rear-left": { state: "off", temp: 375, mode: null, label: "OFF" },
      "front-left": { state: "off", temp: null, mode: null, label: "OFF" },
      "center": { state: "off", temp: null, mode: null, label: "OFF" },
      "top-right": { state: "off", temp: null, mode: null, label: "OFF" },
      "front-right": { state: "off", temp: null, mode: null, label: "OFF" }
    },
    task2: {
      screen: "explore", // "explore" or "precision"
      tab: "spotlight",  // "spotlight", "technique", "food", "temperature"
      tempMode: "picker",// "picker" or "digipad"
      temperature: 370,
      digipadBuffer: "370",
      hasEditedKeypad: false
    },
    task3TargetTemp: 375,
    task3BeefType: "Steak",
    task3BeefDoneness: "Med Rare",
    task3BeefThickness: 0.5
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
    t3TemperatureMinimapOverlay: document.getElementById("t3TemperatureMinimapOverlay"),
    t3BtnBackFromTemp: document.getElementById("t3BtnBackFromTemp"),
    t3TabBtnSpotlightFromTemp: document.getElementById("t3TabBtnSpotlightFromTemp"),
    t3TabBtnFoodFromTemp: document.getElementById("t3TabBtnFoodFromTemp"),
    t3PickerWheelContainer: document.getElementById("t3PickerWheelContainer"),
    t3PickerTrack: document.getElementById("t3PickerTrack"),
    t3BtnStartTemp: document.getElementById("t3BtnStartTemp"),
    t3BtnKeypadFromTemp: document.getElementById("t3BtnKeypadFromTemp"),

    // Task 3B: Digital Keypad Screen (Figma 3017:25641)
    t3ScreenDigipad: document.getElementById("t3ScreenDigipad"),
    t3DigipadMinimapOverlay: document.getElementById("t3DigipadMinimapOverlay"),
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
    t3TempRunMinimapOverlay: document.getElementById("t3TempRunMinimapOverlay"),
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
    t3FoodMinimapOverlay: document.getElementById("t3FoodMinimapOverlay"),
    t3BtnBackFromFoodOptions: document.getElementById("t3BtnBackFromFoodOptions"),
    t3TabFoodToSpotlight: document.getElementById("t3TabFoodToSpotlight"),
    t3TabFoodToTemp: document.getElementById("t3TabFoodToTemp"),
    t3BtnFoodBeef: document.getElementById("t3BtnFoodBeef"),

    t3ScreenBeefMenu: document.getElementById("t3ScreenBeefMenu"),
    t3BtnBackFromBeefMenu: document.getElementById("t3BtnBackFromBeefMenu"),
    t3BtnStartBeef: document.getElementById("t3BtnStartBeef"),

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

    t3SubflowControls: document.getElementById("t3SubflowControls"),
    btnT3FlowTemp: document.getElementById("btnT3FlowTemp"),
    btnT3FlowStatus: document.getElementById("btnT3FlowStatus"),
    btnT3FlowFood: document.getElementById("btnT3FlowFood"),
    btnT3FlowTech: document.getElementById("btnT3FlowTech"),
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
      prompt: "Turn any PRC-enabled knob to PRC (1s delay -> 3s countdown toast -> Spotlight). Tap Temperature tab -> pick temp (e.g. 375°F) -> click START. Live 5s preheat -> complete toast -> Burner status. Turn another burner knob to see live level setting animation, or turn to PRC for Food mode."
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
      const screenMap = [
        { el: els.t3ScreenTurnKnob, name: "3A-turnknob" },
        { el: els.t3ScreenSpotlight, name: "3A-spotlight" },
        { el: els.t3ScreenTechnique, name: "3E-technique" },
        { el: els.t3ScreenTechniquePreheat, name: "3E-techniquePreheat" },
        { el: els.t3ScreenTechniqueComplete, name: "3E-techniqueComplete" },
        { el: els.t3ScreenFoodOptions, name: "3C-foodOptions" },
        { el: els.t3ScreenBeefType, name: "3C-beefType" },
        { el: els.t3ScreenBeefDoneness, name: "3C-beefDoneness" },
        { el: els.t3ScreenBeefThickness, name: "3C-beefThickness" },
        { el: els.t3ScreenFoodPreheat, name: "3C-foodPreheat" },
        { el: els.t3ScreenFoodComplete, name: "3C-foodComplete" },
        { el: els.t3ScreenFoodBurnerStatus, name: "3C-foodBurnerStatus" },
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
          return item.name;
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
          digipad: "3B-digipad",
          preheat: "3B-preheat",
          completed: "3B-completed",
          tempRun: "3B-tempRun",
          technique: "3E-technique",
          techniquePreheat: "3E-techniquePreheat",
          techniqueComplete: "3E-techniqueComplete",
          foodOptions: "3C-foodOptions",
          beefType: "3C-beefType",
          beefDoneness: "3C-beefDoneness",
          beefThickness: "3C-beefThickness",
          foodPreheat: "3C-foodPreheat",
          foodComplete: "3C-foodComplete",
          foodBurnerStatus: "3C-foodBurnerStatus"
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
        const opt = els.screenJumperSelect.querySelector(`option[value="${selectVal}"]`);
        if (opt) {
          els.screenJumperSelect.value = selectVal;
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
    if (els.glanceControls) {
      els.glanceControls.hidden = taskId !== 1;
      els.glanceControls.style.display = taskId === 1 ? "flex" : "none";
    }
    if (els.t3SubflowControls) {
      els.t3SubflowControls.hidden = taskId !== 3;
      els.t3SubflowControls.style.display = taskId === 3 ? "flex" : "none";
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
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;

      // Initialize Task 2 to explore view
      showT2Explore(true);
      updateCooktopActiveState();
    } else if (taskId === 3) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = false;
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;

      // Initialize Task 3 to start screen
      showT3Screen("start");
      updateCooktopActiveState();
    } else {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = true;
      if (els.screenRail) els.screenRail.hidden = false;
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
    state.task2.screen = "explore";
    if (els.viewTask2) els.viewTask2.hidden = true;
    if (els.viewTask3) els.viewTask3.hidden = false;
    if (activePrcKnobIndex) {
      setKnobAngle(activePrcKnobIndex, 0, true, true);
    }
    showT3Screen("start");
    updateScreenBadge("explore");
  }

  function showT2Precision(tabName = "spotlight", tempMode = "picker", silent = false) {
    if (!silent) playSound("touch");
    state.task2.screen = "precision";
    if (els.viewTask3) els.viewTask3.hidden = true;
    if (els.viewTask2) els.viewTask2.hidden = false;
    if (els.t2ScreenExplore) els.t2ScreenExplore.hidden = true;
    if (els.t2ScreenPrecision) els.t2ScreenPrecision.hidden = false;
    setT2Tab(tabName, tempMode, true);
    updateCooktopActiveState();
  }

  function setT2Tab(tabName, tempMode = null, silent = false) {
    if (!silent) playSound("touch");
    state.task2.tab = tabName;
    if (tempMode) {
      state.task2.tempMode = tempMode;
    }

    const panels = {
      spotlight: els.t2PanelSpotlight,
      technique: els.t2PanelTechnique,
      food: els.t2PanelFood,
      temperature: els.t2PanelTemperature
    };

    for (const [key, panel] of Object.entries(panels)) {
      if (panel) {
        panel.hidden = (key !== tabName);
      }
    }

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
  const T2_TEMP_STEP = 10;
  let lastTickTemp = 370;

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
  }

  function updateT2PickerVisuals() {
    if (!els.t2PickerTrack) return;
    const trackCenter = els.t2PickerTrack.scrollLeft + (els.t2PickerTrack.clientWidth / 2);
    const items = els.t2PickerTrack.querySelectorAll(".t2-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      // Hierarchy classes
      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      if (dist < 65) {
        // active
      } else if (dist < 195) {
        item.classList.add("is-neighbor-1");
      } else if (dist < 325) {
        item.classList.add("is-neighbor-2");
      }
    });

    if (closestItem) {
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
    const trackCenter = els.t2PickerTrack.scrollLeft + (els.t2PickerTrack.clientWidth / 2);
    const items = els.t2PickerTrack.querySelectorAll(".t2-picker-item");
    let closestTemp = 370;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
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
    const targetItem = els.t2PickerTrack.querySelector(`.t2-picker-item[data-temp="${temp}"]`);
    if (targetItem) {
      const itemCenter = targetItem.offsetLeft + (targetItem.offsetWidth / 2);
      const targetScrollLeft = itemCenter - (els.t2PickerTrack.clientWidth / 2);
      els.t2PickerTrack.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? "smooth" : "auto"
      });
      state.task2.temperature = temp;
      state.task2.digipadBuffer = String(temp);
      if (els.t2DigipadValue) els.t2DigipadValue.textContent = String(temp);
      setTimeout(updateT2PickerVisuals, smooth ? 250 : 50);
    }
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
    if (state.shutterTimer) clearTimeout(state.shutterTimer);
    if (els.task1StandbyCover) {
      els.task1StandbyCover.classList.remove("is-revealed");
      els.task1StandbyCover.style.display = "flex";
    }
    if (state.currentTask === 1 && els.screenRail) {
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
  let activePrcKnobIndex = 1;
  let t3Stage = "start"; // "start" | "turnknob" | "spotlight" | "temperature" | "preheat" | "completed" | "burnerStatus"

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
        t3Stage === "techniqueComplete"
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
    if (els.cooktopHotIndicator) {
      if (state.currentTask === 1) {
        els.cooktopHotIndicator.hidden = true;
        els.cooktopHotIndicator.classList.remove("is-visible");
      } else {
        els.cooktopHotIndicator.hidden = !isActive;
        els.cooktopHotIndicator.classList.toggle("is-visible", isActive);
      }
    }

    // 3. Left Navbar running state
    updateNavbarState();
  }

  function showT3Screen(stage) {
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

    const isStartOverview = (stage === "start");
    if (els.t3ScreenStart) els.t3ScreenStart.hidden = !isStartOverview;
    if (els.t3ScreenTurnKnob) els.t3ScreenTurnKnob.hidden = (stage !== "turnknob");
    if (els.t3ScreenSpotlight) els.t3ScreenSpotlight.hidden = (stage !== "spotlight");
    if (els.t3ScreenTechnique) els.t3ScreenTechnique.hidden = (stage !== "technique");
    if (els.t3ScreenTemperature) els.t3ScreenTemperature.hidden = (stage !== "temperature");
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

    // Top status bar visibility (Figma 2323:15134) - 48px tall status bar on 3C-beefType, doneness, and thickness screens
    const needsTopStatus = (stage === "beefType" || stage === "beefDoneness" || stage === "beefThickness");
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

    // Activity bar & Cooktop Hot indicator are active whenever any knob is turned on or cooking runs
    updateCooktopActiveState();

    if (stage === "completed") {
      const targetTemp = state.task3TargetTemp || 375;
      if (els.t3CompleteTarget) els.t3CompleteTarget.textContent = targetTemp;
    }
    if (stage === "burnerStatus") {
      const targetTemp = state.task3TargetTemp || 375;
      if (els.tStartActiveBurner1) {
        els.tStartActiveBurner1.hidden = false;
        if (els.tStartBurner1Temp) {
          els.tStartBurner1Temp.textContent = `${targetTemp}°F`;
        }
      }
      if (els.t3BurnerStatusTemp) {
        els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
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
    if (stage === "foodBurnerStatus") {
      const targetTemp = state.task3TargetTemp || 375;
      if (els.t3FoodBurnerStatusTemp1) els.t3FoodBurnerStatusTemp1.textContent = `${targetTemp}°F`;
      // In foodBurnerStatus (Figma 2327:15934): BOTH Rear Left and Front Left are running!
      if (!knobsState[1] || Math.abs(knobsState[1].angle) <= 5) setKnobAngle(2, -56, false, false);
      if (!knobsState[0] || Math.abs(knobsState[0].angle) <= 5) setKnobAngle(1, -56, false, false);
      currentT3BurnerLevels[2] = "prc";
      currentT3BurnerLevels[1] = "prc";

      if (els.t3FoodBurnerOffRL) els.t3FoodBurnerOffRL.hidden = true;
      if (els.t3FoodBurnerOffFL) els.t3FoodBurnerOffFL.hidden = true;
      if (els.t3FoodBurnerStatusTempDisplay) els.t3FoodBurnerStatusTempDisplay.style.display = "";
      if (els.t3HotspotRearLeftBurner) els.t3HotspotRearLeftBurner.style.pointerEvents = "auto";
      if (els.t3HotspotFrontLeftBurner) els.t3HotspotFrontLeftBurner.style.pointerEvents = "auto";
    }

    if (stage === "start") {
      const isFoodFlow = (state.task3Mode === "food");
      if (els.tStartActiveBurner1) {
        els.tStartActiveBurner1.hidden = !isFoodFlow;
        if (els.tStartBurner1Temp) {
          els.tStartBurner1Temp.textContent = `${state.task3TargetTemp || 375}°F`;
        }
      }
      clearT3Timers();
      if (!isFoodFlow) {
        [1, 2, 3, 4, 5].forEach(i => {
          setKnobAngle(i, 0, false, false);
          currentT3BurnerLevels[i] = "off";
          resetT3BurnerToOff(i);
        });
        activePrcKnobIndex = null;
      } else {
        // In Food flow, Rear Left is running: Knob 2 stays ON!
        if (!knobsState[1] || Math.abs(knobsState[1].angle) <= 5) {
          setKnobAngle(2, -56, false, false);
        }
        currentT3BurnerLevels[2] = "prc";
        resetT3BurnerToOff(2);
        if (els.t3BurnerRoller2) els.t3BurnerRoller2.classList.remove("is-active");
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
  }

  function resetT3BurnerToOff(i) {
    if (i) {
      cancelT3BurnerArc(i);
    } else {
      [1, 2, 4, 5].forEach(idx => cancelT3BurnerArc(idx));
    }
    const burnerConfigs = {
      1: { roller: els.t3BurnerRoller1, strip: els.t3BurnerStrip1, itemH: 38, baseOffset: 45 },
      2: { roller: els.t3BurnerRoller2, strip: els.t3BurnerStrip2, itemH: 38, baseOffset: 45 },
      3: { roller: els.t3BurnerRoller3, strip: els.t3BurnerStrip3, itemH: 36, baseOffset: 36 },
      4: { roller: els.t3BurnerRoller4, strip: els.t3BurnerStrip4, itemH: 52, baseOffset: 62 },
      5: { roller: els.t3BurnerRoller5, strip: els.t3BurnerStrip5, itemH: 38, baseOffset: 45 }
    };
    const cfg = burnerConfigs[i];
    if (!cfg || !cfg.roller || !cfg.strip) return;
    cfg.strip.style.webkitTransform = `translate3d(0, ${cfg.baseOffset}px, 0)`;
    cfg.strip.style.transform = `translate3d(0, ${cfg.baseOffset}px, 0)`;
    const items = cfg.strip.querySelectorAll(".t3-burner-roller-item");
    items.forEach(it => {
      const idx = parseInt(it.dataset.index, 10);
      it.classList.toggle("is-selected", idx === 0);
    });
    cfg.roller.classList.remove("is-active");
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

      // Begin 2s magenta arc animation from 12 o'clock top point
      rollers.forEach(roller => {
        roller.classList.add("has-arc");
        const arcCircle = roller.querySelector(".t3-burner-prc-arc-circle");
        requestAnimationFrame(() => {
          if (!roller.classList.contains("has-arc")) return;
          roller.classList.add("is-arcing");
          if (arcCircle) {
            arcCircle.style.transition = "stroke-dashoffset 2000ms linear";
            arcCircle.style.strokeDashoffset = "0";
          }
        });
      });

      // Exactly at 2.0s after arc start: arc finishes full circle -> transition to confirmed active state (white background disc with dark thermometer icon)
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
      }, 2000);
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
      currentT3BurnerLevels[1] = "off";
      currentT3BurnerLevels[2] = "off";
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
        } else if (isPRC || isMinToMax) {
          currentT3BurnerLevels[1] = "prc";
        }
      } else if (index === 2) {
        if (isOff) {
          currentT3BurnerLevels[2] = "off";
        } else if (isPRC || isMinToMax) {
          currentT3BurnerLevels[2] = "prc";
        }
      }
      updateFoodBurnerStatusDisplay();
      return;
    }

    // On burnerStatus: Rear Left (Knob 2) is running.
    // If user turns Knob 2 to OFF, turn off Rear Left!
    if (isBurnerStatus && index === 2) {
      if (isOff) {
        currentT3BurnerLevels[2] = "off";
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        updateNavbarState();
      } else if (isPRC) {
        currentT3BurnerLevels[2] = "prc";
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = false;
        updateNavbarState();
      }
      return;
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

    if (t3Stage !== "start" && t3Stage !== "burnerStatus") {
      // If user turns the active knob to OFF while on another Task 3 screen (like Spotlight), cancel back to start
      if (Math.abs(angle) <= 10 && index === activePrcKnobIndex) {
        cancelT3A();
      }
      return;
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

        // Arriving at PRC from a power level (or off):
        // Cancel any pending power confirmation timer or confirmed active status
        cancelT3BurnerArc(targetIndex);
      }
      currentT3BurnerLevels[targetIndex] = "prc";
      activePrcKnobIndex = index;

      // Translate strip to center index 11 (temp icon)
      updateRollersStrip(11);

      if (targetIndex === 1 || targetIndex === 2 || targetIndex === 4 || targetIndex === 5) {
        // Precision Cooking: 1s delay -> 2s Magenta Arc closing up -> 1s delay -> Spotlight
        // No countdown toast
        if (els.t3ToastCard) {
          els.t3ToastCard.classList.remove("is-visible", "is-dismissing");
          els.t3ToastCard.setAttribute("hidden", "");
        }
        const t = t3BurnerArcTimers[targetIndex];
        const isPrcConfirmed = rollers[0].classList.contains("is-confirmed") && rollers[0].classList.contains("is-prc-mode");
        const isPrcArcRunning = t && (t.preArc || t.arc);
        if (!isPrcConfirmed && !isPrcArcRunning) {
          startT3BurnerArc(targetIndex, { transitToSpotlight: true });
        }
      }
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

      updateRollersStrip(0);

      rollers.forEach(r => r.classList.remove("is-active"));
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

  function slideTransition(outgoingScreen, incomingScreen, direction = "left", onComplete) {
    if (!outgoingScreen || !incomingScreen) {
      if (incomingScreen) incomingScreen.hidden = false;
      if (outgoingScreen) outgoingScreen.hidden = true;
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
        outgoingScreen.hidden = true;
        outgoingScreen.style.transition = "";
        outgoingScreen.style.webkitTransition = "";
        outgoingScreen.style.transform = "";
        outgoingScreen.style.webkitTransform = "";
        outgoingScreen.style.opacity = "";
        incomingScreen.style.transition = "";
        incomingScreen.style.webkitTransition = "";
        incomingScreen.style.transform = "";
        incomingScreen.style.webkitTransform = "";
        if (onComplete) onComplete();
      }, 480);
    });
  }

  function transitionToT3Temperature() {
    clearT3Timers();
    dismissPrcTimerAndToast();

    playSound("toggleOn");

    if (t3Stage === "burnerStatus") {
      state.task3Mode = "food";
    }

    if (state.currentTask === 2) {
      showT2Precision("temperature", "picker");
      return;
    }

    // Toggle Front Left active mini-map overlay across precision cooking screens
    const isFrontLeft = (activePrcKnobIndex === 1);
    if (els.t3TemperatureMinimapOverlay) els.t3TemperatureMinimapOverlay.hidden = !isFrontLeft;
    if (els.t3DigipadMinimapOverlay) els.t3DigipadMinimapOverlay.hidden = !isFrontLeft;
    if (els.t3TempRunMinimapOverlay) els.t3TempRunMinimapOverlay.hidden = !isFrontLeft;

    const outgoingScreen = (t3Stage === "burnerStatus" && els.t3ScreenBurnerStatus && !els.t3ScreenBurnerStatus.hidden)
      ? els.t3ScreenBurnerStatus
      : els.t3ScreenStart;

    if (els.t3ScreenTemperature && outgoingScreen) {
      t3Stage = "temperature";
      updateScreenBadge("temperature");
      updateCooktopActiveState();

      requestAnimationFrame(() => {
        scrollToT3Temp(state.task3TargetTemp || 375, false);
      });

      slideTransition(outgoingScreen, els.t3ScreenTemperature, "left", () => {
        scrollToT3Temp(state.task3TargetTemp || 375, false);
      });
    } else {
      showT3Screen("temperature");
      requestAnimationFrame(() => {
        scrollToT3Temp(state.task3TargetTemp || 375, false);
      });
    }
  }

  function transitionToT3FoodOptions(outgoingScreen = null) {
    playSound("touch");
    t3Stage = "foodOptions";
    updateScreenBadge("foodOptions");

    const isFrontLeft = (activePrcKnobIndex === 1);
    if (els.t3FoodMinimapOverlay) els.t3FoodMinimapOverlay.hidden = !isFrontLeft;

    const outScreen = outgoingScreen ||
      (els.t3ScreenTemperature && !els.t3ScreenTemperature.hidden ? els.t3ScreenTemperature :
      (els.t3ScreenDigipad && !els.t3ScreenDigipad.hidden ? els.t3ScreenDigipad :
      (els.t3ScreenTempRun && !els.t3ScreenTempRun.hidden ? els.t3ScreenTempRun :
      (els.t3ScreenBurnerStatus && !els.t3ScreenBurnerStatus.hidden ? els.t3ScreenBurnerStatus : els.t3ScreenStart))));

    slideTransition(outScreen, els.t3ScreenFoodOptions, "left");
  }

  function transitionToT3BeefMenu() {
    t3Stage = "beefMenu";
    updateScreenBadge("beefMenu");
    slideTransition(els.t3ScreenFoodOptions, els.t3ScreenBeefMenu, "left");
  }

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

  let digipadInput = "375";
  let digipadIsFresh = true;
  let digipadSourceScreen = "temperature";

  function openT3Digipad(source = "temperature") {
    digipadSourceScreen = source;
    digipadInput = String(state.task3TargetTemp || 375);
    digipadIsFresh = true;
    if (els.t3DigipadTempNum) {
      els.t3DigipadTempNum.textContent = digipadInput;
    }
    showT3Screen("digipad");
  }

  function closeT3DigipadToPicker() {
    let temp = parseInt(digipadInput, 10);
    if (isNaN(temp) || temp < T3_TEMP_MIN) temp = 375;
    if (temp > T3_TEMP_MAX) temp = 500;
    temp = Math.round(temp / T3_TEMP_STEP) * T3_TEMP_STEP;
    state.task3TargetTemp = temp;
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
    }
  }

  // TASK 3B: PREHEAT DIRECTLY ON BURNER STATUS (FIGMA 2310:12162 & 3051:42542 & 3051:42525)
  function startT3Preheat() {
    clearT3Timers();
    hideT3CompleteToast();
    showT3Screen("burnerStatus");
    playSound("toggleOn");

    const targetTemp = state.task3TargetTemp || 375;
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
    const targetTemp = state.task3TargetTemp || 375;
    if (els.t3TileLiveTemp) {
      els.t3TileLiveTemp.textContent = `${targetTemp}°F`;
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
  function startT3FoodPreheat() {
    clearT3Timers();
    showT3Screen("foodPreheat");
    playSound("toggleOn");

    const targetTemp = 375;
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

    const targetTemp = state.task3TargetTemp || 375;
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

  function cancelT3A() {
    clearT3Timers();
    dismissPrcTimerAndToast();
    const knobToReset = activePrcKnobIndex || 1;

    const activeScreen = (els.t3ScreenTemperature && !els.t3ScreenTemperature.hidden)
      ? els.t3ScreenTemperature
      : (els.t3ScreenSpotlight && !els.t3ScreenSpotlight.hidden ? els.t3ScreenSpotlight : null);

    if (activeScreen && els.t3ScreenStart) {
      t3Stage = "start";
      updateScreenBadge("start");
      updateCooktopActiveState();

      // 1. Prepare start screen positioned slightly to the left (-25%) with opacity 0.4
      els.t3ScreenStart.hidden = false;
      els.t3ScreenStart.style.transition = "none";
      els.t3ScreenStart.style.webkitTransition = "none";
      els.t3ScreenStart.style.transform = "translate3d(-25%, 0, 0)";
      els.t3ScreenStart.style.webkitTransform = "translate3d(-25%, 0, 0)";
      els.t3ScreenStart.style.opacity = "0.4";
      els.t3ScreenStart.style.zIndex = "100";

      // 2. Active screen is visible at (0, 0, 0)
      activeScreen.hidden = false;
      activeScreen.style.transition = "none";
      activeScreen.style.webkitTransition = "none";
      activeScreen.style.transform = "translate3d(0, 0, 0)";
      activeScreen.style.webkitTransform = "translate3d(0, 0, 0)";
      activeScreen.style.zIndex = "110";

      void activeScreen.offsetWidth;
      void els.t3ScreenStart.offsetWidth;

      requestAnimationFrame(() => {
        const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
        const dur = "0.40s";

        activeScreen.style.transition = `transform ${dur} ${ease}`;
        activeScreen.style.webkitTransition = `-webkit-transform ${dur} ${ease}`;
        activeScreen.style.transform = "translate3d(100%, 0, 0)";
        activeScreen.style.webkitTransform = "translate3d(100%, 0, 0)";

        els.t3ScreenStart.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.webkitTransition = `-webkit-transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenStart.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenStart.style.opacity = "1";

        setTimeout(() => {
          showT3Screen("start");
          activeScreen.style.transition = "";
          activeScreen.style.webkitTransition = "";
          activeScreen.style.transform = "";
          activeScreen.style.webkitTransform = "";
          els.t3ScreenStart.style.transition = "";
          els.t3ScreenStart.style.webkitTransition = "";
          els.t3ScreenStart.style.transform = "";
          els.t3ScreenStart.style.webkitTransform = "";
          setKnobAngle(knobToReset, 0, true, true);
        }, 430);
      });
    } else {
      showT3Screen("start");
      setKnobAngle(knobToReset, 0, true, true);
    }
    playSound("toggleOff");
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
  }

  let lastT3TickTemp = null;
  function updateT3PickerVisuals() {
    if (!els.t3PickerTrack) return;
    const trackCenter = els.t3PickerTrack.scrollLeft + (els.t3PickerTrack.clientWidth / 2);
    const items = els.t3PickerTrack.querySelectorAll(".t3-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      // Dist threshold with 180px items:
      // Active item: dist < 90
      // Single immediate neighbor on each side (350 and 400): 90 <= dist < 270
      // Any further numbers (325, 300, 425, 450): dist >= 270 -> hidden (opacity 0)
      if (dist >= 90 && dist < 270) {
        item.classList.add("is-neighbor-1");
      }
    });

    if (closestItem) {
      closestItem.classList.remove("is-neighbor-1");
      closestItem.classList.add("is-active");
      const tempVal = parseInt(closestItem.dataset.temp, 10);
      if (tempVal !== state.task3TargetTemp) {
        state.task3TargetTemp = tempVal;
        if (tempVal !== lastT3TickTemp) {
          lastT3TickTemp = tempVal;
          playSound("touch");
        }
      }
    }
  }

  function snapToClosestT3Temp() {
    if (!els.t3PickerTrack) return;
    const trackCenter = els.t3PickerTrack.scrollLeft + (els.t3PickerTrack.clientWidth / 2);
    const items = els.t3PickerTrack.querySelectorAll(".t3-picker-item");
    let closestTemp = 375;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
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
    const targetItem = els.t3PickerTrack.querySelector(`.t3-picker-item[data-temp="${temp}"]`);
    if (targetItem) {
      const trackWidth = els.t3PickerTrack.clientWidth || 840;
      const itemCenter = targetItem.offsetLeft + (targetItem.offsetWidth / 2);
      const targetScrollLeft = itemCenter - (trackWidth / 2);
      els.t3PickerTrack.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? "smooth" : "auto"
      });
      state.task3TargetTemp = temp;
      setTimeout(updateT3PickerVisuals, smooth ? 250 : 50);
    }
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
    if (!els.t3RunPickerTrack) return;
    const trackCenter = els.t3RunPickerTrack.scrollLeft + (els.t3RunPickerTrack.clientWidth / 2);
    const items = els.t3RunPickerTrack.querySelectorAll(".t3-picker-item");
    let closestItem = null;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
      const dist = Math.abs(itemCenter - trackCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      item.classList.remove("is-active", "is-neighbor-1", "is-neighbor-2");
      // Dist threshold with 180px items:
      // Active item: dist < 90
      // Single immediate neighbor on each side (350 and 400): 90 <= dist < 270
      // Any further numbers (325, 300, 425, 450): dist >= 270 -> hidden (opacity 0)
      if (dist >= 90 && dist < 270) {
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
    const trackCenter = els.t3RunPickerTrack.scrollLeft + (els.t3RunPickerTrack.clientWidth / 2);
    const items = els.t3RunPickerTrack.querySelectorAll(".t3-picker-item");
    let closestTemp = 375;
    let closestDist = Infinity;

    items.forEach(item => {
      const itemCenter = item.offsetLeft + (item.offsetWidth / 2);
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
    const targetItem = els.t3RunPickerTrack.querySelector(`.t3-picker-item[data-temp="${temp}"]`);
    if (targetItem) {
      const trackWidth = els.t3RunPickerTrack.clientWidth || 840;
      const itemCenter = targetItem.offsetLeft + (targetItem.offsetWidth / 2);
      const targetScrollLeft = itemCenter - (trackWidth / 2);
      els.t3RunPickerTrack.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? "smooth" : "auto"
      });
      state.task3TargetTemp = temp;
      setTimeout(updateT3RunPickerVisuals, smooth ? 250 : 50);
    }
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
              state.burners[k.burner].temp = 375;
              state.burners[k.burner].label = "375°F";
            }
            renderBurnerState(k.burner);
          }
        }
      }
    }

    updateCooktopActiveState();

    // TASK 2 & TASK 3 PRECISION COOKING WORKFLOW TRIGGER
    if (state.currentTask === 3 || state.currentTask === 2) {
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
      els.t2BtnExplore.addEventListener("click", () => showT2Precision("spotlight"));
    }
    if (els.t2BtnBack) {
      els.t2BtnBack.addEventListener("click", () => showT2Explore());
    }

    // Task 2 Tab Bar
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
    document.querySelectorAll(".t2-tab-btn").forEach(bindT2TabBtn);

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
    if (els.t3BtnExplore) {
      els.t3BtnExplore.addEventListener("click", () => {
        playSound("touch");
        // Animate Knob 1 turning to PRC position and trigger flow
        setKnobAngle(1, -56, true, true);
      });
    }
    // Tapping directly on any screen burner triggers its dedicated knob and animations
    [1, 2, 3, 4, 5].forEach(i => {
      const roller = els[`t3BurnerRoller${i}`];
      if (roller) {
        roller.addEventListener("click", (e) => {
          e.stopPropagation();
          playSound("touch");
          const k = knobsState[i - 1];
          const isOff = !k || Math.abs(k.angle) <= 5;
          const targetAngle = isOff ? (i === 3 ? 45 : -56) : 0;
          setKnobAngle(i, targetAngle, true, true);
        });
      }
    });

    if (els.t3HotspotMainBurner) {
      els.t3HotspotMainBurner.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        const k = knobsState[3];
        const isOff = !k || Math.abs(k.angle) <= 5;
        const targetAngle = isOff ? -56 : 0;
        setKnobAngle(4, targetAngle, true, true);
      });
    }

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
        cancelT3A();
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
        cancelT3A();
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
            scrollToT3RunTemp(state.task3TargetTemp || 375, false);
          });
        } else {
          cancelT3A();
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
        if (isNaN(temp) || temp < 100) temp = 375;
        state.task3TargetTemp = temp;
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
        scrollToT3RunTemp(state.task3TargetTemp || 375, false);
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
          scrollToT3Temp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
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
          scrollToT3Temp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
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
          scrollToT3Temp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
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
          scrollToT3Temp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
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
          scrollToT3RunTemp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 375, false);
          }, 60);
        });
      });
    }
    if (els.t3HotspotActiveBurner) {
      els.t3HotspotActiveBurner.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("tempRun");
        requestAnimationFrame(() => {
          scrollToT3RunTemp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 375, false);
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
          scrollToT3RunTemp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3RunTemp(state.task3TargetTemp || 375, false);
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
            scrollToT3RunTemp(state.task3TargetTemp || 500, false);
          });
        }
      });
    }

    // PCTemperatureRun Screen: Back Button, Update Button & Keypad Button
    if (els.t3BtnBackFromTempRun) {
      els.t3BtnBackFromTempRun.addEventListener("click", () => {
        playSound("touch");
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

    // Tabs on TempRun screen (Figma 3017:26093)
    const tabTempFromRun = document.getElementById("t3TabBtnTempFromTempRun");
    const tabFoodFromRun = document.getElementById("t3TabBtnFoodFromTempRun");
    const tabTechFromRun = document.getElementById("t3TabBtnTechFromTempRun");
    const tabFavFromRun = document.getElementById("t3TabBtnFavFromTempRun");
    const tabRecentFromRun = document.getElementById("t3TabBtnRecentFromTempRun");

    if (tabTempFromRun) {
      tabTempFromRun.addEventListener("click", () => {
        playSound("touch");
      });
    }
    if (tabFoodFromRun) {
      tabFoodFromRun.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("foodOptions");
      });
    }
    if (tabTechFromRun) {
      tabTechFromRun.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("technique");
      });
    }
    if (tabFavFromRun) {
      tabFavFromRun.addEventListener("click", () => playSound("touch"));
    }
    if (tabRecentFromRun) {
      tabRecentFromRun.addEventListener("click", () => playSound("touch"));
    }

    // ==============================================
    // TASK 3C: FOOD MODE & RECIPE CONFIG LISTENERS
    // ==============================================

    // Subflow switcher buttons
    if (els.btnT3FlowTemp) {
      els.btnT3FlowTemp.addEventListener("click", () => {
        playSound("touch");
        state.task3Mode = "temperature";
        state.task3TargetTemp = 375;
        els.btnT3FlowTemp.classList.add("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowStatus) els.btnT3FlowStatus.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
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
        state.task3TargetTemp = 375;
        els.btnT3FlowStatus.classList.add("is-active");
        if (els.btnT3FlowTemp) els.btnT3FlowTemp.classList.remove("is-active");
        if (els.btnT3FlowFood) els.btnT3FlowFood.classList.remove("is-active");
        if (els.btnT3FlowTech) els.btnT3FlowTech.classList.remove("is-active");
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
        if (els.tStartActiveBurner1) els.tStartActiveBurner1.hidden = true;
        [1, 2, 3, 5].forEach(i => setKnobAngle(i, 0, false, false));
        showT3Screen("start");
        setTimeout(() => {
          setKnobAngle(4, -56, true, true);
        }, 300);
      });
    }

    // Unified Tab Navigation for Task 3 (Spotlight, Technique, Food, Temperature)
    function switchT3Tab(tabName) {
      if (tabName === "spotlight") {
        showT3Screen("spotlight");
      } else if (tabName === "technique") {
        showT3Screen("technique");
        if (els.t3TechniqueScroll) els.t3TechniqueScroll.scrollTop = 0;
      } else if (tabName === "food") {
        if (t3Stage !== "foodOptions") {
          transitionToT3FoodOptions();
          if (els.t3FoodScroll) els.t3FoodScroll.scrollTop = 0;
        }
      } else if (tabName === "temperature") {
        if (t3Stage === "foodOptions" || t3Stage === "beefMenu") {
          const outScr = (t3Stage === "beefMenu" && els.t3ScreenBeefMenu) ? els.t3ScreenBeefMenu : els.t3ScreenFoodOptions;
          t3Stage = "temperature";
          updateScreenBadge("temperature");
          slideTransition(outScr, els.t3ScreenTemperature, "right", () => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
          });
        } else {
          showT3Screen("temperature");
          requestAnimationFrame(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
            setTimeout(() => {
              scrollToT3Temp(state.task3TargetTemp || 375, false);
            }, 60);
          });
        }
      } else if (tabName === "favorite" || tabName === "recent") {
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
    document.querySelectorAll(".t3-tab-btn").forEach(bindT3TabBtn);

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
    const t3FoodCards = document.querySelectorAll("#t3FoodScroll .t3-food-card");
    t3FoodCards.forEach(card => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        playSound("touch");
        t3FoodCards.forEach(c => c.classList.remove("is-selected"));
        card.classList.add("is-selected");

        const foodName = card.dataset.food;
        if (foodName === "Beef") {
          setTimeout(() => {
            transitionToT3BeefMenu();
          }, 220);
        }
      });
    });

    // Beef Menu Screen (Figma 3028:28875): Back button and Start button
    if (els.t3BtnBackFromBeefMenu) {
      els.t3BtnBackFromBeefMenu.addEventListener("click", () => {
        playSound("touch");
        t3Stage = "foodOptions";
        updateScreenBadge("foodOptions");
        t3FoodCards.forEach(c => c.classList.remove("is-selected"));
        slideTransition(els.t3ScreenBeefMenu, els.t3ScreenFoodOptions, "right");
      });
    }

    if (els.t3BtnStartBeef) {
      els.t3BtnStartBeef.addEventListener("click", () => {
        playSound("toggleOn");
        showT3Screen("foodPreheat");
        startFoodPreheatTimer();
      });
    }

    // Technique Options Screen Back Button (< Cooktop)
    if (els.t3BtnBackFromTechnique) {
      els.t3BtnBackFromTechnique.addEventListener("click", () => {
        playSound("touch");
        showT3Screen(knobsState[1] && Math.abs(knobsState[1].angle) > 20 ? "burnerStatus" : "start");
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


    // 4. Drawer Scrollable Container Smooth Mouse Drag & Wheel
    document.querySelectorAll(".t3-drawer-scrollable-options").forEach(scrollBox => {
      let isDown = false;
      let startY = 0;
      let scrollTop = 0;

      scrollBox.addEventListener("mousedown", (e) => {
        isDown = true;
        startY = e.pageY - scrollBox.offsetTop;
        scrollTop = scrollBox.scrollTop;
      });
      scrollBox.addEventListener("mouseleave", () => { isDown = false; });
      scrollBox.addEventListener("mouseup", () => { isDown = false; });
      scrollBox.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const y = e.pageY - scrollBox.offsetTop;
        const walk = (y - startY) * 1.5;
        scrollBox.scrollTop = scrollTop - walk;
      });
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
        showT3Screen("beefType");
      });
    }
    if (els.t3BtnEditFoodPreheat) {
      els.t3BtnEditFoodPreheat.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("beefType");
      });
    }
    if (els.t3BtnBackFromFoodComplete) {
      els.t3BtnBackFromFoodComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("beefType");
      });
    }
    if (els.t3BtnEditFoodComplete) {
      els.t3BtnEditFoodComplete.addEventListener("click", () => {
        playSound("touch");
        clearT3Timers();
        showT3Screen("beefType");
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
        showT3Screen("beefType");
      });
    }
    if (els.t3HotspotRearLeftBurner) {
      els.t3HotspotRearLeftBurner.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("tempRun");
      });
    }

    // Home & Cooktop navbar buttons
    if (els.navHomeBtn) {
      els.navHomeBtn.addEventListener("click", () => {
        playSound("touch");
        if (state.currentTask === 3 && t3Stage !== "start") {
          cancelT3A();
        } else if (state.currentTask === 2) {
          showT2Explore(true);
        }
        closeDrawer();
      });
    }

    const navBack = document.getElementById("navBackBtn");
    const navCooktop = document.getElementById("navCooktopBtn");
    const navHome = document.getElementById("navHomeBtn");

    const onNavReturn = (e) => {
      if (e) e.preventDefault();
      playSound("touch");
      if (state.currentTask === 3 && t3Stage !== "start") {
        cancelT3A();
      } else if (state.currentTask === 2) {
        showT2Explore(true);
      }
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
          } else if (stage === "turnknob") {
            showT3Screen("turnknob");
          } else if (stage === "temperature") {
            showT3Screen("temperature");
            requestAnimationFrame(() => scrollToT3Temp(state.task3TargetTemp || 375, false));
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
      const scrollable = targetEl && typeof targetEl.closest === "function" ? targetEl.closest(
        ".t3-picker-track, .t2-picker-track, .t2-options-scroll-container, .t2-tile-scroll-container, .t3-options-scroll-container, .t3-drawer-scrollable-options, .t3-doneness-carousel, .t3-recipe-cards-track"
      ) : null;
      if (!scrollable) {
        e.preventDefault();
      }
    }, { passive: false });

    // 4. Block double-tap to zoom
    let lastTouchEndTime = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEndTime <= 300) {
        const targetEl = (e.target instanceof Element) ? e.target : (e.target && e.target.parentElement);
        const isClickable = targetEl && typeof targetEl.closest === "function" ? targetEl.closest("button, select, input, a, [role='button'], .task-btn, .scale-btn") : false;
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

  // Restore active task from URL or localStorage (Task 1 hidden from display, promote to 2)
  const urlParams = new URLSearchParams(window.location.search);
  const taskFromParam = parseInt(urlParams.get("task"), 10);
  const taskFromHash = window.location.hash === "#task3" ? 3 : window.location.hash === "#task2" ? 2 : window.location.hash === "#task1" ? 1 : null;
  const taskFromStorage = parseInt(localStorage.getItem("polaris_active_task"), 10);
  let initialTask = taskFromParam || taskFromHash || (taskFromStorage >= 2 ? taskFromStorage : 2);
  if (initialTask === 1) {
    initialTask = 2; // Awareness test removed from display; promote to Task 2
  }
  setTask(initialTask);

  window.__polaris = {
    state,
    knobsState,
    setKnobAngle,
    setTask,
    showT3Screen,
    updateT3BurnerFromKnob,
    showT2Precision,
    setT2Tab,
    updateScreenBadge,
    updateCooktopActiveState,
    scrollToT3Temp,
    scrollToT3RunTemp,
    playSound,
    playTickSound,
    resetTickQueue,
    getAudioCtx: () => audioCtx,
    getAudioBuffers: () => audioBuffers
  };
  window.PolarisApp = window.__polaris;
})();
