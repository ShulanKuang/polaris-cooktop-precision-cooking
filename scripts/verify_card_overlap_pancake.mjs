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

  async function evaluate(expression) {
    const res = await call('Runtime.evaluate', { expression, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function screenshot(filename) {
    const res = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  console.log('--- Reloading page with cache bypass ---');
  await call('Page.reload', { ignoreCache: true });
  await sleep(1000);

  console.log('--- Navigating to Task 3 and Pancakes Guided Cooking ---');
  await evaluate(`
    window.location.hash = '#task3';
    document.documentElement.style.setProperty("--app-scale", "0.8146");
    window.showT3Screen('start');
  `);
  await sleep(400);
  await evaluate(`
    window.setKnobAngle(1, -56, false, false);
    window.startGuidedCooking(1);
  `);
  await sleep(600);

  const ARTIFACTS_DIR = '/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808';

  // Measure function (returns unscaled CSS layout pixels)
  async function measureStepGeometry(stepNum) {
    return await evaluate(`
      (() => {
        const screen = document.getElementById("t3ScreenGuidedCooking");
        const vp = document.getElementById("t3GuidedViewport");
        const sRect = screen.getBoundingClientRect();
        const vpRect = vp.getBoundingClientRect();
        const scaleVal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-scale"));
        const scale = isNaN(scaleVal) || scaleVal <= 0 ? 1 : scaleVal;

        const cards = [1, 2, 3, 4].map(num => {
          const el = document.getElementById("t3GuidedCard" + num);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const isActive = el.classList.contains("is-active");
          const relX = Math.round((r.left - sRect.left) / scale);
          const width = Math.round(r.width / scale);
          return {
            num,
            isActive,
            relX,
            relRight: Math.round((r.right - sRect.left) / scale),
            width,
            height: Math.round(r.height / scale),
            center: Math.round(relX + width / 2)
          };
        });

        // Next or Primary Action button center
        let actionBtnCenter = null;
        const nextBtn = document.getElementById("t3GuidedBtnNext");
        const doneBtn = document.getElementById("t3GuidedBtnDone4");
        if (doneBtn && !doneBtn.hidden && doneBtn.offsetParent !== null) {
          const dr = doneBtn.getBoundingClientRect();
          actionBtnCenter = Math.round(((dr.left - sRect.left) + dr.width / 2) / scale);
        } else if (nextBtn && !nextBtn.hidden && nextBtn.offsetParent !== null) {
          const nr = nextBtn.getBoundingClientRect();
          actionBtnCenter = Math.round(((nr.left - sRect.left) + nr.width / 2) / scale);
        }

        return {
          stepNum: ${stepNum},
          scrollLeft: Math.round(vp.scrollLeft),
          vpRelLeft: Math.round((vpRect.left - sRect.left) / scale),
          vpWidth: Math.round(vpRect.width / scale),
          actionBtnCenter,
          cards
        };
      })()
    `);
  }

  // --- Step 1 ---
  console.log('\n=== Testing Step 1 ===');
  const g1 = await measureStepGeometry(1);
  console.log('Step 1 geometry:', JSON.stringify(g1, null, 2));
  await screenshot(`${ARTIFACTS_DIR}/verify_overlap_step1.png`);

  // Assertions for Step 1:
  // Card 1 active at ~296px, width ~350px, center ~471px (over action button at ~467px)
  const c1_s1 = g1.cards[0];
  if (!c1_s1.isActive) throw new Error('Card 1 should be active in Step 1');
  if (Math.abs(c1_s1.relX - 296) > 4) throw new Error(`Card 1 relX (${c1_s1.relX}) expected ~296`);
  if (Math.abs(c1_s1.center - g1.actionBtnCenter) > 8) throw new Error(`Card 1 center (${c1_s1.center}) not aligned with button (${g1.actionBtnCenter})`);
  console.log('PASS: Step 1 active Card 1 centered over action button at relX = 296');

  // --- Step 2 ---
  console.log('\n=== Advancing to Step 2 ===');
  await evaluate(`window.setGuidedStep(2);`);
  await sleep(700); // allow 500ms smooth scroll + 500ms width transition to complete

  const g2 = await measureStepGeometry(2);
  console.log('Step 2 geometry:', JSON.stringify(g2, null, 2));
  await screenshot(`${ARTIFACTS_DIR}/verify_overlap_step2.png`);

  // Assertions for Step 2:
  // Card 1 collapsed at relX ~204px (width 80px), overlapping pancake image (x=24..252)!
  // Card 2 active at relX ~296px (width 350px), center ~471px (over action button at ~467px)
  const c1_s2 = g2.cards[0];
  const c2_s2 = g2.cards[1];
  if (c1_s2.isActive) throw new Error('Card 1 should be collapsed in Step 2');
  if (!c2_s2.isActive) throw new Error('Card 2 should be active in Step 2');
  if (Math.abs(c1_s2.relX - 204) > 4) throw new Error(`Card 1 relX (${c1_s2.relX}) expected ~204`);
  if (c1_s2.relX < 0) throw new Error(`Card 1 is clipped outside viewport left!`);
  if (c1_s2.relX >= 252) throw new Error(`Card 1 does not overlap pancake (relX=${c1_s2.relX})`);
  if (Math.abs(c2_s2.relX - 296) > 4) throw new Error(`Card 2 relX (${c2_s2.relX}) expected ~296`);
  if (Math.abs(c2_s2.center - g2.actionBtnCenter) > 8) throw new Error(`Card 2 center (${c2_s2.center}) not aligned with button (${g2.actionBtnCenter})`);
  console.log(`PASS: Step 2 Card 1 relX=${c1_s2.relX} overlaps pancake image (x=24..252) WITHOUT CUTOFF!`);
  console.log(`PASS: Step 2 active Card 2 centered over action button at relX = 296`);

  // --- Step 3 ---
  console.log('\n=== Advancing to Step 3 ===');
  await evaluate(`window.setGuidedStep(3);`);
  await sleep(700);

  const g3 = await measureStepGeometry(3);
  console.log('Step 3 geometry:', JSON.stringify(g3, null, 2));
  await screenshot(`${ARTIFACTS_DIR}/verify_overlap_step3.png`);

  // Assertions for Step 3:
  // Card 1 collapsed at relX ~112px! (Spans 112..192px on top of pancake)
  // Card 2 collapsed at relX ~204px! (Spans 204..284px on top of pancake)
  // Card 3 active at relX ~296px (width 350px), center ~471px
  const c1_s3 = g3.cards[0];
  const c2_s3 = g3.cards[1];
  const c3_s3 = g3.cards[2];
  if (!c3_s3.isActive) throw new Error('Card 3 should be active in Step 3');
  if (Math.abs(c1_s3.relX - 112) > 4) throw new Error(`Card 1 relX (${c1_s3.relX}) expected ~112`);
  if (Math.abs(c2_s3.relX - 204) > 4) throw new Error(`Card 2 relX (${c2_s3.relX}) expected ~204`);
  if (Math.abs(c3_s3.relX - 296) > 4) throw new Error(`Card 3 relX (${c3_s3.relX}) expected ~296`);
  if (Math.abs(c3_s3.center - g3.actionBtnCenter) > 8) throw new Error(`Card 3 center (${c3_s3.center}) not aligned with button (${g3.actionBtnCenter})`);
  console.log(`PASS: Step 3 Card 1 (relX=${c1_s3.relX}) and Card 2 (relX=${c2_s3.relX}) overlap pancake WITHOUT CUTOFF!`);
  console.log(`PASS: Step 3 active Card 3 centered over action button at relX = 296`);

  // --- Step 4 ---
  console.log('\n=== Advancing to Step 4 ===');
  await evaluate(`window.setGuidedStep(4);`);
  await sleep(700);

  const g4 = await measureStepGeometry(4);
  console.log('Step 4 geometry:', JSON.stringify(g4, null, 2));
  await screenshot(`${ARTIFACTS_DIR}/verify_overlap_step4.png`);

  // Assertions for Step 4:
  // Card 1 collapsed at relX ~20px! (Spans 20..100px on top of pancake)
  // Card 2 collapsed at relX ~112px! (Spans 112..192px on top of pancake)
  // Card 3 collapsed at relX ~204px! (Spans 204..284px on top of pancake)
  // Card 4 active at relX ~296px (width 350px), center ~471px (over Done button at ~467px)
  const c1_s4 = g4.cards[0];
  const c2_s4 = g4.cards[1];
  const c3_s4 = g4.cards[2];
  const c4_s4 = g4.cards[3];
  if (!c4_s4.isActive) throw new Error('Card 4 should be active in Step 4');
  if (Math.abs(c1_s4.relX - 20) > 4) throw new Error(`Card 1 relX (${c1_s4.relX}) expected ~20`);
  if (Math.abs(c2_s4.relX - 112) > 4) throw new Error(`Card 2 relX (${c2_s4.relX}) expected ~112`);
  if (Math.abs(c3_s4.relX - 204) > 4) throw new Error(`Card 3 relX (${c3_s4.relX}) expected ~204`);
  if (Math.abs(c4_s4.relX - 296) > 4) throw new Error(`Card 4 relX (${c4_s4.relX}) expected ~296`);
  if (Math.abs(c4_s4.center - g4.actionBtnCenter) > 8) throw new Error(`Card 4 center (${c4_s4.center}) not aligned with button (${g4.actionBtnCenter})`);
  console.log(`PASS: Step 4 Cards 1, 2, 3 (relX=${c1_s4.relX}, ${c2_s4.relX}, ${c3_s4.relX}) ALL overlap pancake WITHOUT CUTOFF!`);
  console.log(`PASS: Step 4 active Card 4 centered over action button at relX = 296`);

  // --- Step 4 -> Click Card 1 to rewind ---
  console.log('\n=== Tapping on Card 1 (at relX=20) while in Step 4 to rewind to Step 1 ===');
  await evaluate(`
    document.getElementById("t3GuidedCard1").click();
  `);
  await sleep(700);

  const g1_return = await measureStepGeometry(1);
  console.log('Return to Step 1 geometry:', JSON.stringify(g1_return, null, 2));
  if (!g1_return.cards[0].isActive) throw new Error('Card 1 should be active after tapping it');
  if (Math.abs(g1_return.cards[0].relX - 296) > 4) throw new Error(`Card 1 relX (${g1_return.cards[0].relX}) expected ~296`);
  console.log('PASS: Tapping Card 1 smoothly rewound to Step 1 and centered Card 1 at relX = 296!');

  console.log('\n=============================================');
  console.log('ALL VERIFICATIONS PASSED WITH 100% PRECISION!');
  console.log('=============================================\n');

  ws.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
