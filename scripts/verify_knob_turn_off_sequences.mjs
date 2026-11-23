import http from 'http';
import fs from 'fs';
import path from 'path';

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const wsUrl = await getCdpUrl();
  console.log('Connected to CDP at:', wsUrl);
  const ws = new WebSocket(wsUrl);

  let idSeq = 1;
  const pending = new Map();

  ws.onmessage = (msg) => {
    const res = JSON.parse(msg.data);
    if (res.id && pending.has(res.id)) {
      const { resolve, reject } = pending.get(res.id);
      pending.delete(res.id);
      if (res.error) reject(res.error);
      else resolve(res.result);
    }
  };

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = idSeq++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  console.log('WebSocket open.');

  const evaluate = async (expr) => {
    const res = await call('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
      throw new Error(res.exceptionDetails.text || 'Eval error');
    }
    return res.result ? res.result.value : undefined;
  };

  const captureScreenshot = async (name) => {
    const res = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const artifactPath = `/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/${name}.png`;
    fs.writeFileSync(artifactPath, buffer);
    console.log(`Saved screenshot to ${artifactPath}`);
  };

  // Enable Page domain
  await call('Page.enable');

  // Reload page cleanly with cache bypassed
  console.log('--- Reloading prototype with cache bypassed ---');
  await call('Page.reload', { ignoreCache: true });
  await sleep(1500);

  // Ensure Task 3 is initialized
  await evaluate(`
    if (typeof showT3Screen === 'function') {
      showT3Screen('start');
    }
  `);
  await sleep(500);

  // =========================================================================
  // TEST SEQUENCE 1: Turn off Rear Left (Knob 2) FIRST, then Front Left (Knob 1)
  // =========================================================================
  console.log('\n======================================================');
  console.log('TEST SEQUENCE 1: Rear Left OFF first, then Front Left OFF');
  console.log('======================================================');

  // 1. Setup Rear Left at 500°F
  console.log('Setting up Rear Left (Knob 2) to 500°F...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
  `);
  await sleep(300);

  // Start Rear Left cooking and go to burnerStatus
  await evaluate(`
    showT3Screen('burnerStatus');
  `);
  await sleep(400);

  let rlStatus = await evaluate(`({
    burnerStatusVisible: !document.getElementById('t3ScreenBurnerStatus').hidden,
    activeBurnerCardVisible: !document.getElementById('tStartActiveBurner1').hidden,
    tempText: document.getElementById('tStartBurner1Temp')?.textContent,
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null
  })`);
  console.log('Rear Left running check:', rlStatus);

  // 2. Setup Front Left (Knob 1) to Pancakes Guided Cooking Step 4 (Enjoy Modal)
  console.log('Starting Pancakes Guided Cooking on Front Left (Knob 1)...');
  await evaluate(`
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    startGuidedCooking('pancakes');
    setGuidedStep(3, false); // Step 4 (0-indexed 3: Enjoy)
    document.getElementById('t3GuidedBtnDone4')?.click();
  `);
  await sleep(500);

  let guidedStatus = await evaluate(`({
    guidedScreenVisible: !document.getElementById('t3ScreenGuidedCooking').hidden,
    doneModalVisible: !document.getElementById('t3GuidedDoneModal').hidden,
    k1Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[1] : null,
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null
  })`);
  console.log('Guided cooking Step 4 state:', guidedStatus);

  // 3. Participant turns off Rear Left (Knob 2) FIRST
  console.log('Action: Turning off Knob 2 (Rear Left) to 0°...');
  await evaluate(`
    setKnobAngle(2, 0, false, true);
  `);
  await sleep(500);

  let seq1Step1 = await evaluate(`({
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null,
    k1Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[1] : null,
    guidedScreenVisible: !document.getElementById('t3ScreenGuidedCooking').hidden,
    doneModalVisible: !document.getElementById('t3GuidedDoneModal').hidden,
    activeBurnerCardHidden: document.getElementById('tStartActiveBurner1').hidden
  })`);
  console.log('State after Knob 2 turned off (Knob 1 still ON):', seq1Step1);

  if (seq1Step1.k2Level !== 'off') {
    throw new Error('Knob 2 level should be off after turning knob to 0');
  }
  if (!seq1Step1.guidedScreenVisible || !seq1Step1.doneModalVisible) {
    throw new Error('Front Left guided cooking screen and Enjoy modal should remain visible');
  }
  await captureScreenshot('verify_turn_off_seq1_rear_off_first');

  // 4. Participant turns off Front Left (Knob 1) SECOND
  console.log('Action: Turning off Knob 1 (Front Left) to 0°...');
  await evaluate(`
    setKnobAngle(1, 0, false, true);
  `);
  await sleep(600);

  let seq1Step2 = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    k1Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[1] : null,
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null,
    activeBurnerCardHidden: document.getElementById('tStartActiveBurner1').hidden,
    activityBarHidden: document.getElementById('screenBottomStrip')?.hidden || document.getElementById('screenBottomStrip')?.style.display === 'none',
    cooktopHotHidden: document.getElementById('cooktopHotIndicator')?.hidden,
    allRollersOff: [1, 2, 3, 4, 5].every(idx => {
      const r = document.getElementById('t3BurnerRoller' + idx);
      return r && !r.classList.contains('is-active');
    })
  })`);
  console.log('State after both knobs turned off (Sequence 1 complete):', seq1Step2);

  if (!seq1Step2.startScreenVisible) {
    throw new Error('Screen should transition to start when all burners are turned off');
  }
  if (!seq1Step2.activeBurnerCardHidden) {
    throw new Error('Active burner pill should be hidden when all burners are turned off');
  }
  if (!seq1Step2.activityBarHidden) {
    throw new Error('Activity bar should be hidden when all burners are turned off');
  }
  if (!seq1Step2.allRollersOff) {
    throw new Error('All rollers should be off and inactive');
  }
  await captureScreenshot('verify_turn_off_seq1_all_off');

  // =========================================================================
  // TEST SEQUENCE 2: Turn off Front Left (Knob 1) FIRST, then Rear Left (Knob 2)
  // =========================================================================
  console.log('\n======================================================');
  console.log('TEST SEQUENCE 2: Front Left OFF first, then Rear Left OFF');
  console.log('======================================================');

  // Reset to start screen
  await evaluate(`showT3Screen('start');`);
  await sleep(300);

  // 1. Setup Rear Left at 500°F
  console.log('Setting up Rear Left (Knob 2) to 500°F...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
    showT3Screen('burnerStatus');
  `);
  await sleep(400);

  // 2. Setup Front Left (Knob 1) to Pancakes Guided Cooking Step 4 (Enjoy Modal)
  console.log('Starting Pancakes Guided Cooking on Front Left (Knob 1)...');
  await evaluate(`
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    startGuidedCooking('pancakes');
    setGuidedStep(3, false); // Step 4 Enjoy modal
    document.getElementById('t3GuidedBtnDone4')?.click();
  `);
  await sleep(500);

  // 3. Participant turns off Front Left (Knob 1) FIRST
  console.log('Action: Turning off Knob 1 (Front Left) to 0°...');
  await evaluate(`
    setKnobAngle(1, 0, false, true);
  `);
  await sleep(600);

  let seq2Step1 = await evaluate(`({
    burnerStatusVisible: !document.getElementById('t3ScreenBurnerStatus').hidden,
    k1Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[1] : null,
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null,
    rearLeftCardVisible: !document.getElementById('tStartActiveBurner1').hidden,
    rearLeftTempText: document.getElementById('tStartBurner1Temp')?.textContent,
    statusRoller1Active: document.getElementById('t3StatusBurnerRoller1')?.classList.contains('is-active'),
    activityBarVisible: !document.getElementById('screenBottomStrip')?.hidden && document.getElementById('screenBottomStrip')?.style.display !== 'none'
  })`);
  console.log('State after Knob 1 turned off (Knob 2 still ON at 500°F):', seq2Step1);

  if (!seq2Step1.burnerStatusVisible) {
    throw new Error('Screen should transition to burnerStatus because Rear Left is still cooking');
  }
  if (seq2Step1.k1Level !== 'off') {
    throw new Error('Front Left level should be off');
  }
  if (!seq2Step1.rearLeftCardVisible) {
    throw new Error('Rear Left active burner card should be visible showing 500°F');
  }
  if (seq2Step1.statusRoller1Active) {
    throw new Error('Front Left roller on burnerStatus should be inactive (OFF)');
  }
  await captureScreenshot('verify_turn_off_seq2_front_off_first');

  // 4. Participant turns off Rear Left (Knob 2) SECOND
  console.log('Action: Turning off Knob 2 (Rear Left) to 0° from burnerStatus...');
  await evaluate(`
    setKnobAngle(2, 0, false, true);
  `);
  await sleep(600);

  let seq2Step2 = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    k1Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[1] : null,
    k2Level: window.currentT3BurnerLevels ? window.currentT3BurnerLevels[2] : null,
    activeBurnerCardHidden: document.getElementById('tStartActiveBurner1').hidden,
    activityBarHidden: document.getElementById('screenBottomStrip')?.hidden || document.getElementById('screenBottomStrip')?.style.display === 'none',
    cooktopHotHidden: document.getElementById('cooktopHotIndicator')?.hidden,
    allRollersOff: [1, 2, 3, 4, 5].every(idx => {
      const r = document.getElementById('t3BurnerRoller' + idx);
      return r && !r.classList.contains('is-active');
    })
  })`);
  console.log('State after both knobs turned off (Sequence 2 complete):', seq2Step2);

  if (!seq2Step2.startScreenVisible) {
    throw new Error('Screen should transition to start when all burners are turned off');
  }
  if (!seq2Step2.activeBurnerCardHidden) {
    throw new Error('Active burner card should be hidden when all burners are turned off');
  }
  if (!seq2Step2.activityBarHidden) {
    throw new Error('Activity bar should be hidden when all burners are turned off');
  }
  if (!seq2Step2.allRollersOff) {
    throw new Error('All rollers should be off and inactive');
  }
  await captureScreenshot('verify_turn_off_seq2_all_off');

  // =========================================================================
  // TEST SEQUENCE 3A: Turn off Rear Left (Knob 2) FIRST during Pancakes Preheat
  // =========================================================================
  console.log('\n======================================================');
  console.log('TEST SEQUENCE 3A: Turn off Rear Left (Knob 2) FIRST on Pancakes Preheat');
  console.log('======================================================');

  // Setup: Rear Left at 500°F, Front Left at Pancakes Preheat
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    showT3Screen('pancakesPreheat');
  `);
  await sleep(400);

  // Turn Knob 2 off from pancakesPreheat while Front Left is running
  console.log('Action: Turning off Knob 2 (Rear Left) first from pancakesPreheat...');
  await evaluate(`setKnobAngle(2, 0, false, true);`);
  await sleep(500);

  let seq3AStep1 = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    rlOffVisible: !document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden,
    k1Level: window.currentT3BurnerLevels[1],
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Knob 2 turned off first from pancakesPreheat:', seq3AStep1);

  if (!seq3AStep1.pancakesPreheatVisible || !seq3AStep1.rlOffVisible || !seq3AStep1.rlTextsHidden) {
    throw new Error('Turning off Knob 2 first in pancakesPreheat should show Rear Left OFF overlay and keep Pancakes screen visible');
  }

  // Turn Knob 1 off second -> both off -> back to start screen
  console.log('Action: Turning off Knob 1 (Front Left) second to complete turn-off...');
  await evaluate(`setKnobAngle(1, 0, false, true);`);
  await sleep(500);

  let seq3AFinal = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    allOff: [1, 2, 3, 4, 5].every(i => window.currentT3BurnerLevels[i] === 'off')
  })`);
  console.log('Final state after both off (Sequence 3A):', seq3AFinal);

  if (!seq3AFinal.startScreenVisible || !seq3AFinal.allOff) {
    throw new Error('Turning off Knob 1 second should transition to start with all burners off');
  }

  // =========================================================================
  // TEST SEQUENCE 3B: Turn off Front Left (Knob 1) FIRST during Pancakes Preheat
  // =========================================================================
  console.log('\n======================================================');
  console.log('TEST SEQUENCE 3B: Turn off Front Left (Knob 1) FIRST on Pancakes Preheat');
  console.log('======================================================');

  // Setup: Rear Left at 500°F, Front Left at Pancakes Preheat
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    showT3Screen('pancakesPreheat');
  `);
  await sleep(400);

  // Turn Knob 1 off from pancakesPreheat while Rear Left is running
  console.log('Action: Turning off Knob 1 from pancakesPreheat (Rear Left running)...');
  await evaluate(`setKnobAngle(1, 0, false, true);`);
  await sleep(500);

  let seq3BStep1 = await evaluate(`({
    burnerStatusVisible: !document.getElementById('t3ScreenBurnerStatus').hidden,
    rearLeftCardVisible: !document.getElementById('tStartActiveBurner1').hidden,
    k1Level: window.currentT3BurnerLevels[1],
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Knob 1 turned off from pancakesPreheat:', seq3BStep1);

  if (!seq3BStep1.burnerStatusVisible || !seq3BStep1.rearLeftCardVisible) {
    throw new Error('Turning off Knob 1 in pancakesPreheat while Knob 2 is ON should transition to burnerStatus');
  }

  // Turn Knob 2 off
  console.log('Action: Turning off Knob 2 to complete turn-off...');
  await evaluate(`setKnobAngle(2, 0, false, true);`);
  await sleep(500);

  let seq3BFinal = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    allOff: [1, 2, 3, 4, 5].every(i => window.currentT3BurnerLevels[i] === 'off')
  })`);
  console.log('Final state after both off (Sequence 3B):', seq3BFinal);

  if (!seq3BFinal.startScreenVisible || !seq3BFinal.allOff) {
    throw new Error('Turning off Knob 2 should transition to start with all burners off');
  }

  // =========================================================================
  // TEST SEQUENCE 4: Turn off on foodBurnerStatus (Both Front Left & Rear Left)
  // =========================================================================
  console.log('\n======================================================');
  console.log('TEST SEQUENCE 4: Turn off on foodBurnerStatus');
  console.log('======================================================');

  // Setup: foodBurnerStatus (both Knob 1 and Knob 2 active)
  await evaluate(`
    setKnobAngle(1, -56, false, true);
    setKnobAngle(2, -56, false, true);
    showT3Screen('foodBurnerStatus');
  `);
  await sleep(400);

  // Turn Knob 1 off -> Front Left should show OFF on foodBurnerStatus
  console.log('Action: Turning off Knob 1 on foodBurnerStatus...');
  await evaluate(`setKnobAngle(1, 0, false, true);`);
  await sleep(400);

  let seq4Step1 = await evaluate(`({
    foodBurnerStatusVisible: !document.getElementById('t3ScreenFoodBurnerStatus').hidden,
    flOffBadgeVisible: !document.getElementById('t3FoodBurnerOffFL').hidden,
    rlOffBadgeHidden: document.getElementById('t3FoodBurnerOffRL').hidden,
    k1Level: window.currentT3BurnerLevels[1],
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Knob 1 turned off on foodBurnerStatus:', seq4Step1);

  if (!seq4Step1.foodBurnerStatusVisible || !seq4Step1.flOffBadgeVisible || !seq4Step1.rlOffBadgeHidden) {
    throw new Error('On foodBurnerStatus, turning off Knob 1 should show Front Left OFF badge while Rear Left stays running');
  }

  // Turn Knob 2 off -> both off -> back to start screen
  console.log('Action: Turning off Knob 2 on foodBurnerStatus...');
  await evaluate(`setKnobAngle(2, 0, false, true);`);
  await sleep(500);

  let seq4Final = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    allOff: [1, 2, 3, 4, 5].every(i => window.currentT3BurnerLevels[i] === 'off'),
    activityBarHidden: document.getElementById('screenBottomStrip')?.hidden || document.getElementById('screenBottomStrip')?.style.display === 'none'
  })`);
  console.log('Final state after both off from foodBurnerStatus:', seq4Final);

  if (!seq4Final.startScreenVisible || !seq4Final.allOff || !seq4Final.activityBarHidden) {
    throw new Error('Turning off both knobs from foodBurnerStatus should return to start with all burners and activity bar off');
  }

  console.log('\n>>> ALL TEST SEQUENCES PASSED SUCCESSFULLY! <<<');
  ws.close();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
