(() => {
  // SOUND EFFECTS ENGINE
  const SOUND_FILES = {
    touch: "./sounds/Touch.wav",
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

  function playSound(type) {
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
    task3TargetTemp: 375
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
    t3PickerWheelContainer: document.getElementById("t3PickerWheelContainer"),
    t3PickerTrack: document.getElementById("t3PickerTrack"),
    t3BtnStartTemp: document.getElementById("t3BtnStartTemp"),

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

    t3ScreenTempRun: document.getElementById("t3ScreenTempRun"),
    t3BtnBackFromTempRun: document.getElementById("t3BtnBackFromTempRun"),
    t3RunPickerWheelContainer: document.getElementById("t3RunPickerWheelContainer"),
    t3RunPickerTrack: document.getElementById("t3RunPickerTrack"),
    t3BtnUpdateTemp: document.getElementById("t3BtnUpdateTemp"),
    t3BtnKeypadTemp: document.getElementById("t3BtnKeypadTemp"),

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
      prompt: "Turn any PRC-enabled knob to PRC (2s delay -> Spotlight). Tap Temperature tab -> pick temp -> click START. Live 5s preheat -> complete toast (3s) -> Burner status."
    },
    4: {
      title: "Task 4: End & Turn Off",
      prompt: "Ask users to turn off all burners. Observe if they use the touch screen or look for physical knobs."
    }
  };

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

    // Toggle subbar controls (Task 1 glance controls only)
    if (els.glanceControls) {
      els.glanceControls.hidden = taskId !== 1;
      els.glanceControls.style.display = taskId === 1 ? "flex" : "none";
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

      // Always start with screen covered in standby
      coverTask1Screen();
    } else if (taskId === 2) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = false;
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) {
        els.screenBottomStrip.hidden = true;
        els.screenBottomStrip.style.display = "none";
      }

      // Initialize Task 2 to explore view
      showT2Explore(true);
    } else if (taskId === 3) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.viewTask3) els.viewTask3.hidden = false;
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) {
        els.screenBottomStrip.hidden = true;
        els.screenBottomStrip.style.display = "none";
      }

      // Initialize Task 3 to start screen
      showT3Screen("start");
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
  }

  function showT2Precision(tabName = "spotlight", tempMode = "picker", silent = false) {
    if (!silent) playSound("touch");
    state.task2.screen = "precision";
    if (els.viewTask3) els.viewTask3.hidden = true;
    if (els.viewTask2) els.viewTask2.hidden = false;
    if (els.t2ScreenExplore) els.t2ScreenExplore.hidden = true;
    if (els.t2ScreenPrecision) els.t2ScreenPrecision.hidden = false;
    setT2Tab(tabName, tempMode, true);
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

  function isAnyBurnerRunning() {
    if (state.currentTask === 1) return true;
    if (state.currentTask === 2) return false;
    if (state.currentTask === 3) {
      if (
        t3Stage === "preheat" ||
        t3Stage === "completed" ||
        t3Stage === "burnerStatus" ||
        t3Stage === "tempRun"
      ) {
        return true;
      }
      return knobsState.some((k) => k && k.angle > 5);
    }
    return false;
  }

  function updateNavbarState() {
    if (!els.screenRailBg) return;
    const running = isAnyBurnerRunning();
    const targetSrc = running ? "./assets/navbar-running-90px.png" : "./assets/navbar-pinned-90px.png";
    if (els.screenRailBg.getAttribute("src") !== targetSrc) {
      els.screenRailBg.src = targetSrc;
    }
  }

  function showT3Screen(stage) {
    t3Stage = stage;
    if (els.t3ScreenStart) els.t3ScreenStart.hidden = (stage !== "start");
    if (els.t3ScreenTurnKnob) els.t3ScreenTurnKnob.hidden = (stage !== "turnknob");
    if (els.t3ScreenSpotlight) els.t3ScreenSpotlight.hidden = (stage !== "spotlight");
    if (els.t3ScreenTemperature) els.t3ScreenTemperature.hidden = (stage !== "temperature");
    if (els.t3ScreenPreheat) els.t3ScreenPreheat.hidden = (stage !== "preheat");
    if (els.t3ScreenPreheatComplete) els.t3ScreenPreheatComplete.hidden = (stage !== "completed");
    if (els.t3ScreenBurnerStatus) els.t3ScreenBurnerStatus.hidden = (stage !== "burnerStatus");
    if (els.t3ScreenTempRun) els.t3ScreenTempRun.hidden = (stage !== "tempRun");
    if (stage !== "completed" && els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
    }

    // Activity bar only shows up starting from preheat screen!
    // Before this or before user clicks start, activity bar must not show up.
    // When on burnerStatus or tempRun, activity bar continues running!
    const showActivityBar = (stage === "preheat" || stage === "completed" || stage === "burnerStatus" || stage === "tempRun");
    if (els.screenBottomStrip) {
      els.screenBottomStrip.hidden = !showActivityBar;
      els.screenBottomStrip.style.display = showActivityBar ? "block" : "none";
    }

    if (stage === "completed") {
      const targetTemp = state.task3TargetTemp || 375;
      if (els.t3CompleteTarget) els.t3CompleteTarget.textContent = targetTemp;
    }
    if (stage === "burnerStatus") {
      const targetTemp = state.task3TargetTemp || 375;
      if (els.t3BurnerStatusTemp) els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
    }

    if (stage === "start") {
      clearT3Timers();
      [1, 2, 3, 4, 5].forEach(i => {
        const k = knobsState[i - 1];
        if (k) updateT3BurnerFromKnob(i, k.angle, false);
      });
      if (els.t3ToastCard) {
        els.t3ToastCard.hidden = true;
        els.t3ToastCard.classList.remove("is-raising-up", "is-dismissing");
      }
      if (els.t3ToastNum) {
        els.t3ToastNum.textContent = "3";
      }
    }

    updateNavbarState();
  }

  function clearT3Timers() {
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
  }

  function updateT3BurnerFromKnob(index, angle, animate = false) {
    if (state.currentTask !== 3 && state.currentTask !== 2) return;

    const burnerConfigs = {
      1: { roller: els.t3BurnerRoller1, strip: els.t3BurnerStrip1, type: "standard", itemH: 38, baseOffset: 45 },
      2: { roller: els.t3BurnerRoller2, strip: els.t3BurnerStrip2, type: "standard", itemH: 38, baseOffset: 45 },
      3: { roller: els.t3BurnerRoller3, strip: els.t3BurnerStrip3, type: "onoff",    itemH: 36, baseOffset: 35 },
      4: { roller: els.t3BurnerRoller4, strip: els.t3BurnerStrip4, type: "main",     itemH: 52, baseOffset: 62 },
      5: { roller: els.t3BurnerRoller5, strip: els.t3BurnerStrip5, type: "standard", itemH: 38, baseOffset: 45 }
    };

    const cfg = burnerConfigs[index];
    if (!cfg || !cfg.roller || !cfg.strip) return;
    const { roller, strip, type, itemH, baseOffset } = cfg;

    if (t3Stage !== "start") {
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
        roller.classList.add("is-active");
        if (currentT3BurnerLevels[3] !== "on") {
          currentT3BurnerLevels[3] = "on";
          playSound("tick");
        }
        const onY = baseOffset - 1 * itemH;
        strip.style.webkitTransform = `translate3d(0, ${onY}px, 0)`;
        strip.style.transform = `translate3d(0, ${onY}px, 0)`;
        const items = strip.querySelectorAll(".t3-burner-roller-item");
        items.forEach(it => {
          const idx = parseInt(it.dataset.index, 10);
          it.classList.toggle("is-selected", idx === 1);
        });
      } else {
        currentT3BurnerLevels[3] = "off";
        strip.style.webkitTransform = `translate3d(0, ${baseOffset}px, 0)`;
        strip.style.transform = `translate3d(0, ${baseOffset}px, 0)`;
        const items = strip.querySelectorAll(".t3-burner-roller-item");
        items.forEach(it => {
          const idx = parseInt(it.dataset.index, 10);
          it.classList.toggle("is-selected", idx === 0);
        });
        roller.classList.remove("is-active");
      }
      return;
    }

    // Standard (1, 2, 5) and Main (4) Burners: OFF (0°), PRC (-56°), MIN (55°) to MAX (270°)
    const isPRC = (angle < -20 && angle > -80);
    const isMinToMax = (angle >= 20 && angle <= 285);
    const isOff = (Math.abs(angle) <= 12);

    if (isPRC) {
      // 1. Pointing at PRC (-56 deg): dedicated burner shows temperature icon
      roller.classList.add("is-active");
      currentT3BurnerLevels[index] = "prc";
      activePrcKnobIndex = index;

      // Translate strip to center index 11 (temp icon)
      const prcY = baseOffset - 11 * itemH;
      strip.style.webkitTransform = `translate3d(0, ${prcY}px, 0)`;
      strip.style.transform = `translate3d(0, ${prcY}px, 0)`;

      const items = strip.querySelectorAll(".t3-burner-roller-item");
      items.forEach(it => {
        const idx = parseInt(it.dataset.index, 10);
        it.classList.toggle("is-selected", idx === 11);
      });

      // 1s quiet delay on PRC, then quick raise up toast with 3s countdown, then slide in Spotlight
      if (!t3PrcQuietTimers[index] && !t3CountdownInterval && !t3HoldingTimeout) {
        if (els.t3ToastCard) {
          els.t3ToastCard.classList.remove("is-visible", "is-dismissing");
          els.t3ToastCard.setAttribute("hidden", "");
        }
        if (els.t3ToastNum) {
          els.t3ToastNum.textContent = "3";
        }

        t3PrcQuietTimers[index] = setTimeout(() => {
          t3PrcQuietTimers[index] = null;
          showT3PrcToastAndStartCountdown();
        }, 1000);
      }
    } else if (isMinToMax) {
      // 2. Turning from Min to Max: dedicated burner changes number 1-10 equally divided
      dismissPrcTimerAndToast(index);

      roller.classList.add("is-active");

      // Angle: MIN tick is at 55 deg, MAX tick is at 270 deg (arc span = 215 deg)
      const clamped = Math.max(55, Math.min(270, angle));
      const progress = (clamped - 55) / (270 - 55);
      const level = Math.max(1, Math.min(10, Math.round(1 + progress * 9)));

      if (level !== currentT3BurnerLevels[index]) {
        currentT3BurnerLevels[index] = level;
        playSound("tick");
      }

      // Translate strip to center index level
      const targetY = baseOffset - level * itemH;
      strip.style.webkitTransform = `translate3d(0, ${targetY}px, 0)`;
      strip.style.transform = `translate3d(0, ${targetY}px, 0)`;

      const items = strip.querySelectorAll(".t3-burner-roller-item");
      items.forEach(it => {
        const idx = parseInt(it.dataset.index, 10);
        it.classList.toggle("is-selected", idx === level);
      });
    } else if (isOff) {
      // 3. Knob at OFF (0 deg)
      dismissPrcTimerAndToast(index);
      currentT3BurnerLevels[index] = "off";

      strip.style.webkitTransform = `translate3d(0, ${baseOffset}px, 0)`;
      strip.style.transform = `translate3d(0, ${baseOffset}px, 0)`;
      const items = strip.querySelectorAll(".t3-burner-roller-item");
      items.forEach(it => {
        const idx = parseInt(it.dataset.index, 10);
        it.classList.toggle("is-selected", idx === 0);
      });

      roller.classList.remove("is-active");
    } else {
      dismissPrcTimerAndToast(index);
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

  function transitionToT3Spotlight() {
    clearT3Timers();
    dismissPrcTimerAndToast();

    playSound("toggleOn");

    if (state.currentTask === 2) {
      showT2Precision("spotlight", "picker");
      return;
    }

    // Perform smooth synchronized GPU push-slide transition from right
    if (els.t3ScreenSpotlight && els.t3ScreenStart) {
      t3Stage = "spotlight";

      // 1. Prepare start screen: visible at 0, opacity 1
      els.t3ScreenStart.hidden = false;
      els.t3ScreenStart.style.transition = "none";
      els.t3ScreenStart.style.webkitTransition = "none";
      els.t3ScreenStart.style.transform = "translate3d(0, 0, 0)";
      els.t3ScreenStart.style.webkitTransform = "translate3d(0, 0, 0)";
      els.t3ScreenStart.style.opacity = "1";
      els.t3ScreenStart.style.zIndex = "100";

      // 2. Prepare spotlight screen: unhide and place at +100% off screen right
      els.t3ScreenSpotlight.hidden = false;
      els.t3ScreenSpotlight.style.transition = "none";
      els.t3ScreenSpotlight.style.webkitTransition = "none";
      els.t3ScreenSpotlight.style.transform = "translate3d(100%, 0, 0)";
      els.t3ScreenSpotlight.style.webkitTransform = "translate3d(100%, 0, 0)";
      els.t3ScreenSpotlight.style.boxShadow = "-16px 0 40px rgba(0, 0, 0, 0.75)";
      els.t3ScreenSpotlight.style.zIndex = "110";

      // 3. Force layout reflow so WebKit commits initial transforms
      void els.t3ScreenSpotlight.offsetWidth;
      void els.t3ScreenStart.offsetWidth;

      // 4. Animate both screens in requestAnimationFrame
      requestAnimationFrame(() => {
        const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
        const dur = "0.45s";

        els.t3ScreenSpotlight.style.transition = `transform ${dur} ${ease}`;
        els.t3ScreenSpotlight.style.webkitTransition = `-webkit-transform ${dur} ${ease}`;
        els.t3ScreenSpotlight.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenSpotlight.style.webkitTransform = "translate3d(0, 0, 0)";

        els.t3ScreenStart.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.webkitTransition = `-webkit-transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.transform = "translate3d(-25%, 0, 0)";
        els.t3ScreenStart.style.webkitTransform = "translate3d(-25%, 0, 0)";
        els.t3ScreenStart.style.opacity = "0.4";

        setTimeout(() => {
          if (t3Stage === "spotlight") {
            els.t3ScreenStart.hidden = true;
            els.t3ScreenStart.style.transition = "";
            els.t3ScreenStart.style.webkitTransition = "";
            els.t3ScreenStart.style.transform = "";
            els.t3ScreenStart.style.webkitTransform = "";
            els.t3ScreenStart.style.opacity = "";
            els.t3ScreenSpotlight.style.transition = "";
            els.t3ScreenSpotlight.style.webkitTransition = "";
          }
        }, 480);
      });
    } else {
      showT3Screen("spotlight");
    }
  }

  function startT3ACountdown() {
    transitionToT3Spotlight();
  }

  // TASK 3B: PREHEAT AND COMPLETION TIMERS
  function startT3Preheat() {
    clearT3Timers();
    showT3Screen("preheat");
    playSound("toggleOn");

    const targetTemp = state.task3TargetTemp || 375;
    const startTemp = 182;
    const durationMs = 5000; // 5s smooth temperature growth
    const startTime = Date.now();

    if (els.t3PreheatTarget) {
      els.t3PreheatTarget.textContent = targetTemp;
    }
    if (els.t3PreheatCurrent) {
      els.t3PreheatCurrent.textContent = startTemp;
    }

    t3PreheatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = Math.round(startTemp + progress * (targetTemp - startTemp));
      if (els.t3PreheatCurrent) {
        els.t3PreheatCurrent.textContent = current;
      }

      if (progress >= 1.0) {
        clearInterval(t3PreheatInterval);
        t3PreheatInterval = null;
        if (els.t3PreheatCurrent) {
          els.t3PreheatCurrent.textContent = targetTemp;
        }

        // 2s holding delay at target temperature before transition to completed
        t3HoldingTimeout = setTimeout(() => {
          startT3PreheatCompleted();
        }, 2000);
      }
    }, 50);
  }

  function startT3PreheatCompleted() {
    clearT3Timers();
    showT3Screen("completed");
    playSound("toggleOn");

    // Pop up preheat complete toast with spring animation!
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.remove("is-dismissing");
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (t3Stage === "completed" && els.t3ToastPreheatComplete) {
            els.t3ToastPreheatComplete.classList.add("is-visible");
          }
        }, 50);
      });
    }

    const targetTemp = state.task3TargetTemp || 375;
    if (els.t3CompleteTarget) {
      els.t3CompleteTarget.textContent = targetTemp;
    }

    // Stay on this screen for 30s before going to burnerStatus (or user clicks OK or ✕)
    t3HoldingTimeout = setTimeout(() => {
      finishT3PreheatToBurnerStatus();
    }, 30000);
  }

  function finishT3PreheatToBurnerStatus() {
    clearT3Timers();
    if (els.t3ToastPreheatComplete) {
      els.t3ToastPreheatComplete.classList.remove("is-visible");
      els.t3ToastPreheatComplete.classList.add("is-dismissing");
      setTimeout(() => {
        showT3Screen("burnerStatus");
      }, 250);
    } else {
      showT3Screen("burnerStatus");
    }
    playSound("touch");

    const targetTemp = state.task3TargetTemp || 375;
    if (els.t3BurnerStatusTemp) {
      els.t3BurnerStatusTemp.textContent = `${targetTemp}°F`;
    }
  }

  function cancelT3A() {
    clearT3Timers();
    dismissPrcTimerAndToast();
    const knobToReset = activePrcKnobIndex || 1;

    if (els.t3ScreenSpotlight && !els.t3ScreenSpotlight.hidden && els.t3ScreenStart) {
      t3Stage = "start";

      // 1. Prepare start screen positioned slightly to the left (-25%) with opacity 0.4
      els.t3ScreenStart.hidden = false;
      els.t3ScreenStart.style.transition = "none";
      els.t3ScreenStart.style.webkitTransition = "none";
      els.t3ScreenStart.style.transform = "translate3d(-25%, 0, 0)";
      els.t3ScreenStart.style.webkitTransform = "translate3d(-25%, 0, 0)";
      els.t3ScreenStart.style.opacity = "0.4";
      els.t3ScreenStart.style.zIndex = "100";

      // 2. Spotlight is visible at (0, 0, 0)
      els.t3ScreenSpotlight.hidden = false;
      els.t3ScreenSpotlight.style.transition = "none";
      els.t3ScreenSpotlight.style.webkitTransition = "none";
      els.t3ScreenSpotlight.style.transform = "translate3d(0, 0, 0)";
      els.t3ScreenSpotlight.style.webkitTransform = "translate3d(0, 0, 0)";
      els.t3ScreenSpotlight.style.zIndex = "110";

      void els.t3ScreenSpotlight.offsetWidth;
      void els.t3ScreenStart.offsetWidth;

      requestAnimationFrame(() => {
        const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
        const dur = "0.40s";

        els.t3ScreenSpotlight.style.transition = `transform ${dur} ${ease}`;
        els.t3ScreenSpotlight.style.webkitTransition = `-webkit-transform ${dur} ${ease}`;
        els.t3ScreenSpotlight.style.transform = "translate3d(100%, 0, 0)";
        els.t3ScreenSpotlight.style.webkitTransform = "translate3d(100%, 0, 0)";

        els.t3ScreenStart.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.webkitTransition = `-webkit-transform ${dur} ${ease}, opacity ${dur} ease`;
        els.t3ScreenStart.style.transform = "translate3d(0, 0, 0)";
        els.t3ScreenStart.style.webkitTransform = "translate3d(0, 0, 0)";
        els.t3ScreenStart.style.opacity = "1";

        setTimeout(() => {
          showT3Screen("start");
          els.t3ScreenSpotlight.style.transition = "";
          els.t3ScreenSpotlight.style.webkitTransition = "";
          els.t3ScreenSpotlight.style.transform = "";
          els.t3ScreenSpotlight.style.webkitTransform = "";
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

    updateNavbarState();

    // TASK 2 & TASK 3 PRECISION COOKING WORKFLOW TRIGGER
    if (state.currentTask === 3 || state.currentTask === 2) {
      updateT3BurnerFromKnob(index, angle, animate);
    }

    if (target) {
      target.setAttribute("aria-valuenow", Math.round(angle));
    }
  }

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
    if (els.t2TabSpotlight) {
      els.t2TabSpotlight.addEventListener("click", () => setT2Tab("spotlight"));
    }
    if (els.t2TabTechnique) {
      els.t2TabTechnique.addEventListener("click", () => setT2Tab("technique"));
    }
    if (els.t2TabFood) {
      els.t2TabFood.addEventListener("click", () => setT2Tab("food"));
    }
    if (els.t2TabTemperature) {
      els.t2TabTemperature.addEventListener("click", () => setT2Tab("temperature"));
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

    // Task 2 Option Tiles Click / Selection
    document.querySelectorAll(".buttontile").forEach(tile => {
      tile.addEventListener("click", () => {
        playSound("touch");
        const wasSelected = tile.classList.contains("is-selected");
        const parentGrid = tile.closest(".t2-tiles-grid");
        if (parentGrid) {
          parentGrid.querySelectorAll(".buttontile").forEach(t => t.classList.remove("is-selected"));
        }
        if (!wasSelected) {
          tile.classList.add("is-selected");
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

    // Spotlight -> Click Temperature Tab -> Go to PCTemperature Screen
    if (els.t3TabBtnTemperature) {
      els.t3TabBtnTemperature.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("temperature");
        requestAnimationFrame(() => {
          scrollToT3Temp(state.task3TargetTemp || 375, false);
          setTimeout(() => {
            scrollToT3Temp(state.task3TargetTemp || 375, false);
          }, 60);
        });
      });
    }

    // Temperature Screen: Back button (< Cooktop) & Spotlight Tab
    if (els.t3BtnBackFromTemp) {
      els.t3BtnBackFromTemp.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("spotlight");
      });
    }
    if (els.t3TabBtnSpotlightFromTemp) {
      els.t3TabBtnSpotlightFromTemp.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("spotlight");
      });
    }

    // Temperature Screen: START button -> Triggers Activity Bar & Preheating!
    if (els.t3BtnStartTemp) {
      els.t3BtnStartTemp.addEventListener("click", () => {
        startT3Preheat();
      });
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
        finishT3PreheatToBurnerStatus();
      };
      els.t3ToastCompleteOk.addEventListener("click", handleOk);
      els.t3ToastCompleteOk.addEventListener("touchstart", handleOk, { passive: true });
    }
    if (els.t3ToastCompleteClose) {
      const handleClose = (e) => {
        if (e) e.stopPropagation();
        finishT3PreheatToBurnerStatus();
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

    // PCTemperatureRun Screen: Back Button, Update Button & Keypad Button
    if (els.t3BtnBackFromTempRun) {
      els.t3BtnBackFromTempRun.addEventListener("click", () => {
        playSound("touch");
        showT3Screen("burnerStatus");
      });
    }
    if (els.t3BtnUpdateTemp) {
      els.t3BtnUpdateTemp.addEventListener("click", () => {
        playSound("toggleOn");
        showT3Screen("burnerStatus");
      });
    }
    if (els.t3BtnKeypadTemp) {
      els.t3BtnKeypadTemp.addEventListener("click", () => {
        playSound("touch");
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

  // INIT
  const savedScaleMode = localStorage.getItem("polaris_app_scale_mode") || "physical";
  if (savedScaleMode === "native") {
    setAppScale(1.0, "native");
  } else {
    setAppScale(0.8146, "physical");
  }
  setupListeners();
  initRunningActivityBar();

  // Restore active task from URL or localStorage, default to Task 3 for current testing
  const urlParams = new URLSearchParams(window.location.search);
  const taskFromParam = parseInt(urlParams.get("task"), 10);
  const taskFromHash = window.location.hash === "#task3" ? 3 : window.location.hash === "#task2" ? 2 : window.location.hash === "#task1" ? 1 : null;
  const taskFromStorage = parseInt(localStorage.getItem("polaris_active_task"), 10);
  const initialTask = taskFromParam || taskFromHash || (taskFromStorage >= 2 ? taskFromStorage : 3);
  setTask(initialTask);

  window.__polaris = {
    state,
    knobsState,
    setKnobAngle,
    setTask,
    showT3Screen,
    updateT3BurnerFromKnob
  };
})();
