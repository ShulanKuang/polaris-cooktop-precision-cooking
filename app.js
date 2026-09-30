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

    task1FullScreen: document.getElementById("task1FullScreen"),
    task1StandbyCover: document.getElementById("task1StandbyCover"),
    screenRail: document.querySelector(".screen-rail"),
    topStatus: document.querySelector(".top-status"),
    screenCanvas: document.getElementById("screenCanvas"),
    screenBottomStrip: document.getElementById("screenBottomStrip"),

    viewTask2: document.getElementById("viewTask2"),
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

    // Update cheat sheet
    if (TASK_INFO[taskId]) {
      els.taskTitle.textContent = TASK_INFO[taskId].title;
      els.taskPrompt.textContent = TASK_INFO[taskId].prompt;
    }

    // Toggle subbar controls (ONLY show for Task 1, hide for Task 2 and 3)
    if (taskId === 1) {
      if (els.glanceControls) {
        els.glanceControls.hidden = false;
        els.glanceControls.style.display = "flex";
      }
    } else {
      if (els.glanceControls) {
        els.glanceControls.hidden = true;
        els.glanceControls.style.display = "none";
      }
    }

    // Switch screen view
    if (taskId === 1) {
      if (els.task1FullScreen) els.task1FullScreen.hidden = false;
      if (els.screenRail) els.screenRail.hidden = true;
      if (els.topStatus) els.topStatus.hidden = true;
      if (els.screenCanvas) els.screenCanvas.hidden = true;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = true;

      // Always start with screen covered in standby
      coverTask1Screen();
    } else {
      if (els.task1FullScreen) els.task1FullScreen.hidden = true;
      if (els.screenRail) els.screenRail.hidden = false;
      if (els.topStatus) els.topStatus.hidden = false;
      if (els.screenCanvas) els.screenCanvas.hidden = false;
      if (els.screenBottomStrip) els.screenBottomStrip.hidden = false;

      if (els.viewTask2) els.viewTask2.hidden = taskId !== 2;
      if (els.viewTask3) els.viewTask3.hidden = taskId !== 3;
    }

    // Reset drawer
    closeDrawer();
  }

  // TASK 1: GLANCE FLASH CONTROLS (0.5s / 1s / 2s)
  function flashGlance(durationMs) {
    playSound("toggleOn");
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
      playSound("toggleOff");
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
    playSound("touch");
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
    document.querySelectorAll(".glance-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const dur = btn.dataset.duration;
        if (dur === "toggle") {
          togglePreview();
        } else {
          flashGlance(parseInt(dur, 10));
        }
      });
    });

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
  }

  // INIT
  setupListeners();
  setTask(1);
})();
