import http from 'http';
import fs from 'fs';

function getCdpUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9245/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page' && (t.url.includes('8080') || t.title.includes('Polaris')));
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No matching page target found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const wsUrl = await getCdpUrl();
  console.log('Connected to CDP at:', wsUrl);
  const ws = new WebSocket(wsUrl);

  let idSeq = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const res = JSON.parse(event.data);
    if (res.id && pending.has(res.id)) {
      const { resolve, reject } = pending.get(res.id);
      pending.delete(res.id);
      if (res.error) reject(res.error);
      else resolve(res.result);
    }
  });

  await new Promise(resolve => ws.addEventListener('open', resolve));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idSeq++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      console.error('Evaluate Exception:', res.exceptionDetails.exception?.description || res.exceptionDetails.text, res.exceptionDetails);
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Evaluation failed');
    }
    return res.result.value;
  }

  async function captureScreenshot(filepath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filepath}`);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  console.log('1. Reload page to ensure clean state');
  await send('Page.reload');
  await wait(1200);

  console.log('--- TEST 1: Initial Start Screen (All Off) ---');
  const startAllOffState = await evaluate(`(() => {
    const tStartActiveBurner1 = document.getElementById("tStartActiveBurner1");
    const topStatus = document.getElementById("topStatus");
    const cooktopHot = document.getElementById("cooktopHotIndicator");
    const bottomStrip = document.getElementById("screenBottomStrip");
    return {
      activeBurner1Hidden: tStartActiveBurner1.hidden,
      topStatusHidden: topStatus.hidden,
      cooktopHotHidden: cooktopHot.hidden,
      bottomStripHidden: bottomStrip.hidden
    };
  })()`);
  console.log('Start All Off State:', startAllOffState);
  if (!startAllOffState.activeBurner1Hidden) throw new Error('FAIL: activeBurner1 should be hidden when all knobs off');
  if (!startAllOffState.topStatusHidden) throw new Error('FAIL: topStatus should be hidden on start screen');
  if (!startAllOffState.cooktopHotHidden) throw new Error('FAIL: cooktopHot should be hidden when all knobs off');
  if (!startAllOffState.bottomStripHidden) throw new Error('FAIL: bottomStrip should be hidden when all knobs off');

  await captureScreenshot('/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/verify_fix_start_all_off.png');

  console.log('--- TEST 2: Start Screen with Running Rear-Left Burner (Knob 2 ON) ---');
  await evaluate(`(() => {
    window.setKnobAngle(2, -56, false, false);
    window.showT3Screen("start");
  })()`);
  await wait(300);

  const startKnob2OnState = await evaluate(`(() => {
    const tStartActiveBurner1 = document.getElementById("tStartActiveBurner1");
    const topStatus = document.getElementById("topStatus");
    const cooktopHot = document.getElementById("cooktopHotIndicator");
    const bottomStrip = document.getElementById("screenBottomStrip");
    return {
      activeBurner1Hidden: tStartActiveBurner1.hidden,
      topStatusHidden: topStatus.hidden,
      cooktopHotHidden: cooktopHot.hidden,
      cooktopHotIsVisible: cooktopHot.classList.contains("is-visible"),
      bottomStripHidden: bottomStrip.hidden
    };
  })()`);
  console.log('Start Knob 2 On State:', startKnob2OnState);
  if (startKnob2OnState.activeBurner1Hidden) throw new Error('FAIL: activeBurner1 should be visible when Knob 2 is ON');
  if (!startKnob2OnState.topStatusHidden) throw new Error('FAIL: topStatus must remain hidden (no duplicate status bar) on start screen!');
  if (startKnob2OnState.cooktopHotHidden || !startKnob2OnState.cooktopHotIsVisible) throw new Error('FAIL: cooktopHot must be visible when burner is ON');

  await captureScreenshot('/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/verify_fix_start_knob2_on_no_double_status.png');

  console.log('--- TEST 3: Turn Knob 2 OFF while on Start Screen ---');
  await evaluate(`(() => {
    window.setKnobAngle(2, 0, true, true);
  })()`);
  await wait(300);

  const startKnob2OffState = await evaluate(`(() => {
    const tStartActiveBurner1 = document.getElementById("tStartActiveBurner1");
    const cooktopHot = document.getElementById("cooktopHotIndicator");
    const bottomStrip = document.getElementById("screenBottomStrip");
    return {
      activeBurner1Hidden: tStartActiveBurner1.hidden,
      cooktopHotHidden: cooktopHot.hidden,
      bottomStripHidden: bottomStrip.hidden
    };
  })()`);
  console.log('Start Knob 2 Off State:', startKnob2OffState);
  if (!startKnob2OffState.activeBurner1Hidden) throw new Error('FAIL: activeBurner1 should be hidden after turning Knob 2 to OFF');
  if (!startKnob2OffState.cooktopHotHidden) throw new Error('FAIL: cooktopHot should be hidden after turning Knob 2 to OFF');
  if (!startKnob2OffState.bottomStripHidden) throw new Error('FAIL: bottomStrip should be hidden after turning Knob 2 to OFF');

  console.log('--- TEST 4: No Double Status Bar across Task 3 screens ---');
  const screensToCheck = [
    { name: 'beefType', expectTopStatus: false },
    { name: 'beefDoneness', expectTopStatus: false },
    { name: 'beefThickness', expectTopStatus: false },
    { name: 'pancakesDoneness', expectTopStatus: true },
    { name: 'pancakesBurner', expectTopStatus: true },
    { name: 'pancakesCookware', expectTopStatus: true },
    { name: 'pancakesPreheat', expectTopStatus: false },
    { name: 'guidedCooking', expectTopStatus: false },
    { name: 'start', expectTopStatus: false }
  ];

  for (const s of screensToCheck) {
    await evaluate(`(() => {
      window.showT3Screen("${s.name}");
    })()`);
    await wait(100);
    const st = await evaluate(`(() => {
      const topStatus = document.getElementById("topStatus");
      const clock = document.getElementById("clockReadout");
      return {
        topStatusHidden: topStatus.hidden,
        clockText: clock.textContent
      };
    })()`);
    if (st.topStatusHidden === s.expectTopStatus) {
      throw new Error(`FAIL: Screen ${s.name} expected topStatus hidden = ${!s.expectTopStatus}, but got ${st.topStatusHidden}`);
    }
    if (s.expectTopStatus && !/\d{1,2}:\d{2}\s+(AM|PM)/.test(st.clockText)) {
      throw new Error(`FAIL: Screen ${s.name} expected clock 12:00 PM, got ${st.clockText}`);
    }
  }
  console.log('Status bar visibility across all screens verified correctly!');

  console.log('--- TEST 5: Full Pancakes Guided Cooking Flow -> Enjoy Done -> Turn Knob 1 OFF ---');
  // 1. Go to Pancakes Preheat
  await evaluate(`(() => {
    window.startT3PancakesPreheat();
  })()`);
  await wait(200);

  // 2. Set reached
  await evaluate(`(() => {
    const tile = document.getElementById("t3PancakesBurnerTile");
    if (tile) tile.classList.add("is-reached");
    const temp = document.getElementById("t3PancakesPreheatTemp");
    if (temp) temp.textContent = "400°F";
    const header = document.querySelector(".t3-pancakes-header-text");
    if (header) header.textContent = "Pan Preheated";
  })()`);
  await wait(200);

  // 3. Start guided cooking
  await evaluate(`(() => {
    const iconBtn = document.getElementById("t3BtnStepByStepGuided");
    if (iconBtn) iconBtn.click();
  })()`);
  await wait(300);

  // 4. Set to Step 4
  await evaluate(`(() => {
    window.setGuidedStep(4);
  })()`);
  await wait(300);

  // 5. Click Done on Step 4
  await evaluate(`(() => {
    const doneBtn = document.getElementById("t3GuidedBtnDone4");
    if (doneBtn) doneBtn.click();
  })()`);
  await wait(300);

  // 6. Click Done on Enjoy modal -> returns to reached preheat screen
  await evaluate(`(() => {
    const doneBtn = document.getElementById("t3GuidedDoneModalBtn");
    if (doneBtn) doneBtn.click();
  })()`);
  await wait(300);

  const reachedScreenState = await evaluate(`(() => {
    return {
      t3Stage: window.t3Stage,
      k1Angle: window.knobsState[0] ? window.knobsState[0].angle : 0
    };
  })()`);
  console.log('Returned to running burner screen:', reachedScreenState);
  if (reachedScreenState.t3Stage !== "pancakesPreheat") {
    throw new Error(`FAIL: Expected pancakesPreheat, got ${reachedScreenState.t3Stage}`);
  }

  // 7. Turn Knob 1 to OFF (0 deg)
  await evaluate(`(() => {
    window.setKnobAngle(1, 0, true, true);
  })()`);
  await wait(500);

  const postGuidedOffState = await evaluate(`(() => {
    const tStartActiveBurner1 = document.getElementById("tStartActiveBurner1");
    const topStatus = document.getElementById("topStatus");
    const cooktopHot = document.getElementById("cooktopHotIndicator");
    const bottomStrip = document.getElementById("screenBottomStrip");
    const k1 = window.knobsState[0];
    const k2 = window.knobsState[1];
    return {
      t3Stage: window.t3Stage,
      k1Angle: k1 ? k1.angle : 0,
      k2Angle: k2 ? k2.angle : 0,
      activeBurner1Hidden: tStartActiveBurner1.hidden,
      topStatusHidden: topStatus.hidden,
      cooktopHotHidden: cooktopHot.hidden,
      bottomStripHidden: bottomStrip.hidden
    };
  })()`);
  console.log('Post Guided Cooking OFF State:', postGuidedOffState);

  if (!postGuidedOffState.activeBurner1Hidden) {
    throw new Error('FAIL: Rear Left active burner card MUST be hidden after turning off all knobs!');
  }
  if (Math.abs(postGuidedOffState.k2Angle) > 5) {
    throw new Error('FAIL: Knob 2 must be at 0 deg, was forced ON!');
  }
  if (!postGuidedOffState.topStatusHidden) {
    throw new Error('FAIL: topStatus must be hidden on start screen!');
  }
  if (!postGuidedOffState.cooktopHotHidden) {
    throw new Error('FAIL: cooktopHot must be hidden when all knobs off!');
  }
  if (!postGuidedOffState.bottomStripHidden) {
    throw new Error('FAIL: bottomStrip must be hidden when all knobs off!');
  }

  await captureScreenshot('/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/verify_fix_finish_tasks_rear_left_off.png');

  console.log('--- TEST 6: Dual Burner Food Flow (foodBurnerStatus) -> Turn Both Off ---');
  await evaluate(`(() => {
    window.showT3Screen("foodBurnerStatus");
    window.setKnobAngle(1, -56, false, false);
    window.setKnobAngle(2, -56, false, false);
    window.updateFoodBurnerStatusDisplay();
  })()`);
  await wait(300);

  // Turn Knob 1 off
  await evaluate(`(() => {
    window.setKnobAngle(1, 0, true, true);
  })()`);
  await wait(200);

  // Turn Knob 2 off -> Should automatically return to start screen with all burners off
  await evaluate(`(() => {
    window.setKnobAngle(2, 0, true, true);
  })()`);
  await wait(400);

  const postDualOffState = await evaluate(`(() => {
    const tStartActiveBurner1 = document.getElementById("tStartActiveBurner1");
    const topStatus = document.getElementById("topStatus");
    const cooktopHot = document.getElementById("cooktopHotIndicator");
    const bottomStrip = document.getElementById("screenBottomStrip");
    const k1 = window.knobsState[0];
    const k2 = window.knobsState[1];
    return {
      t3Stage: window.t3Stage,
      k1Angle: k1 ? k1.angle : 0,
      k2Angle: k2 ? k2.angle : 0,
      activeBurner1Hidden: tStartActiveBurner1.hidden,
      topStatusHidden: topStatus.hidden,
      cooktopHotHidden: cooktopHot.hidden,
      bottomStripHidden: bottomStrip.hidden
    };
  })()`);
  console.log('Post Dual Burner OFF State:', postDualOffState);

  if (!postDualOffState.activeBurner1Hidden) {
    throw new Error('FAIL: Rear Left active burner card MUST be hidden after turning off dual burners!');
  }
  if (Math.abs(postDualOffState.k2Angle) > 5) {
    throw new Error('FAIL: Knob 2 must be at 0 deg!');
  }
  if (!postDualOffState.topStatusHidden) {
    throw new Error('FAIL: topStatus must be hidden on start screen!');
  }
  if (!postDualOffState.cooktopHotHidden) {
    throw new Error('FAIL: cooktopHot must be hidden when all knobs off!');
  }
  if (!postDualOffState.bottomStripHidden) {
    throw new Error('FAIL: bottomStrip must be hidden when all knobs off!');
  }

  await captureScreenshot('/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/verify_fix_dual_burners_off_clean_start.png');

  console.log('====================================');
  console.log('ALL VERIFICATION TESTS PASSED 100%!');
  console.log('====================================');

  ws.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
