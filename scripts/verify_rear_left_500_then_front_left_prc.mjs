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

  // Step 1: Navigate to fresh Task 3 and reload with ignoreCache
  console.log('--- Step 1: Navigating to Task 3 ---');
  await call('Page.navigate', { url: "http://localhost:8080/?task=3#task3" });
  await sleep(1000);
  await call('Page.reload', { ignoreCache: true });
  await sleep(2500);

  // Step 2: Turn Rear Left (Knob 2) to Precision Cooking (-56 deg)
  console.log('--- Step 2: Turn Knob 2 (Rear Left) to PRC ---');
  await evaluate(`
    window.setKnobAngle(2, -56, true, true);
  `);

  // Wait 4.2s: 1.0s pre-arc + 2.0s arc countdown + 0.8s confirm hold + 0.4s slide transition
  console.log('Waiting 4.2s for Knob 2 arc completion and slide to temperature screen...');
  await sleep(4200);

  const stageAfterK2 = await evaluate(`
    ({
      t3Stage: window.t3Stage,
      tempScreenHidden: document.getElementById("t3ScreenTemperature") ? document.getElementById("t3ScreenTemperature").hidden : true,
      activeKnob: window.activePrcKnobIndex,
      temp: window.PolarisApp ? window.PolarisApp.state.task3TargetTemp : null
    })
  `);
  console.log('State after Knob 2 to PRC and transition:', stageAfterK2);

  // Step 3: Set temp to 500°F and click Start
  console.log('--- Step 3: Setting Rear Left temp to 500°F and clicking START ---');
  await evaluate(`
    window.scrollToT3Temp(500, false);
  `);
  await sleep(300);

  const tempAfterScroll = await evaluate(`
    ({
      targetTemp: window.PolarisApp ? window.PolarisApp.state.task3TargetTemp : null,
      k2TargetTemp: window.t3BurnerTargetTemps ? window.t3BurnerTargetTemps[2] : null
    })
  `);
  console.log('Target temp after scrollToT3Temp(500):', tempAfterScroll);

  await evaluate(`
    document.getElementById("t3BtnStartTemp").click();
  `);
  await sleep(600);

  // Fast forward preheat to reach burnerStatus at 500°F
  console.log('Fast forwarding preheat completion to burnerStatus (500°F)...');
  await evaluate(`
    window.startT3PreheatCompleted();
  `);
  await sleep(1500);

  const statusAfterPreheat = await evaluate(`
    ({
      t3Stage: window.t3Stage,
      targetTemp: window.PolarisApp ? window.PolarisApp.state.task3TargetTemp : null,
      k2TargetTemp: window.t3BurnerTargetTemps ? window.t3BurnerTargetTemps[2] : null,
      tileLiveTempText: document.getElementById("t3TileLiveTemp") ? document.getElementById("t3TileLiveTemp").textContent : null,
      burner1TempText: document.getElementById("tStartBurner1Temp") ? document.getElementById("tStartBurner1Temp").textContent : null
    })
  `);
  console.log('Status after preheat completion:', statusAfterPreheat);
  await captureScreenshot('verify_prc_step1_rear_left_500_ready');

  // Step 4: Turn Front Left (Knob 1) to Precision Cooking (-56 deg)
  console.log('--- Step 4: Turn Front Left (Knob 1) to PRC ---');
  await evaluate(`
    window.setKnobAngle(1, -56, true, true);
  `);

  // Wait 1.5s: 1.0s pre-arc finishes, 2.0s arc countdown is actively running!
  await sleep(1500);

  const arcState = await evaluate(`
    (() => {
      const rollerStart = document.getElementById("t3BurnerRoller1");
      const rollerStatus = document.getElementById("t3StatusBurnerRoller1");
      const arcSvg = document.getElementById("t3StatusBurnerPrcArc1");
      return {
        rollerStatusClasses: rollerStatus ? rollerStatus.className : null,
        hasArc: rollerStatus ? rollerStatus.classList.contains("has-arc") : false,
        isArcing: rollerStatus ? rollerStatus.classList.contains("is-arcing") : false,
        isPrcMode: rollerStatus ? rollerStatus.classList.contains("is-prc-mode") : false,
        activePrcKnobIndex: window.activePrcKnobIndex,
        arcSvgDisplay: arcSvg ? window.getComputedStyle(arcSvg).display : null
      };
    })()
  `);
  console.log('Front Left Arc state during 2s countdown:', arcState);
  await captureScreenshot('verify_prc_step2_front_left_arc_countdown');

  // Step 5: Wait 1.6s more (total 3.1s since turning knob): arc completes and confirmed state is active
  console.log('--- Step 5: Waiting for Front Left 2s countdown completion ---');
  await sleep(1600);

  const confirmedState = await evaluate(`
    (() => {
      const rollerStatus = document.getElementById("t3StatusBurnerRoller1");
      return {
        rollerStatusClasses: rollerStatus ? rollerStatus.className : null,
        isConfirmed: rollerStatus ? rollerStatus.classList.contains("is-confirmed") : false,
        activePrcKnobIndex: window.activePrcKnobIndex
      };
    })()
  `);
  console.log('Front Left confirmed state after 2.0s arc:', confirmedState);
  await captureScreenshot('verify_prc_step3_front_left_confirmed');

  // Step 6: Wait 1.2s more (total 4.3s): 0.8s hold + 0.4s slide transition to Precision Cooking screen
  console.log('--- Step 6: Waiting for transition to Precision Cooking screen ---');
  await sleep(1200);

  const tempScreenState = await evaluate(`
    (() => {
      const tempScreen = document.getElementById("t3ScreenTemperature");
      const drawer = document.getElementById("t3SideDrawerTemp");
      const activeTab = drawer ? drawer.querySelector(".pc-drawer-item.is-active") : null;
      return {
        t3Stage: window.t3Stage,
        tempScreenHidden: tempScreen ? tempScreen.hidden : true,
        activePrcKnobIndex: window.activePrcKnobIndex,
        frontLeftTargetTemp: window.PolarisApp ? window.PolarisApp.state.task3TargetTemp : null,
        k1StoredTemp: window.t3BurnerTargetTemps ? window.t3BurnerTargetTemps[1] : null,
        k2StoredTemp: window.t3BurnerTargetTemps ? window.t3BurnerTargetTemps[2] : null,
        activeTab: activeTab ? activeTab.dataset.t3tab : null
      };
    })()
  `);
  console.log('Screen state on Precision Cooking screen:', tempScreenState);
  await captureScreenshot('verify_prc_step4_front_left_temp_screen');

  // Step 7: Click Back `< Precision Cooking` and verify return to burnerStatus
  console.log('--- Step 7: Click Back `< Precision Cooking` ---');
  await evaluate(`
    document.getElementById("t3BtnBackFromTemp").click();
  `);
  await sleep(1000);

  const backState = await evaluate(`
    (() => {
      const burnerStatusScreen = document.getElementById("t3ScreenBurnerStatus");
      return {
        t3Stage: window.t3Stage,
        burnerStatusHidden: burnerStatusScreen ? burnerStatusScreen.hidden : true,
        tileLiveTempText: document.getElementById("t3TileLiveTemp") ? document.getElementById("t3TileLiveTemp").textContent : null,
        burner1TempText: document.getElementById("tStartBurner1Temp") ? document.getElementById("tStartBurner1Temp").textContent : null,
        k2StoredTemp: window.t3BurnerTargetTemps ? window.t3BurnerTargetTemps[2] : null,
        activePrcKnobIndex: window.activePrcKnobIndex
      };
    })()
  `);
  console.log('Screen state after clicking Back:', backState);
  await captureScreenshot('verify_prc_step5_back_to_burner_status_500');

  // Step 8: Turn off Knob 2 (Rear Left) -> return to start with all off
  console.log('--- Step 8: Turn off Knob 2 (Rear Left) ---');
  await evaluate(`
    window.setKnobAngle(2, 0, true, true);
  `);
  await sleep(1000);

  const finalState = await evaluate(`
    (() => {
      const startScreen = document.getElementById("t3ScreenStart");
      const burner1Live = document.getElementById("tStartActiveBurner1");
      return {
        t3Stage: window.t3Stage,
        startScreenHidden: startScreen ? startScreen.hidden : true,
        burner1LiveHidden: burner1Live ? burner1Live.hidden : true
      };
    })()
  `);
  console.log('Final state after Knob 2 OFF:', finalState);
  await captureScreenshot('verify_prc_step6_all_off_start_screen');

  ws.close();
  console.log('--- Verification Complete! ---');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
