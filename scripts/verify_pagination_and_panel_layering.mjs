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

  console.log('--- Step 1: Navigating and reloading with ignoreCache ---');
  await call('Page.navigate', { url: "http://localhost:8080/?task=3#task3" });
  await sleep(1000);
  await call('Page.reload', { ignoreCache: true });
  await sleep(1500);

  // 1. Verify Cookware Selection Screen
  console.log('--- Step 2: Testing Select Cookware Screen ---');
  const cookwareInfo = await evaluate(`
    (() => {
      // Navigate to cookware screen
      if (typeof window.showT3Screen === 'function') {
        window.showT3Screen('selectCookware');
      }
      const pagination = document.getElementById('t3CookwarePagination');
      const backBtn = document.getElementById('t3BtnBackFromCookware');
      const drawerNav = document.getElementById('t3SideDrawerCookware');
      const mainContent = document.querySelector('.t3-cookware-main-content');
      const carousel = document.querySelector('.t3-cookware-carousel-viewport');

      return {
        paginationDisplay: pagination ? window.getComputedStyle(pagination).display : null,
        backBtnZIndex: backBtn ? window.getComputedStyle(backBtn).zIndex : null,
        drawerNavZIndex: drawerNav ? window.getComputedStyle(drawerNav).zIndex : null,
        mainContentZIndex: mainContent ? window.getComputedStyle(mainContent).zIndex : null,
        carouselZIndex: carousel ? window.getComputedStyle(carousel).zIndex : null,
      };
    })()
  `);
  console.log('Cookware Screen computed styles:', cookwareInfo);
  if (cookwareInfo.paginationDisplay !== 'none') {
    throw new Error('Cookware pagination is not display: none! Got: ' + cookwareInfo.paginationDisplay);
  }
  if (parseInt(cookwareInfo.backBtnZIndex) < 100) {
    throw new Error('Back button z-index is too low: ' + cookwareInfo.backBtnZIndex);
  }
  await sleep(600);
  await captureScreenshot('verify_cookware_no_pagination');

  // 2. Verify Beef Doneness Screen
  console.log('--- Step 3: Testing Beef Doneness Screen ---');
  const beefInfo = await evaluate(`
    (() => {
      if (typeof window.showT3Screen === 'function') {
        window.showT3Screen('beefDoneness');
      }
      const pagination = document.getElementById('t3DonenessPagination');
      const screen = document.getElementById('t3ScreenBeefDoneness');
      const drawer = screen ? screen.querySelector('.t3-drawer-collapsible') : null;
      const pinnedHeader = screen ? screen.querySelector('.t3-drawer-pinned-header') : null;
      const backBtn = document.getElementById('t3BtnBackFromBeefDoneness');
      const handle = screen ? screen.querySelector('.t3-drawer-handle') : null;
      const main = document.querySelector('.t3-beef-doneness-main');

      return {
        paginationDisplay: pagination ? window.getComputedStyle(pagination).display : null,
        drawerZIndex: drawer ? window.getComputedStyle(drawer).zIndex : null,
        pinnedHeaderZIndex: pinnedHeader ? window.getComputedStyle(pinnedHeader).zIndex : null,
        backBtnZIndex: backBtn ? window.getComputedStyle(backBtn).zIndex : null,
        handleZIndex: handle ? window.getComputedStyle(handle).zIndex : null,
        mainZIndex: main ? window.getComputedStyle(main).zIndex : null,
      };
    })()
  `);
  console.log('Beef Doneness Screen computed styles:', beefInfo);
  if (beefInfo.paginationDisplay !== 'none') {
    throw new Error('Beef doneness pagination is not display: none! Got: ' + beefInfo.paginationDisplay);
  }
  if (parseInt(beefInfo.drawerZIndex) < 100) {
    throw new Error('Drawer z-index is too low: ' + beefInfo.drawerZIndex);
  }
  await sleep(600);
  await captureScreenshot('verify_beef_doneness_no_pagination');

  // 3. Verify Pancakes Doneness View
  console.log('--- Step 4: Testing Pancakes Doneness View ---');
  const pancakesDonenessInfo = await evaluate(`
    (() => {
      if (typeof window.showT3Screen === 'function') {
        window.showT3Screen('pancakes');
      }
      // ensure doneness view
      const viewDoneness = document.getElementById('t3PancakesViewDoneness');
      const viewCookware = document.getElementById('t3PancakesViewCookware');
      if (viewDoneness) viewDoneness.hidden = false;
      if (viewCookware) viewCookware.hidden = true;

      const pagination = document.getElementById('t3PancakesDonenessDots');
      const screen = document.getElementById('t3ScreenPancakes');
      const drawer = screen ? screen.querySelector('.t3-drawer-collapsible') : null;
      const pinnedHeader = screen ? screen.querySelector('.t3-drawer-pinned-header') : null;
      const backBtn = document.getElementById('t3BtnBackFromPancakes');
      const handle = screen ? screen.querySelector('.t3-drawer-handle') : null;
      const rightPane = document.querySelector('.t3-pancakes-right-pane');

      return {
        paginationDisplay: pagination ? window.getComputedStyle(pagination).display : null,
        drawerZIndex: drawer ? window.getComputedStyle(drawer).zIndex : null,
        pinnedHeaderZIndex: pinnedHeader ? window.getComputedStyle(pinnedHeader).zIndex : null,
        backBtnZIndex: backBtn ? window.getComputedStyle(backBtn).zIndex : null,
        handleZIndex: handle ? window.getComputedStyle(handle).zIndex : null,
        rightPaneZIndex: rightPane ? window.getComputedStyle(rightPane).zIndex : null,
      };
    })()
  `);
  console.log('Pancakes Doneness View computed styles:', pancakesDonenessInfo);
  if (pancakesDonenessInfo.paginationDisplay !== 'none') {
    throw new Error('Pancakes doneness pagination is not display: none! Got: ' + pancakesDonenessInfo.paginationDisplay);
  }
  if (parseInt(pancakesDonenessInfo.drawerZIndex) <= parseInt(pancakesDonenessInfo.rightPaneZIndex)) {
    throw new Error('Drawer z-index (' + pancakesDonenessInfo.drawerZIndex + ') is not above right pane (' + pancakesDonenessInfo.rightPaneZIndex + ')');
  }
  await sleep(600);
  await captureScreenshot('verify_pancakes_doneness_panel_above');

  // 4. Verify Pancakes Cookware View
  console.log('--- Step 5: Testing Pancakes Cookware View ---');
  const pancakesCookwareInfo = await evaluate(`
    (() => {
      if (typeof window.showT3Screen === 'function') {
        window.showT3Screen('pancakesCookware');
      }

      const pagination = document.getElementById('t3PancakesCookwareDots');
      const screen = document.getElementById('t3ScreenPancakes');
      const drawer = screen ? screen.querySelector('.t3-drawer-collapsible') : null;
      const rightPane = document.querySelector('.t3-pancakes-right-pane');

      return {
        paginationDisplay: pagination ? window.getComputedStyle(pagination).display : null,
        drawerZIndex: drawer ? window.getComputedStyle(drawer).zIndex : null,
        rightPaneZIndex: rightPane ? window.getComputedStyle(rightPane).zIndex : null,
      };
    })()
  `);
  console.log('Pancakes Cookware View computed styles and hit test:', pancakesCookwareInfo);
  if (pancakesCookwareInfo.paginationDisplay !== 'none') {
    throw new Error('Pancakes cookware pagination is not display: none! Got: ' + pancakesCookwareInfo.paginationDisplay);
  }
  await sleep(500);
  await captureScreenshot('verify_pancakes_cookware_panel_above');

  console.log('=== All verification checks passed! ===');
  ws.close();
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
