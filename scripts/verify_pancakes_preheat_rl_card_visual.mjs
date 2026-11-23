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

  const artifactDir = '/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808';

  const captureCard = async (filename) => {
    const screenRect = await evaluate(`JSON.stringify(document.getElementById("cooktopScreen").getBoundingClientRect())`);
    const r = JSON.parse(screenRect);
    const ss = await call("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: r.x + 90 * (r.width / 1024),
        y: r.y + 50 * (r.height / 384),
        width: 380 * (r.width / 1024),
        height: 180 * (r.height / 384),
        scale: 2
      }
    });
    fs.writeFileSync(path.join(artifactDir, filename), Buffer.from(ss.data, 'base64'));
    console.log(`Saved ${filename}`);
  };

  console.log('--- Reloading prototype ---');
  await call('Page.reload', { ignoreCache: true });
  await sleep(1500);

  // Setup Rear Left (Knob 2) to 500°F
  console.log('Setup Rear Left Knob 2 to 500°F...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
    if (window.currentT3BurnerLevels) window.currentT3BurnerLevels[2] = 'prc';
    showT3Screen('burnerStatus');
  `);
  await sleep(600);

  // Setup Front Left (Knob 1) to Pancakes Guided Cooking
  console.log('Setup Front Left Knob 1 to Pancakes Guided Cooking...');
  await evaluate(`
    setKnobAngle(1, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[1] = 400;
    if (window.currentT3BurnerLevels) window.currentT3BurnerLevels[1] = 'prc';
    startGuidedCooking('pancakes');
    setGuidedStep(3, false); // Step 4
  `);
  await sleep(600);

  // Open Enjoy Modal on Step 4
  console.log('Trigger Done on Step 4 to show Enjoy Modal...');
  await evaluate(`
    const doneBtn4 = document.getElementById('t3GuidedBtnDone4');
    if (doneBtn4) doneBtn4.click();
    else {
      const modal = document.getElementById('t3GuidedDoneModal');
      if (modal) modal.hidden = false;
    }
  `);
  await sleep(400);

  // Click Done on Enjoy modal
  console.log('Click Done on Enjoy modal -> return to pancakesPreheat...');
  await evaluate(`
    const enjoyDoneBtn = document.getElementById('t3GuidedDoneModalBtn');
    if (enjoyDoneBtn) enjoyDoneBtn.click();
  `);
  await sleep(800);

  // Capture active RL card
  await captureCard('verify_pancakes_preheat_rl_active.png');

  // Turn Rear Left (Knob 2) OFF
  console.log('Turn Rear Left Knob 2 OFF...');
  await evaluate(`setKnobAngle(2, 0, false, true);`);
  await sleep(500);

  const offState = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    rlOffHidden: document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden
  })`);
  console.log('State after RL Knob 2 turned OFF:', offState);
  await captureCard('verify_pancakes_preheat_rl_off.png');

  // Turn Rear Left (Knob 2) back ON to 500°F
  console.log('Turn Rear Left Knob 2 back ON to 500°F...');
  await evaluate(`
    setKnobAngle(2, -56, false, true);
    if (window.t3BurnerTargetTemps) window.t3BurnerTargetTemps[2] = 500;
  `);
  await sleep(500);

  const onState = await evaluate(`({
    pancakesPreheatVisible: !document.getElementById('t3ScreenPancakesPreheat').hidden,
    rlOffHidden: document.getElementById('t3PancakesBurnerOffRL').hidden,
    rlTextsHidden: document.getElementById('t3PancakesRLTexts').hidden,
    rlTemp: document.getElementById('t3PancakesRLTemp').textContent
  })`);
  console.log('State after RL Knob 2 turned back ON:', onState);
  await captureCard('verify_pancakes_preheat_rl_back_on.png');

  ws.close();
  console.log('Verification completed successfully!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
