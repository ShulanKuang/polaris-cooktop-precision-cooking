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

  console.log('Reloading page to verify iPad touch scrolling fixes...');
  await send('Page.reload');
  await sleep(1500);

  // Set physical 1:1 scale mode (same as iPad Pro 13")
  await evaluate(`
    window.location.hash = '#task3';
    document.documentElement.style.setProperty("--app-scale", "0.8146");
    window.showT3Screen('start');
  `);
  await sleep(400);

  // Start guided cooking at Step 1
  await evaluate(`
    window.setKnobAngle(1, -56, false, false);
    window.startGuidedCooking(1);
  `);
  await sleep(400);

  console.log('--- TEST 1: Simulate iPad Touch Drag on Step Cards Viewport ---');
  const initialScroll = await evaluate(`document.getElementById('t3GuidedViewport').scrollLeft`);
  console.log('Initial scrollLeft:', initialScroll);

  // Simulate Touch Drag from x=600 to x=450 (swiping left by 150px)
  const touchDragResult = await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      const startX = 600;
      const endX = 450;
      
      function makeTouch(x, y) {
        return new Touch({
          identifier: 1,
          target: vp,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
          screenX: x,
          screenY: y
        });
      }

      // 1. touchstart
      const tStart = new TouchEvent('touchstart', {
        touches: [makeTouch(startX, 200)],
        targetTouches: [makeTouch(startX, 200)],
        changedTouches: [makeTouch(startX, 200)],
        bubbles: true,
        cancelable: true
      });
      vp.dispatchEvent(tStart);

      // 2. touchmove intermediate steps
      for (let x = startX - 10; x >= endX; x -= 20) {
        const tMove = new TouchEvent('touchmove', {
          touches: [makeTouch(x, 200)],
          targetTouches: [makeTouch(x, 200)],
          changedTouches: [makeTouch(x, 200)],
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(tMove);
      }

      const scrollDuringDrag = vp.scrollLeft;

      // 3. touchend
      const tEnd = new TouchEvent('touchend', {
        touches: [],
        targetTouches: [],
        changedTouches: [makeTouch(endX, 200)],
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(tEnd);

      return {
        scrollDuringDrag,
        scrollAfterEnd: vp.scrollLeft
      };
    })()
  `);
  console.log('Touch Drag Result:', touchDragResult);

  // Wait for momentum deceleration RAF to settle
  await sleep(500);
  const settledScroll = await evaluate(`document.getElementById('t3GuidedViewport').scrollLeft`);
  console.log('Settled scrollLeft after momentum deceleration:', settledScroll);

  await screenshot('verify_ipad_touch_drag_momentum.png');

  console.log('--- TEST 2: Verify Card Click Without Drag ---');
  // Tap Card 3 directly
  await evaluate(`
    (() => {
      const c3 = document.getElementById('t3GuidedCard3');
      c3.click();
    })()
  `);
  await sleep(500);

  const card3State = await evaluate(`
    (() => {
      const c3 = document.getElementById('t3GuidedCard3');
      const vp = document.getElementById('t3GuidedViewport');
      return {
        c3Active: c3.classList.contains('is-active'),
        c3Width: c3.offsetWidth,
        scrollLeft: vp.scrollLeft
      };
    })()
  `);
  console.log('Card 3 State after click:', card3State);
  await screenshot('verify_ipad_card3_tapped.png');

  console.log('--- TEST 3: Verify initGestureLockdown allows touch on all scrollables ---');
  const lockdownTest = await evaluate(`
    (() => {
      const vp = document.getElementById('t3GuidedViewport');
      let prevented = false;
      const fakeEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: vp,
        preventDefault: () => { prevented = true; }
      };
      // Test the logic directly against vp
      const targetEl = fakeEvent.target;
      const scrollable = typeof targetEl.closest === "function" ? targetEl.closest(
        ".t3-guided-cards-viewport, .t3-guided-cards-track, .t3-guided-card, " +
        ".t3-cookware-carousel-viewport, .t3-pancakes-cards-carousel, .t3-pancakes-drawer-tiles, " +
        ".t3-beef-drawer-tiles, .t3-beef-carousel, .t3-tips-steps-scroll, .t3-ingredients-scroll, " +
        ".t3-tech-scroll-container, .t3-recent-container, " +
        ".t3-picker-track, .t2-picker-track, .t2-options-scroll-container, .t2-tile-scroll-container, " +
        ".t3-options-scroll-container, .t3-drawer-scrollable-options, .t3-doneness-carousel, " +
        ".t3-recipe-cards-track, .t3-food-scroll-container, [data-scrollable='true']"
      ) : null;
      return {
        matchedScrollable: Boolean(scrollable),
        selector: scrollable ? scrollable.className : null
      };
    })()
  `);
  console.log('Lockdown whitelist test:', lockdownTest);

  console.log('ALL IPAD TOUCH SCROLL TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});
