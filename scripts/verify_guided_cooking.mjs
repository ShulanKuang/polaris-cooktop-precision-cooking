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
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function screenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot to: ${filename}`);
  }

  const artDir = '/Users/a240165853/.gemini/antigravity/brain/f4487080-dcf3-414e-9ecd-baf187b81808';

  console.log('Reloading page with ignoreCache: true...');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 1200));

  // Switch to 100% Canvas mode for exact 1024x384 coordinates
  await evaluate(`
    document.getElementById('btnScaleNative') && document.getElementById('btnScaleNative').click();
  `);
  await new Promise(r => setTimeout(r, 300));

  console.log('\n--- TEST 1: Step Numbers Visibility ---');
  await evaluate(`
    window.location.hash = '#task3';
    window.selectTask && window.selectTask(3);
    window.startGuidedCooking && window.startGuidedCooking(0);
  `);
  await new Promise(r => setTimeout(r, 500));

  const stepNumsStep0 = await evaluate(`
    (() => {
      const nums = [1, 2, 3, 4].map(n => {
        const card = document.getElementById('t3GuidedCard' + n);
        const numEl = card.querySelector('.t3-guided-card-num');
        const cs = window.getComputedStyle(numEl);
        const cardCs = window.getComputedStyle(card);
        const rect = numEl.getBoundingClientRect();
        return {
          step: n,
          text: numEl.textContent.trim(),
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          width: rect.width,
          height: rect.height,
          cardDisplay: cardCs.display,
          isVisible: cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && rect.width > 0
        };
      });
      return nums;
    })()
  `);
  console.log('Step 0 - Inactive Card Step Numbers:');
  console.table(stepNumsStep0);
  stepNumsStep0.forEach(s => {
    if (!s.isVisible) throw new Error(`Step number ${s.step} is not visible in Step 0!`);
  });
  console.log('✓ All step numbers (1, 2, 3, 4) visible in Step 0!');

  await screenshot(`${artDir}/verify_v6_step0_numbers.png`);

  // Switch to Step 1
  await evaluate(`window.startGuidedCooking(1);`);
  await new Promise(r => setTimeout(r, 400));
  const stepNumsStep1 = await evaluate(`
    (() => {
      return [1, 2, 3, 4].map(n => {
        const card = document.getElementById('t3GuidedCard' + n);
        const numEl = card.querySelector('.t3-guided-card-num');
        const cs = window.getComputedStyle(numEl);
        const rect = numEl.getBoundingClientRect();
        return {
          step: n,
          text: numEl.textContent.trim(),
          isVisible: cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && rect.width > 0
        };
      });
    })()
  `);
  console.log('Step 1 - Card Step Numbers:');
  console.table(stepNumsStep1);
  stepNumsStep1.forEach(s => {
    if (!s.isVisible) throw new Error(`Step number ${s.step} is not visible in Step 1!`);
  });
  console.log('✓ All step numbers (1, 2, 3, 4) visible in Step 1!');
  await screenshot(`${artDir}/verify_v6_step1_numbers.png`);

  // Switch to Step 2: verify timer and number 2 both visible without clash
  await evaluate(`window.startGuidedCooking(2);`);
  await new Promise(r => setTimeout(r, 400));
  const step2Elements = await evaluate(`
    (() => {
      const card = document.getElementById('t3GuidedCard2');
      const numEl = card.querySelector('.t3-guided-card-num');
      const timerBtn = card.querySelector('#t3GuidedStartTimer2');
      const numRect = numEl.getBoundingClientRect();
      const btnRect = timerBtn.getBoundingClientRect();
      return {
        numText: numEl.textContent.trim(),
        numRight: numRect.right,
        btnLeft: btnRect.left,
        gap: btnRect.left - numRect.right,
        timerBtnVisible: window.getComputedStyle(timerBtn).display !== 'none'
      };
    })()
  `);
  console.log('Step 2 - Number and Timer button:', step2Elements);
  if (step2Elements.gap < 0) throw new Error('Step 2 number overlaps timer button!');
  console.log(`✓ Step 2 number and timer button both cleanly visible (gap: ${step2Elements.gap}px)!`);
  await screenshot(`${artDir}/verify_v6_step2_active.png`);

  console.log('\n--- TEST 2: Start Next One Button Position (30px from right edge) ---');
  await evaluate(`window.startGuidedCooking(4);`);
  await new Promise(r => setTimeout(r, 400));

  const step4BtnPos = await evaluate(`
    (() => {
      const screen = document.getElementById('cooktopScreen');
      const sRect = screen.getBoundingClientRect();
      const btnNext = document.getElementById('t3GuidedBtnStartNext4');
      const bRect = btnNext.getBoundingClientRect();
      const distFromRight = Math.round(sRect.right - bRect.right);
      return {
        screenWidth: Math.round(sRect.width),
        btnRight: Math.round(bRect.right - sRect.left),
        btnLeft: Math.round(bRect.left - sRect.left),
        btnWidth: Math.round(bRect.width),
        distFromRightEdge: distFromRight
      };
    })()
  `);
  console.log('Step 4 - Start Next One Button Position:', step4BtnPos);
  if (step4BtnPos.distFromRightEdge !== 30) {
    throw new Error(`Start next one button is ${step4BtnPos.distFromRightEdge}px from right edge, expected exactly 30px!`);
  }
  console.log('✓ Start next one button right edge is EXACTLY 30px from right edge of screen!');
  await screenshot(`${artDir}/verify_v6_step4_30px_from_right.png`);

  console.log('\n--- TEST 3: Centered Modal Popups (Shifted left 90px to center in content area) ---');
  // 3A: Next Modal
  await evaluate(`
    document.getElementById('t3GuidedBtnStartNext4').click();
  `);
  await new Promise(r => setTimeout(r, 300));
  const nextModalPos = await evaluate(`
    (() => {
      const screen = document.getElementById('cooktopScreen');
      const sRect = screen.getBoundingClientRect();
      const backdrop = document.getElementById('t3GuidedNextModal');
      const card = backdrop.querySelector('.t3-guided-modal-card');
      const bRect = backdrop.getBoundingClientRect();
      const cRect = card.getBoundingClientRect();
      const cardCenterX = (cRect.left + cRect.right) / 2 - sRect.left;
      const expectedCenterX = 90 + (1024 - 90) / 2; // 557px
      return {
        backdropLeft: Math.round(bRect.left - sRect.left),
        backdropWidth: Math.round(bRect.width),
        cardLeft: Math.round(cRect.left - sRect.left),
        cardWidth: Math.round(cRect.width),
        cardCenterX: Math.round(cardCenterX),
        expectedCenterX,
        isCentered: Math.abs(cardCenterX - expectedCenterX) <= 1
      };
    })()
  `);
  console.log('Next Modal Position:', nextModalPos);
  if (!nextModalPos.isCentered) throw new Error(`Next Modal is off-center: ${nextModalPos.cardCenterX}px vs expected ${nextModalPos.expectedCenterX}px`);
  console.log('✓ Next Modal is perfectly centered at x = 557px in content area!');
  await screenshot(`${artDir}/verify_v6_modal_next_centered.png`);

  // Close Next Modal, Open Done Modal
  await evaluate(`
    document.getElementById('t3GuidedNextModalCancel').click();
    document.getElementById('t3GuidedBtnDone4').click();
  `);
  await new Promise(r => setTimeout(r, 300));

  const doneModalPos = await evaluate(`
    (() => {
      const screen = document.getElementById('cooktopScreen');
      const sRect = screen.getBoundingClientRect();
      const backdrop = document.getElementById('t3GuidedDoneModal');
      const card = backdrop.querySelector('.t3-guided-modal-card');
      const bRect = backdrop.getBoundingClientRect();
      const cRect = card.getBoundingClientRect();
      const cardCenterX = (cRect.left + cRect.right) / 2 - sRect.left;
      const expectedCenterX = 90 + (1024 - 90) / 2; // 557px
      return {
        backdropLeft: Math.round(bRect.left - sRect.left),
        backdropWidth: Math.round(bRect.width),
        cardLeft: Math.round(cRect.left - sRect.left),
        cardWidth: Math.round(cRect.width),
        cardCenterX: Math.round(cardCenterX),
        expectedCenterX,
        isCentered: Math.abs(cardCenterX - expectedCenterX) <= 1
      };
    })()
  `);
  console.log('Done Modal Position:', doneModalPos);
  if (!doneModalPos.isCentered) throw new Error(`Done Modal is off-center: ${doneModalPos.cardCenterX}px vs expected ${doneModalPos.expectedCenterX}px`);
  console.log('✓ Done Modal is perfectly centered at x = 557px in content area!');
  await screenshot(`${artDir}/verify_v6_modal_done_centered.png`);

  console.log('\n--- TEST 4: Cooktop Hot Indicator (12px to left of Beta icon) ---');
  // 4A: On Guided Cooking screen
  // Close Done Modal
  await evaluate(`document.getElementById('t3GuidedDoneModalBtn').click();`);
  await new Promise(r => setTimeout(r, 400));
  // Return to guidedCooking
  await evaluate(`window.startGuidedCooking(1);`);
  await new Promise(r => setTimeout(r, 400));

  const guidedHotPos = await evaluate(`
    (() => {
      const screen = document.getElementById('cooktopScreen');
      const sRect = screen.getBoundingClientRect();
      const ind = document.getElementById('t3GuidedHotIndicator');
      const cs = window.getComputedStyle(ind);
      const iRect = ind.getBoundingClientRect();
      const indLeft = Math.round(iRect.left - sRect.left);
      const indRight = Math.round(iRect.right - sRect.left);
      const betaTagLeft = 828; // In guided_clean_bg.png
      const gapToBeta = betaTagLeft - indRight;
      return {
        hidden: ind.hidden,
        display: cs.display,
        opacity: cs.opacity,
        indLeft,
        indRight,
        indWidth: Math.round(iRect.width),
        gapToBeta,
        isExpectedGap: gapToBeta === 12
      };
    })()
  `);
  console.log('Guided Cooking - Cooktop Hot Indicator Position:', guidedHotPos);
  if (guidedHotPos.hidden || guidedHotPos.display === 'none') {
    throw new Error('Guided cooking Cooktop Hot indicator is hidden!');
  }
  if (!guidedHotPos.isExpectedGap) {
    throw new Error(`Guided cooking Cooktop Hot gap to Beta is ${guidedHotPos.gapToBeta}px, expected 12px!`);
  }
  console.log('✓ Guided cooking Cooktop Hot indicator is visible and exactly 12px to the left of Beta icon!');
  await screenshot(`${artDir}/verify_v6_guided_hot_indicator.png`);

  // 4B: On Start Screen
  console.log('\nTesting Start Screen Cooktop Hot Indicator when burner is active...');
  await evaluate(`
    window.showT3Screen('start');
  `);
  await new Promise(r => setTimeout(r, 400));

  // Initially all knobs off: indicator should be hidden
  const startOffState = await evaluate(`
    (() => {
      const topStatus = document.getElementById('topStatus');
      const hotInd = document.getElementById('cooktopHotIndicator');
      return {
        topStatusHidden: topStatus.hidden,
        hotIndHidden: hotInd.hidden
      };
    })()
  `);
  console.log('Start screen with knobs OFF:', startOffState);

  // Turn Knob 1 to on (level 5 = angle 120)
  await evaluate(`
    window.setKnobAngle && window.setKnobAngle(1, 120, false, true);
  `);
  await new Promise(r => setTimeout(r, 400));

  const startOnState = await evaluate(`
    (() => {
      const screen = document.getElementById('cooktopScreen');
      const sRect = screen.getBoundingClientRect();
      const topStatus = document.getElementById('topStatus');
      const hotInd = document.getElementById('cooktopHotIndicator');
      const betaTag = topStatus.querySelector('.beta-tag-img');
      const hotCs = window.getComputedStyle(hotInd);
      const hRect = hotInd.getBoundingClientRect();
      const bRect = betaTag.getBoundingClientRect();
      const gap = Math.round(bRect.left - hRect.right);
      return {
        topStatusHidden: topStatus.hidden,
        hotIndHidden: hotInd.hidden,
        hotIndVisible: hotCs.display !== 'none' && parseFloat(hotCs.opacity) > 0,
        hotLeft: Math.round(hRect.left - sRect.left),
        hotRight: Math.round(hRect.right - sRect.left),
        betaLeft: Math.round(bRect.left - sRect.left),
        gap,
        is12px: gap === 12
      };
    })()
  `);
  console.log('Start screen with Knob 1 ON:', startOnState);
  if (startOnState.topStatusHidden || startOnState.hotIndHidden) {
    throw new Error('Top status bar or Cooktop Hot indicator is hidden when burner 1 is active on Start screen!');
  }
  if (!startOnState.is12px) {
    throw new Error(`Start screen Cooktop Hot gap to Beta is ${startOnState.gap}px, expected 12px!`);
  }
  console.log('✓ Start screen Cooktop Hot indicator is visible and exactly 12px to the left of Beta icon!');
  await screenshot(`${artDir}/verify_v6_start_screen_hot_indicator.png`);

  // Turn Knob 1 back to OFF (angle 0)
  await evaluate(`
    window.setKnobAngle && window.setKnobAngle(1, 0, false, true);
  `);
  await new Promise(r => setTimeout(r, 400));

  const startOffAfter = await evaluate(`
    (() => {
      const topStatus = document.getElementById('topStatus');
      const hotInd = document.getElementById('cooktopHotIndicator');
      return {
        topStatusHidden: topStatus.hidden,
        hotIndHidden: hotInd.hidden
      };
    })()
  `);
  console.log('Start screen with Knob 1 turned back to OFF:', startOffAfter);
  if (!startOffAfter.topStatusHidden) {
    throw new Error('Top status bar remained visible after turning burner off!');
  }
  console.log('✓ Status bar correctly hides when burner is turned off!');
  await screenshot(`${artDir}/verify_v6_start_screen_all_off.png`);

  ws.close();
  console.log('\n=======================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=======================================');
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
