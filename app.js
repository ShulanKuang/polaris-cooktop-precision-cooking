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
      temperature: 375,
      digipadBuffer: "375",
      hasEditedKeypad: false
    }
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

    // Task 2 Researcher Controls
    task2Controls: document.getElementById("task2Controls"),
    btnT2NavExplore: document.getElementById("btnT2NavExplore"),
    btnT2NavSpotlight: document.getElementById("btnT2NavSpotlight"),
    btnT2NavTechnique: document.getElementById("btnT2NavTechnique"),
    btnT2NavFood: document.getElementById("btnT2NavFood"),
    btnT2NavTempPicker: document.getElementById("btnT2NavTempPicker"),
    btnT2NavTempDigipad: document.getElementById("btnT2NavTempDigipad"),

    btnScalePhysical: document.getElementById("btnScalePhysical"),
    btnScaleNative: document.getElementById("btnScaleNative"),
    deviceSpec: document.querySelector(".device-spec"),

    task1FullScreen: document.getElementById("task1FullScreen"),
    task1StandbyCover: document.getElementById("task1StandbyCover"),
    screenRail: document.querySelector(".screen-rail"),
    topStatus: document.querySelector(".top-status"),
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
    t2PickerStartBtn: document.getElementById("t2PickerStartBtn"),
    t2DigipadStartBtn: document.getElementById("t2DigipadStartBtn"),
    t2BtnToDigipad: document.getElementById("t2BtnToDigipad"),
    t2BtnToPicker: document.getElementById("t2BtnToPicker"),
    t2DigipadValue: document.getElementById("t2DigipadValue"),

    viewTask3: document.getElementById("viewTask3"),
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

    // T3 interactive burners
    t3RearLeft: document.getElementById("t3RearLeft"),
    t3RearLeftState: document.getElementById("t3RearLeftState"),
    t3FrontLeft: document.getElementById("t3FrontLeft"),
    t3FrontLeftState: document.getElementById("t3FrontLeftState"),
    t3FrontRight: document.getElementById("t3FrontRight"),
    t3FrontRightState: document.getElementById("t3FrontRightState"),

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
      title: "Task 3: Usability Flow (Tasks A - E)",
      prompt: "Task A: Set Rear Left to 375°F. Task B: Adjust to 500°F. Task C: Front Left Steak. Task D: Precision OFF. Task E: Front Right Caramelize."
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

    // Toggle subbar controls
    if (taskId === 1) {
      if (els.glanceControls) {
        els.glanceControls.hidden = false;
        els.glanceControls.style.display = "flex";
      }
      if (els.task2Controls) {
        els.task2Controls.hidden = true;
        els.task2Controls.style.display = "none";
      }
    } else if (taskId === 2) {
      if (els.glanceControls) {
        els.glanceControls.hidden = true;
        els.glanceControls.style.display = "none";
      }
      if (els.task2Controls) {
        els.task2Controls.hidden = false;
        els.task2Controls.style.display = "flex";
      }
    } else {
      if (els.glanceControls) {
        els.glanceControls.hidden = true;
        els.glanceControls.style.display = "none";
      }
      if (els.task2Controls) {
        els.task2Controls.hidden = true;
        els.task2Controls.style.display = "none";
      }
    }

    // Switch screen view
    if (taskId === 1) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = false;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.screenRail) els.screenRail.hidden = true;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = true;

      // Always start with screen covered in standby
      coverTask1Screen();
    } else if (taskId === 2) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = false;
      if (els.screenRail) els.screenRail.hidden = true;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = true;

      // Initialize Task 2 to explore view
      showT2Explore(true);
    } else {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.viewTask2) els.viewTask2.hidden = true;
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = false;
      if (els.screenCanvas) els.screenCanvas.hidden = false;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = false;

      if (els.viewTask3) els.viewTask3.hidden = taskId !== 3;
    }

    // Reset drawer
    closeDrawer();
  }

  // ==============================================
  // TASK 2: PRECISION COOKING CONCEPT LOGIC
  // ==============================================
  function updateT2ToolbarButtons() {
    const navBtns = [
      els.btnT2NavExplore,
      els.btnT2NavSpotlight,
      els.btnT2NavTechnique,
      els.btnT2NavFood,
      els.btnT2NavTempPicker,
      els.btnT2NavTempDigipad
    ];
    navBtns.forEach(b => { if (b) b.classList.remove("is-active"); });

    if (state.task2.screen === "explore") {
      if (els.btnT2NavExplore) els.btnT2NavExplore.classList.add("is-active");
    } else if (state.task2.tab === "spotlight") {
      if (els.btnT2NavSpotlight) els.btnT2NavSpotlight.classList.add("is-active");
    } else if (state.task2.tab === "technique") {
      if (els.btnT2NavTechnique) els.btnT2NavTechnique.classList.add("is-active");
    } else if (state.task2.tab === "food") {
      if (els.btnT2NavFood) els.btnT2NavFood.classList.add("is-active");
    } else if (state.task2.tab === "temperature") {
      if (state.task2.tempMode === "picker") {
        if (els.btnT2NavTempPicker) els.btnT2NavTempPicker.classList.add("is-active");
      } else {
        if (els.btnT2NavTempDigipad) els.btnT2NavTempDigipad.classList.add("is-active");
      }
    }
  }

  function showT2Explore(silent = false) {
    if (!silent) playSound("touch");
    state.task2.screen = "explore";
    if (els.t2ScreenExplore) els.t2ScreenExplore.hidden = false;
    if (els.t2ScreenPrecision) els.t2ScreenPrecision.hidden = true;
    updateT2ToolbarButtons();
  }

  function showT2Precision(tabName = "spotlight", tempMode = "picker", silent = false) {
    if (!silent) playSound("touch");
    state.task2.screen = "precision";
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
    }

    updateT2ToolbarButtons();
  }

  function setT2TempMode(mode, silent = false) {
    if (!silent) playSound("touch");
    state.task2.tempMode = mode;
    if (mode === "picker") {
      if (els.t2TempModePicker) els.t2TempModePicker.hidden = false;
      if (els.t2TempModeDigipad) els.t2TempModeDigipad.hidden = true;
    } else {
      if (els.t2TempModePicker) els.t2TempModePicker.hidden = true;
      if (els.t2TempModeDigipad) els.t2TempModeDigipad.hidden = false;
    }
    updateT2ToolbarButtons();
  }

  function handleDigipadInput(key) {
    playSound("touch");
    if (key === "clear") {
      state.task2.digipadBuffer = "";
    } else if (key === "backspace") {
      state.task2.digipadBuffer = state.task2.digipadBuffer.slice(0, -1);
    } else {
      // numeric digit
      if (state.task2.digipadBuffer === "375" && !state.task2.hasEditedKeypad) {
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

    // Uncover immediately
    if (els.task1StandbyCover) {
      els.task1StandbyCover.classList.add("is-revealed");
      els.task1StandbyCover.style.display = "none";
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
    playSound("touch");
    state.selectedBurner = burnerId;

    const names = {
      "rear-left": "Rear Left Burner",
      "front-left": "Front Left Burner",
      "center": "Center Burner",
      "top-right": "Rear Right Burner",
      "front-right": "Front Right Burner"
    };
    els.drawerBurnerLabel.textContent = names[burnerId] || burnerId;

    switchTab(defaultTab);
    els.precisionDrawer.hidden = false;
  }

  function closeDrawer() {
    els.precisionDrawer.hidden = true;
  }

  function switchTab(tabKey) {
    playSound("touch");
    [els.tabTemp, els.tabFood, els.tabTechnique].forEach(t => t.classList.remove("is-active"));
    [els.panelTemp, els.panelFood, els.panelTechnique].forEach(p => p.hidden = true);

    if (tabKey === "temp") {
      els.tabTemp.classList.add("is-active");
      els.panelTemp.hidden = false;
    } else if (tabKey === "food") {
      els.tabFood.classList.add("is-active");
      els.panelFood.hidden = false;
    } else if (tabKey === "technique") {
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

  // EVENT LISTENERS
  function setupListeners() {
    // Researcher Task Switchers
    els.btnTask1.addEventListener("click", () => setTask(1));
    els.btnTask2.addEventListener("click", () => setTask(2));
    els.btnTask3.addEventListener("click", () => setTask(3));

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
      els.t2DigipadStartBtn.addEventListener("click", () => playSound("toggleOn"));
    }

    // Task 2 Temperature Picker Options
    document.querySelectorAll(".t2-picker-val").forEach(btn => {
      btn.addEventListener("click", () => {
        playSound("touch");
        const val = btn.dataset.temp;
        state.task2.temperature = parseInt(val, 10);
        state.task2.digipadBuffer = val;
        if (els.t2DigipadValue) els.t2DigipadValue.textContent = val;
      });
    });

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

    // Task 2 Researcher Quick-Jump Toolbar
    if (els.btnT2NavExplore) {
      els.btnT2NavExplore.addEventListener("click", () => showT2Explore());
    }
    if (els.btnT2NavSpotlight) {
      els.btnT2NavSpotlight.addEventListener("click", () => showT2Precision("spotlight"));
    }
    if (els.btnT2NavTechnique) {
      els.btnT2NavTechnique.addEventListener("click", () => showT2Precision("technique"));
    }
    if (els.btnT2NavFood) {
      els.btnT2NavFood.addEventListener("click", () => showT2Precision("food"));
    }
    if (els.btnT2NavTempPicker) {
      els.btnT2NavTempPicker.addEventListener("click", () => showT2Precision("temperature", "picker"));
    }
    if (els.btnT2NavTempDigipad) {
      els.btnT2NavTempDigipad.addEventListener("click", () => showT2Precision("temperature", "digipad"));
    }

    // T3 Interactive Burner Clicks
    els.t3RearLeft.addEventListener("click", () => openDrawer("rear-left", "temp"));
    els.t3FrontLeft.addEventListener("click", () => openDrawer("front-left", "food"));
    els.t3FrontRight.addEventListener("click", () => openDrawer("front-right", "technique"));

    // Drawer Tabs
    els.tabTemp.addEventListener("click", () => switchTab("temp"));
    els.tabFood.addEventListener("click", () => switchTab("food"));
    els.tabTechnique.addEventListener("click", () => switchTab("technique"));
    els.drawerCloseBtn.addEventListener("click", () => {
      playSound("cancel");
      closeDrawer();
    });

    // Stepper
    els.tempMinusBtn.addEventListener("click", () => {
      playSound("decrease");
      updateTemp(state.targetTemp - 5);
    });
    els.tempPlusBtn.addEventListener("click", () => {
      playSound("increase");
      updateTemp(state.targetTemp + 5);
    });

    // Quick pills
    document.querySelectorAll(".quick-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        playSound("touch");
        updateTemp(parseInt(pill.dataset.val, 10));
      });
    });

    // Action Confirmations
    els.btnConfirmTemp.addEventListener("click", confirmTemperature);
    els.btnTurnOffPrecision.addEventListener("click", turnOffPrecision);
    els.btnConfirmFood.addEventListener("click", () => confirmFood("Steak"));
    els.btnConfirmTech.addEventListener("click", () => confirmTechnique("Caramelize"));

    // Food selection cards
    document.querySelectorAll(".food-card").forEach(card => {
      card.addEventListener("click", () => {
        playSound("touch");
        document.querySelectorAll(".food-card").forEach(c => c.classList.remove("is-highlight"));
        card.classList.add("is-highlight");
        const food = card.dataset.food;
        els.btnConfirmFood.textContent = `Set ${food} Mode`;
      });
    });

    // Tech selection cards
    document.querySelectorAll(".tech-card").forEach(card => {
      card.addEventListener("click", () => {
        playSound("touch");
        document.querySelectorAll(".tech-card").forEach(c => c.classList.remove("is-highlight"));
        card.classList.add("is-highlight");
        const tech = card.dataset.tech;
        els.btnConfirmTech.textContent = `Set ${tech} Mode`;
      });
    });

    // Home button
    if (els.navHomeBtn) {
      els.navHomeBtn.addEventListener("click", () => {
        playSound("touch");
        closeDrawer();
      });
    }

    // Scale Switcher (Physical 1:1 for iPad Pro 13" vs 100% Canvas)
    if (els.btnScalePhysical) {
      els.btnScalePhysical.addEventListener("click", () => setAppScale(0.8146, "physical"));
    }
    if (els.btnScaleNative) {
      els.btnScaleNative.addEventListener("click", () => setAppScale(1.0, "native"));
    }
  }

  // INIT
  const savedScaleMode = localStorage.getItem("polaris_app_scale_mode") || "physical";
  if (savedScaleMode === "native") {
    setAppScale(1.0, "native");
  } else {
    setAppScale(0.8146, "physical");
  }
  setupListeners();
  setTask(1);
})();
