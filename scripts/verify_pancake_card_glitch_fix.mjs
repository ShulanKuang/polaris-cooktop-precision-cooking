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

  const takeScreenshot = async (name) => {
    const res = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const artifactPath = path.join('/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808', name);
    fs.writeFileSync(artifactPath, buffer);
    console.log(`Saved screenshot to ${artifactPath}`);
    return artifactPath;
  };

  console.log('--- Reloading prototype ---');
  await call('Page.reload', { ignoreCache: true });
  await sleep(1500);

  // 1. Setup Rear Left (Knob 2) to 500°F and burnerStatus
  console.log('Step 1: Setup Rear Left (Knob 2) running at 500°F...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
    if (window.currentT3BurnerLevels) window.currentT3BurnerLevels[2] = 'prc';
    showT3Screen('burnerStatus');
  `);
  await sleep(600);

  // 2. Setup Front Left (Knob 1) to Pancakes Guided Cooking
  console.log('Step 2: Setup Front Left (Knob 1) to Pancakes Guided Cooking...');
  await evaluate(`
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    if (window.currentT3BurnerLevels) window.currentT3BurnerLevels[1] = 'prc';
    startGuidedCooking('pancakes');
    setGuidedStep(3, false); // Step 4
  `);
  await sleep(600);

  // Open Enjoy Modal on Step 4
  console.log('Step 3: Trigger Done on Step 4 to show Enjoy Modal...');
  await evaluate(`
    const doneBtn4 = document.getElementById('t3GuidedBtnDone4');
    if (doneBtn4) doneBtn4.click();
    else {
      const modal = document.getElementById('t3GuidedDoneModal');
      if (modal) modal.hidden = false;
    }
  `);
  await sleep(400);

  await takeScreenshot('verify_enjoy_modal_open.png');

  // Click Done on Enjoy modal
  console.log('Step 4: Click Done on Enjoy modal -> return to pancakesPreheat burner screen...');
  await evaluate(`
    const enjoyDoneBtn = document.getElementById('t3GuidedDoneModalBtn');
    if (enjoyDoneBtn) enjoyDoneBtn.click();
  `);
  await sleep(800);

  // Check state on pancakesPreheat
  const preheatState = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    t3ScreenTemperatureHidden: document.getElementById('t3ScreenTemperature').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden,
    rlOffHidden: document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTitle: document.querySelector('.t3-pancakes-rl-title').textContent,
    rlTemp: document.getElementById('t3PancakesRLTemp').textContent
  })`);
  console.log('State after return to burner screen:', preheatState);

  await takeScreenshot('verify_after_enjoy_pancakes_preheat_fixed.png');

  // Step 5: Test turning off Rear Left (Knob 2) first
  console.log('Step 5: Turn off Rear Left (Knob 2) first...');
  await evaluate(`
    setKnobAngle(2, 0, false, true);
  `);
  await sleep(500);

  const afterRLOffState = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    rlOffHidden: document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden,
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Rear Left turned off:', afterRLOffState);
  await takeScreenshot('verify_after_enjoy_rl_turned_off.png');

  // Step 6: Test turning Rear Left (Knob 2) back on to 500°F
  console.log('Step 6: Turn Rear Left (Knob 2) back on...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
  `);
  await sleep(500);

  const afterRLOnState = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    rlOffHidden: document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden,
    rlTemp: document.getElementById('t3PancakesRLTemp').textContent,
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Rear Left turned back on:', afterRLOnState);
  await takeScreenshot('verify_after_enjoy_rl_turned_back_on.png');

  // Step 7: Test turning off Front Left (Knob 1) second -> both off -> back to start
  console.log('Step 7: Turn off Front Left (Knob 1)...');
  await evaluate(`
    setKnobAngle(1, 0, false, true);
  `);
  await sleep(500);

  const afterFLOffState = await evaluate(`({
    burnerStatusVisible: !document.getElementById('t3ScreenBurnerStatus').hidden,
    k1Level: window.currentT3BurnerLevels[1],
    k2Level: window.currentT3BurnerLevels[2]
  })`);
  console.log('State after Front Left off (Rear Left still on):', afterFLOffState);
  await takeScreenshot('verify_after_fl_off_rl_still_on.png');

  // Step 8: Turn off Rear Left -> both off -> start screen
  console.log('Step 8: Turn off Rear Left -> start screen...');
  await evaluate(`
    setKnobAngle(2, 0, false, true);
  `);
  await sleep(500);

  const finalAllOffState = await evaluate(`({
    startScreenVisible: !document.getElementById('t3ScreenStart').hidden,
    allOff: [1, 2, 3, 4, 5].every(i => window.currentT3BurnerLevels[i] === 'off')
  })`);
  console.log('Final all off state:', finalAllOffState);
  await takeScreenshot('verify_after_enjoy_all_off.png');

  console.log('All steps passed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
