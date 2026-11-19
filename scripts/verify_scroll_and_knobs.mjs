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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async function screenshot(filename) {
    const artifactPath = `/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808/${filename}`;
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(artifactPath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${artifactPath}`);
  }

  console.log('Reloading page to get latest HTML/CSS/JS...');
  await send('Page.reload');
  await sleep(1500);

  console.log('--- TEST 1: Guided Cooking Horizontal Scrolling ---');
  // Navigate to task 3 start and then enter guided cooking
  await evaluate(`
    window.location.hash = '#task3';
    window.showT3Screen('start');
  `);
  await sleep(300);

  // Start guided cooking at Step 1
  await evaluate(`
    window.setKnobAngle(1, -56, false, false);
    window.startGuidedCooking(1);
  `);
  await sleep(400);

  // Check initial step 1 state
  const step1State = await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      const track = document.getElementById('t3GuidedTrack');
      const c1 = document.getElementById('t3GuidedCard1');
      const c2 = document.getElementById('t3GuidedCard2');
      const c4 = document.getElementById('t3GuidedCard4');
      return {
        viewportScrollLeft: vp.scrollLeft,
        viewportWidth: vp.clientWidth,
        c1Active: c1.classList.contains('is-active'),
        c2Active: c2.classList.contains('is-active'),
        c4Active: c4.classList.contains('is-active'),
        c1Width: c1.offsetWidth,
        c2Width: c2.offsetWidth,
        c4Width: c4.offsetWidth
      };
    })()
  `);
  console.log('Step 1 state:', step1State);

  // Perform horizontal drag on viewport
  await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      vp.scrollLeft = 80;
    })()
  `);
  await sleep(200);

  const scrolledState = await evaluate(`document.getElementById('t3GuidedViewport').scrollLeft`);
  console.log('Scrolled scrollLeft:', scrolledState);

  // Click card 4 to switch to step 4
  await evaluate(`
    (() => {
      const c4 = document.getElementById('t3GuidedCard4');
      c4.click();
    })()
  `);
  await sleep(500);

  const step4State = await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      const c1 = document.getElementById('t3GuidedCard1');
      const c4 = document.getElementById('t3GuidedCard4');
      return {
        viewportScrollLeft: vp.scrollLeft,
        c1Active: c1.classList.contains('is-active'),
        c4Active: c4.classList.contains('is-active'),
        c1Width: c1.offsetWidth,
        c4Width: c4.offsetWidth
      };
    })()
  `);
  console.log('Step 4 state after click:', step4State);
  await screenshot('verify_guided_scroll_step4_active.png');

  // Click card 1 to switch back to step 1
  await evaluate(`
    (() => {
      const c1 = document.getElementById('t3GuidedCard1');
      c1.click();
    })()
  `);
  await sleep(500);

  const step1ReturnState = await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      const c1 = document.getElementById('t3GuidedCard1');
      return {
        viewportScrollLeft: vp.scrollLeft,
        c1Active: c1.classList.contains('is-active'),
        c1Width: c1.offsetWidth
      };
    })()
  `);
  console.log('Step 1 return state:', step1ReturnState);
  await screenshot('verify_guided_scroll_step1_active.png');

  console.log('--- TEST 2: Responsive Knobs in Guided Cooking ---');
  // Turn Knob 4 (Rear Right) to 150 deg (level ~5) while guided cooking is active on Knob 1
  await evaluate(`
    window.setKnobAngle(4, 150, true, true);
  `);
  await sleep(400);

  const guidedKnob4State = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('t3GuidedHotIndicator');
      const mainHotIndicator = document.getElementById('cooktopHotIndicator');
      const bottomStrip = document.getElementById('screenBottomStrip');
      const k4 = window.knobsState[3];
      return {
        k4Angle: k4.angle,
        k4IsOn: k4.isOn,
        currentLevels: window.currentT3BurnerLevels,
        guidedHotHidden: hotIndicator ? hotIndicator.hidden : null,
        mainHotHidden: mainHotIndicator ? mainHotIndicator.hidden : null,
        bottomStripHidden: bottomStrip ? bottomStrip.hidden : null
      };
    })()
  `);
  console.log('Knob 4 on during guided cooking:', guidedKnob4State);
  await screenshot('verify_guided_knob4_active.png');

  // Now turn Knob 1 (Front Left) to OFF (0 deg)
  // This should cancel guided cooking and return to start, BUT Burner 4 must remain ON!
  console.log('Turning Knob 1 to OFF (0 deg)...');
  await evaluate(`
    window.setKnobAngle(1, 0, true, true);
  `);
  await sleep(500);

  const startAfterGuidedOffState = await evaluate(`
    (() => {
      const startScreen = document.getElementById('t3ScreenStart');
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const bottomStrip = document.getElementById('screenBottomStrip');
      const roller4 = document.getElementById('t3BurnerRoller4');
      const roller1 = document.getElementById('t3BurnerRoller1');
      const activeRL = document.getElementById('tStartActiveBurner1');
      return {
        t3Stage: window.t3Stage,
        startScreenHidden: startScreen ? startScreen.hidden : null,
        currentLevels: window.currentT3BurnerLevels,
        roller4Active: roller4 ? roller4.classList.contains('is-active') : false,
        roller1Active: roller1 ? roller1.classList.contains('is-active') : false,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null,
        bottomStripHidden: bottomStrip ? bottomStrip.hidden : null,
        activeRLHidden: activeRL ? activeRL.hidden : null
      };
    })()
  `);
  console.log('Start screen after Knob 1 OFF (Knob 4 should still be ON):', startAfterGuidedOffState);
  await screenshot('verify_start_knob4_persists_after_guided_off.png');

  // Now turn Knob 4 to OFF (0 deg)
  // Everything should now be completely OFF!
  console.log('Turning Knob 4 to OFF (0 deg)...');
  await evaluate(`
    window.setKnobAngle(4, 0, true, true);
  `);
  await sleep(500);

  const startAllOffState = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const bottomStrip = document.getElementById('screenBottomStrip');
      const roller4 = document.getElementById('t3BurnerRoller4');
      const roller1 = document.getElementById('t3BurnerRoller1');
      const activeRL = document.getElementById('tStartActiveBurner1');
      return {
        t3Stage: window.t3Stage,
        currentLevels: window.currentT3BurnerLevels,
        roller4Active: roller4 ? roller4.classList.contains('is-active') : false,
        roller1Active: roller1 ? roller1.classList.contains('is-active') : false,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null,
        bottomStripHidden: bottomStrip ? bottomStrip.hidden : null,
        activeRLHidden: activeRL ? activeRL.hidden : null
      };
    })()
  `);
  console.log('All knobs OFF state:', startAllOffState);
  await screenshot('verify_start_all_knobs_off.png');

  console.log('--- TEST 3: Knob Responsiveness on Setup Screen ---');
  // Navigate to Select Cookware setup screen
  await evaluate(`
    window.setKnobAngle(1, -56, false, false);
    window.showT3Screen('selectCookware');
  `);
  await sleep(300);

  // Turn Knob 2 (Rear Left) to 120 deg (level ~4) while on setup screen
  await evaluate(`
    window.setKnobAngle(2, 120, true, true);
  `);
  await sleep(300);

  const setupKnob2State = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const bottomStrip = document.getElementById('screenBottomStrip');
      return {
        t3Stage: window.t3Stage,
        currentLevels: window.currentT3BurnerLevels,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null,
        bottomStripHidden: bottomStrip ? bottomStrip.hidden : null
      };
    })()
  `);
  console.log('Knob 2 turned on while on selectCookware:', setupKnob2State);

  // Turn Knob 1 to OFF -> cancels back to start, Knob 2 must remain at level 4
  await evaluate(`
    window.setKnobAngle(1, 0, true, true);
  `);
  await sleep(600);

  const startAfterSetupCancelState = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const bottomStrip = document.getElementById('screenBottomStrip');
      const roller2 = document.getElementById('t3BurnerRoller2');
      const roller1 = document.getElementById('t3BurnerRoller1');
      return {
        t3Stage: window.t3Stage,
        currentLevels: window.currentT3BurnerLevels,
        roller2Active: roller2 ? roller2.classList.contains('is-active') : false,
        roller1Active: roller1 ? roller1.classList.contains('is-active') : false,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null,
        bottomStripHidden: bottomStrip ? bottomStrip.hidden : null
      };
    })()
  `);
  console.log('Start screen after setup cancel (Knob 2 should still be ON):', startAfterSetupCancelState);
  await screenshot('verify_setup_knob2_persists_after_cancel.png');

  // Turn Knob 2 OFF
  await evaluate(`
    window.setKnobAngle(2, 0, true, true);
  `);
  await sleep(300);

  console.log('--- TEST 4: Center Knob 3 (ON/OFF) Responsiveness ---');
  await evaluate(`
    window.setKnobAngle(3, 45, true, true);
  `);
  await sleep(300);

  const centerOnState = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const roller3 = document.getElementById('t3BurnerRoller3');
      return {
        currentLevels: window.currentT3BurnerLevels,
        roller3Active: roller3 ? roller3.classList.contains('is-active') : false,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null
      };
    })()
  `);
  console.log('Center knob ON state:', centerOnState);
  await screenshot('verify_center_knob_on.png');

  await evaluate(`
    window.setKnobAngle(3, 0, true, true);
  `);
  await sleep(300);

  const centerOffState = await evaluate(`
    (() => {
      const hotIndicator = document.getElementById('cooktopHotIndicator');
      const roller3 = document.getElementById('t3BurnerRoller3');
      return {
        currentLevels: window.currentT3BurnerLevels,
        roller3Active: roller3 ? roller3.classList.contains('is-active') : false,
        hotIndicatorHidden: hotIndicator ? hotIndicator.hidden : null
      };
    })()
  `);
  console.log('Center knob OFF state:', centerOffState);
  await screenshot('verify_center_knob_off.png');

  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});
