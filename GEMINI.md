# Polaris Cooktop Precision Cooking Prototype — Project Context & Rules

This file is automatically loaded by Antigravity at the start of any conversation in this project. It preserves all architecture, design tokens, geometry, and behavioral rules so future sessions start with complete memory while saving maximum tokens.

---

## 🎯 1. Project Purpose & Test Plan
This is an interactive high-fidelity web prototype deployed on an **iPad Pro 13"** (running via local server + localtunnel) for conducting usability and glance-awareness testing of the **GE Appliances Polaris Cooktop with Roux Precision Cooking UI**.

### Study Tasks Overview:
1. **Task 1: Awareness Test** (`?task=1#task1`)
   - Evaluates whether participants notice active heating elements and precision cooking status under brief glance exposures.
   - **Glance Reveal**: Timed reveal buttons for `0.5s`, `1s`, `2s`, and `Preview`.
   - **Silent Rule**: Zero audio playback for Task 1 to prevent audio cues from biasing glance awareness.
   - **Status Pill**: Fixed `140px` width pill (`Hidden`, `Revealed (X.Xs)`, `Preview`) to eliminate layout shift.
   - **Running Activity Bar**: GPU-accelerated $1024 \times 12\text{px}$ flowing magenta-to-blue gradient along the bottom edge (hidden under standby cover until revealed).
   - **Awareness Screen Artwork (`assets/task1-awareness-screen.png` / Figma `2294:8399`)**:
     - Background image flipped horizontally (cutting board and vegetables on right, black wild rice on left).
     - Fill opacity set to 60% with darker background for maximum contrast and readability of status text.
     - Dual active burner cards: Caramelize on Left, Bacon on Right.
     - 48px top status bar with $130 \times 24\text{px}$ `COOKTOP HOT` badge (Figma `2315:14060`).

2. **Task 2: Concept Evaluation** (`?task=2#task2`)
   - Evaluates participant comprehension across four Precision Cooking pillars:
     - **Explore Screen (`PC-explore`)**: Pill-shaped Explore button navigating to Precision Cooking.
     - **4 Core Tabs**: **Spotlight** (recipes), **Technique** (cooking methods), **Food** (ingredients), and **Temperature** (precise control).
     - **Dynamic Option Tiles**: Authentic `.buttontile` components using Roux tokens (`176 × 96px`, `rgba(75, 76, 82, 0.8)` default, `rgba(244, 244, 242, 1)` selected).
     - **Scroll & Cropping**: Technique and Food tiles scroll vertically under a fixed header starting at $y = 179\text{px}$.
     - **Temperature Control ($200^\circ\text{F} - 500^\circ\text{F}$ in $10^\circ$ steps)**:
       - Mode A: Horizontal scrollable carousel wheel with magnetic snapping.
       - Mode B: Dynamic 10-key Digipad (`0-9`, `Clear`, `Backspace`, live readout).
       - Switcher: Round secondary keypad button switches seamlessly between Carousel and Digipad.
     - *(Note: Task 2 activity bar removed per design direction)*.

3. **Task 3: Usability Flow & Physical Knobs Manifold** (`?task=3#task3`)
   - **Task 3A: Precision Cooking Startup Flow & 5 Animated Burner Rollers**:
     - **Start Screen (`task3a-start.png` / `task2-start-new.png`)**: All burners OFF, clean cooktop without Precision Cooking card per Figma node `2345:16560`.
     - **5-Knob to 5-Burner Geometry Map (Exact Concentric Alignment)**:
       - **Knob 1 (Far Left)** $\rightarrow$ **Front-Left Burner (128px)**: `left: 323.5px; top: 216px; width: 128px; height: 128px;`
       - **Knob 2 (Mid-Left)** $\rightarrow$ **Rear-Left Burner (128px)**: `left: 323.5px; top: 72px; width: 128px; height: 128px;`
       - **Knob 3 (Center)** $\rightarrow$ **Rear-Center Burner (106px)**: `left: 469px; top: 73px; width: 106px; height: 106px;` (ON/OFF rotary switch, $0^\circ \to 45^\circ$)
       - **Knob 4 (Mid-Right)** $\rightarrow$ **Main Burner (176px)**: `left: 521.5px; top: 169px; width: 176px; height: 176px;` ($1.375\times$ scaled strip, 52px item height, 47px bold selected numerals, scaled $42\times 55\text{px}$ thermometer SVG)
       - **Knob 5 (Far Right)** $\rightarrow$ **Rear-Right Burner (128px)**: `left: 663px; top: 72px; width: 128px; height: 128px;`
     - **Equally Divided Power Levels (1–10) & Direct Confirmation (No Arc)**:
       - Turning Knobs 1, 2, 4, or 5 clockwise rolls the dedicated burner display through power levels 1 to 10 equally divided across the entire arc from MIN ($55^\circ$) to MAX ($270^\circ$, 9 o'clock) inside the dashed white ring with haptic tick audio.
       - **Stop at Power Level (1–10)**: When the knob stops at any power level, a **1.0s quiet delay** runs (debounced so moving the knob resets the timer).
       - **No Magenta Arc for Power Levels**: Magenta arc animation is strictly exclusive to Precision Cooking; it never displays on power levels 1–10.
       - **Confirmed Active White State**: After the 1.0s quiet delay, the burner transitions directly into confirmed active status:
         - Background turns to a solid light grey disc (`#D9D8D7`).
         - Numeral turns dark charcoal (`#303238`, font-weight 700).
         - Dashed border and arc disappear.
         - Audio chime plays (`toggleOn`).
       - **Stays on Screen**: The interface **does NOT transition** to any other screen; it stays on the cooktop start screen showing only the confirmed selected number.
       - **Neighboring Numbers Display**: While setting, moving, and during the arc countdown, previous and next numbers remain visible in gray (`#5C5F68`) above and below the selected white number (e.g. 4 and 6 in gray when 5 is selected). Once confirmed at 3.0s, adjacent numbers smoothly fade out (`opacity: 0`), displaying only the single confirmed numeral on the solid light grey disc.
       - **Audio Feedback on Rotation (All Passed Numbers)**: Uses the current selection sound (`sounds/Touch.wav`). When the knob is rotated quickly across numbers (e.g. swept from OFF through 1–10), every number passed by triggers an audio tick. A Web Audio API polyphonic engine schedules each passed number's tick with an exact 38ms spacing (~26 clicks/sec) so 10 crisp "da, da, da...da" sounds play without clipping, lagging, or dropping. Moving back down plays ticks for every decreasing number passed.
       - Turning the knob to another power level removes the confirmed state and restarts the 1.0s quiet delay for the new level. Turning to OFF immediately resets the burner to idle.
     - **Knob 3 ON/OFF Behavior**: Rotates $0^\circ \to 45^\circ$. Below $25^\circ$, Burner 3 shows OFF / unlit; at $\ge 25^\circ$, it illuminates active and displays bold white "ON" inside the 106px dashed ring.
      - **Precision Cooking (PRC) 2s Magenta Arc & Smooth Slide-in Motion**:
        - Turning or stopping at `PRC` detent ($-56^\circ$) from OFF or from any power level (1–10) reliably starts the PRC sequence: any pending power level confirmation or active power status is immediately cancelled, the knob LED illuminates, and the glowing white Precision Cooking Temperature Icon appears inside that burner.
        - Waits **1.0s quiet delay** before the arc begins.
        - Runs **8px magenta arc** clockwise around the burner closing up in **2.0 seconds** (Figma `2990:6407` $\to$ `2990:6457`).
        - At 2.0s, the circle closes completely and immediately transitions to confirmed active status (solid `#D9D8D7` disc, dark `#303238` thermometer icon, Figma `2989:5712`) and plays `toggleOn` chime.
        - After an exact **1.0s delay** in the confirmed state, smoothly push-slides to the Precision Cooking Spotlight screen (`transform: translate3d(100%, 0, 0)` $\to$ `translate3d(0, 0, 0)` over `0.38s` with `cubic-bezier(0.16, 1, 0.3, 1)`).
        - **Slide-out on Cancel**: Tapping `< Cooktop` smoothly slides Spotlight back out to the right (`0.32s`), revealing the Cooktop surface and resetting the knob back to OFF ($0^\circ$).
      - **Cancel / Reset**: Turning the active PRC knob back to OFF ($0^\circ$) or clicking `< Cooktop` resets the burner roller, cancels arc/countdown timers, and returns the knob to OFF.
   - **Task 3B: Temperature Picker, Digital Pad, Preheat & Burner Status Flow**:
     - **Spotlight $\rightarrow$ Temperature**: Tapping the **Temperature** tab navigates to the horizontal temperature picker screen (`task3b-pc-temperature.png`).
     - **Horizontal Carousel Wheel**: Allows scrolling and picking temperatures from $200^\circ\text{F}$ to $500^\circ\text{F}$ in $25^\circ$ increments, centered by default on **$350^\circ\text{F}$** as the default landing temperature with active scaling and snapping.
     - **Digital Pad Switcher (Figma `3017:25641`)**: Secondary circular keypad button switches seamlessly back and forth between the Horizontal Carousel Wheel and the 10-key Digital Pad screen (`#t3ScreenDigipad`) while preserving target temperature.
     - **START Button Tap**:
       - Directly transitions to the **3-Burner Status Screen (`task3b-burner-status-clean.png` / Figma `2310:12162`)** without intermediate screen detour.
       - **Activity Bar Rule (Strict)**: The activity bar (`#screenBottomStrip`) is completely **HIDDEN** across `start`, `turnknob`, `spotlight`, and `temperature`. It **ONLY SHOWS UP** starting on `preheat` (and remains on for `completed` and `burnerStatus`).
     - **Burner Status Overview Screen (Figma `2310:12162` & `3051:42542`)**:
       - Displays active burner card running at the selected target temperature with authentic solid light grey circular badge (`#D9D8D7`), dark thermometer icon (`#303238`), seamless frosted glass card, `COOKTOP HOT` badge, and bottom running activity bar.
       - **Dynamic Growing Readout**: Card displays mode name `"Temperature"` at top, live growing numbers in middle ($182^\circ\text{F} \to \text{target}$ over 5s), and `"Preheat to [Target]°F"` locked to a single row.
       - **Target Reached & 1.0s Delay**: When temperature reaches target, waits **1.0s delay**, then transitions to 2-row layout (`"Preheated"` above large target temperature, Figma `3051:42542`).
       - **Preheat Complete Toast (Figma `3051:42525`)**: Slides up from bottom (*"Preheat complete.    OK   ✕"*), auto-dismisses after **10 seconds**, or immediately if user taps `OK` or `✕`.
       - **Status Card Tap Navigation (Figma `3017:26093`, `3017:26217`, `2315:14158`)**: Tapping the active burner info card on the Burner Status screen updates the Temperature screen with the currently running temperature and returns to the temperature picker screen with an `UPDATE` button.
       - All other 4 burners remain unlit / OFF until another knob is rotated.
       - Turning knob back to OFF or clicking `< Cooktop` resets the flow back to the start screen.
   - **Task 3C: Food Mode Flow, Multi-Knob Control & Vertical Scrolling**:
     - **Multi-Knob Physical Manifold Control**: All 5 knobs (Knob 1 Front-Left, Knob 2 Rear-Left, Knob 3 Center ON/OFF, Knob 4 Mid-Right Main, Knob 5 Rear-Right) operate independently with magnetic detents and individual state tracking.
     - **Front-Left Burner PRC Activation**: Turning Knob 1 (Front Left) to Precision Cooking detent ($-56^\circ$) directly navigates to the Precision Cooking Temperature Picker screen and enables the **Food** tab (Figma `3021:26359`).
     - **Content-Only Tab Slide Transition**: Switching between Precision Cooking tabs (`temperature`, `food`, `technique`) animates only content elements horizontally (`contentSlideTransition`) while leaving the header, 5-burner mini-map, status bar, and background fixed in place.
     - **Food Mode Options Grid (Figma `3021:26359` & `3060:42632`)**:
       - Displays categorized food option tiles in a **3-column grid** (176px wide cards, 24px gap).
       - **Transparent Tile Background**: Cards have transparent backgrounds (`background: transparent;`) displaying clean white typography directly over the background.
       - **Vertical Scrolling & Touch Drag**: Scroll container starts at $y = 123\text{px}$ from top with height $261\text{px}$. Implements both native momentum scrolling (`touch-action: pan-y !important;`) and programmatic touch drag listeners (`touchstart`, `touchmove`, `touchend`) with movement threshold suppression so dragging does not trigger accidental item selection.
       - **Beef Selection & Transition (Figma `3028:28875`)**: Tapping `Beef` activates the authentic white selected state (`.is-selected`, solid `#FFFFFF` pill with dark `#1E1E24` bold text) and smoothly transitions via content slide to the **Beef Menu screen** (`#t3ScreenBeefMenu`).
     - **Clean 5-Burner Mini-Map**: The authentic 5-burner mini-map baked into the Figma artwork is displayed cleanly without duplicate overlay ghosting.
   - **Task 3E: Caramelize Technique Flow from Main Burner**:
     - **Trigger via Right Front Main Burner (Knob 4)**: Turning Knob 4 to $-56^\circ$ (PRC) or tapping the 176px main burner on `3-start` illuminates the Knob 4 LED, activates the activity bar, activates the $130 \times 24\text{px}$ `COOKTOP HOT` status bar indicator (Figma `2315:14060`), and pops up the 3s countdown toast.
     - **Technique Tab Navigation**: Selecting the Technique tab presents the 8-tile Technique grid (`3E-technique`).
     - **Caramelize Direct Preheating (`2348:17716`)**: Tapping Caramelize begins dynamic temperature ramp ($182^\circ\text{F} \to 375^\circ\text{F}$). The Current number is positioned at `left: 458px; top: 181px; width: 120px; height: 67px;` with line-height 67px, aligning with the Figma `°F` baseline.
     - **Preheated Complete Screen (`2348:17836`) & Toast (`2348:17877`)**: When reaching $375^\circ\text{F}$, transitions to the completed screen and triggers the bottom toast popup. Dismissing via OK/✕ keeps screen stable on `techniqueComplete`.
     - **Reset to Standby**: Turning Knob 4 back to OFF clears burner status, shuts down activity bar, and resets to `3-start`.
   - **Physical Knobs State Persistence Rule (Strict Hardware Metaphor)**:
     - Physical cooktop knobs do not mechanically reset themselves. Knobs **NEVER auto-turn off** across screen transitions, timer completions, or preheating.
     - Any actively running burner keeps its knob turned to $-56^\circ$ (PRC) with its white LED indicator illuminated.
     - When multiple burners are running (e.g. Task 3C), all corresponding physical knobs remain ON simultaneously.
     - Knobs only turn OFF when the user explicitly rotates or taps them back to $0^\circ$ (OFF).
     - When all active knobs are turned off, the screen burner readouts show OFF, the activity bar shuts off, and the interface smoothly resets back to `3-start`.
   - **Physical Cooktop Manifold**: Located 80px below the screen, stretching across the full width of the iPad Pro.
   - **1.5× Scaled Manifold Image (`assets/manifold-new-clean.png`)**:
     - Rendered from Figma vector frame at **2× Retina (4000 × 864 px)** based on 2000 × 432 px artboard.
     - Knobs are **1.45× (~1.5×) larger on screen**, providing comfortable touch targets.
   - **5 Rotatable Knobs**:
     - Touch targets: `calc(232 / 2000 * 100cqw)`
     - Dynamic center calculation: `target.getBoundingClientRect()`
     - Magnetic Detents: Snaps cleanly to `OFF` (0°), `PRC` (-56°), and power levels 1–10 ($55^\circ \to 270^\circ$ in 9 equal intervals of $23.89^\circ$)
     - Continuous Rotation & Detents: Knobs turn freely clockwise through OFF (0°) -> MIN (55°) ... MAX (270°) -> PRC (-56°) -> OFF (0°) without locking at Level 10/MAX!
     - Counter-clockwise rotation from OFF turns directly to PRC (-56°) -> MAX (270°) ... MIN (55°) -> OFF (0°).
     - Toast Popup & 1s Quiet Delay: Entering PRC waits 1s quietly, then toast quickly raises up from bottom with 3s countdown before smooth synchronized screen slide to Spotlight.
     - Click/tap toggles between OFF and PRC
     - Glowing LED indicators: `assets/knob-light-figma.png`

---

## 📐 2. Canvas & Display Geometry

| Component | Resolution / Aspect Ratio | Visual Styling / Notes |
| :--- | :--- | :--- |
| **Appliance Touch Screen** | $1024 \times 384\text{px}$ (6.75" ROUX display) | Centered inside dark appliance bezel; rounded corners (8px) |
| **Physical Knobs Manifold** | $2000 \times 432\text{px}$ (`aspect-ratio: 2000 / 432`) | Retina PNG from vector frame; brushed stainless background `#b1b1b1` |
| **iPad Pro 13" Physical Scale** | `transform: scale(0.8146)` | Renders display at authentic 1:1 physical dimensions on iPad Pro (2752×2064, ~264 PPI) |
| **Knob Nose Asset** | $111 \times 250\text{px}$ (`assets/knob-nose-figma.png`) | Center-anchored rotation |
| **Knob Light Indicator** | $96 \times 50\text{px}$ (`assets/knob-light-figma.png`) | Glows white when turned to PRC/ON; unlit when OFF |

### 5 Knobs Coordinate Map (relative to 2000 × 432 canvas):
- **Knob 1 (Front Left)**: `cx = 10.9%` ($X = 218\text{px}$), `cy = 53.24074%` ($Y = 230\text{px}$)
- **Knob 2 (Rear Left)**: `cx = 30.45%` ($X = 609\text{px}$), `cy = 53.24074%` ($Y = 230\text{px}$)
- **Knob 3 (Center)**: `cx = 50.0%` ($X = 1000\text{px}$), `cy = 53.24074%` ($Y = 230\text{px}$)
- **Knob 4 (Rear Right)**: `cx = 69.55%` ($X = 1391\text{px}$), `cy = 53.24074%` ($Y = 230\text{px}$)
- **Knob 5 (Front Right)**: `cx = 89.1%` ($X = 1782\text{px}$), `cy = 53.24074%` ($Y = 230\text{px}$)
- **Dial Pitch**: Exactly $391\text{px}$ between all adjacent knob centers.
- **Outer Margins**: Symmetrical $218\text{px}$ on both left and right sides.

---

## 🎨 3. Design Tokens & Typography

```css
:root {
  --core-color-steel-40: rgba(75, 76, 82, 1); /* #4B4C52 (Figma manifold text & glyphs) */
  --brands-roux-color-basetile-secondary: rgba(75, 76, 82, 0.8);
  --brands-roux-color-basetile-secondaryselected: rgba(244, 244, 242, 1);
  --brands-roux-color-text-secondaryselected: rgba(31, 32, 36, 1);
  --orange-accent: #ff6d2b;
  --font-display: "Profile Display", system-ui, sans-serif;
  --font-text: "Profile Text", system-ui, sans-serif;
}
```

---

## ⚡ 4. Technical Implementation Rules

1. **Running Activity Bar**:
   - Must ALWAYS use GPU-accelerated `transform: translate3d(-1024px, 0, 0)` $\rightarrow$ `translate3d(0, 0, 0)` on a dedicated 2048px track (`.activity-bar-runner`).
   - Do NOT use `background-position` animations on gradients (Safari/WebKit on iOS does not repaint gradient background positions).
   - Keep the active `requestAnimationFrame` loop in `app.js` as an uninterrupted runtime fallback.
2. **Audio Rules**:
   - Keep all audio **muted** in Task 1.
   - Play tactile touch/tick audio in Task 2 & Task 3 for button taps, knob turns, and stepper clicks.
3. **Cache Busting**:
   - Whenever updating `styles.css` or `app.js`, bump the query string in `index.html` (e.g. `?v=YYYYMMDD-<feature>`) to ensure iOS Safari does not serve stale assets.
4. **Zero Build Step**:
   - Keep project as vanilla HTML5 / CSS3 / JavaScript so it runs instantly on any static HTTP server.

---

## 🚀 5. Testing & Deployment Environment
- **Local Server**: `python3 -m http.server 8080 -d /Users/a240165853/Documents/PolarisPrototypeCooktopPrecisionCooking`
- **Wi-Fi iPad URL**: `http://10.35.123.196:8080/?task=3#task3`
- **Live Web Tunnel URL**: `https://e48738366e84c57c-4-53-66-82.serveousercontent.com/?task=3#task3`
- **Chrome Remote Debugging (CDP)**: `http://127.0.0.1:9245`
- **Latest Asset Cache Buster**: `?v=20261118-guided-v6`

---


## 🛡️ 6. Task 1 Display Removal & Touch/Gesture Lockdown (Oct 8, 2026)
1. **Task 1 (Awareness Test) Display Removal**:
   - Researcher confirmed the Awareness Test is not needed for the upcoming study session.
   - Preserved 100% of the underlying code, markup, assets, and data structures (nothing deleted).
   - Removed from active prototype display: `btnTask1` hidden via `style="display: none !important;"`, `optgroupTask1` hidden in dropdown, subbar title defaults to Task 2, initial task auto-promotes to Task 2 if not explicitly set to 3.
2. **Comprehensive Touch & Gesture Lockdown (No Enlarging / No Shifting)**:
   - Viewport meta updated: `minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no`.
   - CSS fixed layout: `html, body { position: fixed; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; touch-action: none; user-select: none; }`
   - JS gesture interception: `gesturestart/change/end` prevent pinch-to-zoom; multi-touch `touchstart/touchmove` (> 1 touch) prevented; double-tap zoom guarded; `touchmove` outside dedicated scroll containers prevented; `contextmenu` suppressed.
   - Dedicated scroll containers (`.t3-picker-track`, `.t2-picker-track`, `.t2-options-scroll-container`, `.t3-drawer-scrollable-options`, `.t3-doneness-carousel`, `.t3-recipe-cards-track`) retain smooth single-finger momentum scrolling with `overscroll-behavior: contain`.

---

## 🥞 7. Pancakes Guided Cooking Flow (Figma Section 3436:25475 & Nodes 3321:34955, 3345:37922, 3330:37455, 3451:25661, 3299:24163)
1. **Chef Hat Trigger Hit Area (Node 3345:37922 & 3320:34573)**:
   - Hit area on Pancakes burner tile covers Chef Hat icon and text: opens Guided Cooking whether the burner is still preheating or preheat is already complete.
   - Dynamic Entry: If preheating, opens at Step 0 ("Preheat to 400°F"); if preheat is completed, opens directly at Step 1 ("Add butter to coat pan").
2. **Layout & Coordinates**:
   - Container `#t3ScreenGuidedCooking` is offset by `left: 90px; width: 934px;` cleanly starting to the right of the persistent left navbar.
   - Single, non-duplicated `< Cooktop` exit button at top left (`left: 90px`).
   - All 4 step numbers (`1`, `2`, `3`, `4`) remain visible across inactive and active states as direct children of `.t3-guided-card` (`.t3-guided-card-num`).
   - On Steps 2 and 3, number sits at `left: 21px; top: 21px;` while the dark-themed `"Start timer"` button (`#303238`) sits on the right (`right: 21px; top: 21px;`) with an 85px gap.
   - "Start next one" button text is small (`16px`), single line (`white-space: nowrap`), and right edge is anchored at `x = 994px` (exactly `30px` from 1024px screen right edge).
3. **Action Button Disabled Styling (Node 3321:34971)**:
   - During active countdown on Step 0, Step 2, and Step 3, action buttons display in authentic disabled mode:
     - Background: dark grey (`#2a2b30`)
     - Text: muted grey (`rgba(255, 255, 255, 0.45)`, never pure white)
     - Cursor: not-allowed, non-interactive
   - When timer finishes (or preheat finishes), button smoothly switches to active state (solid white `#ffffff` or Roux token, dark text `#1f2024`).
4. **Centered Modals**:
   - Both `.t3-guided-modal-backdrop` popups ("Ready to make another pancake?" loop modal and "Enjoy! Use the knob to turn off the burner" completion modal) are centered at $x = 557\text{px}$ across the 934px content area ($x = 90\text{px} \dots 1024\text{px}$).
   - Tapping "Done" on Enjoy modal returns to the active burner screen (`3299:24163`).
5. **Physical Knob Integration**:
   - Turning the corresponding burner knob back to `OFF` turns off the burner, deactivates the activity bar, and returns cleanly to standby `3-start`.
6. **Cooktop Hot Status Bar Indicator**:
   - Added `#t3GuidedHotIndicator` at `x = 692px`, right edge `816px`, maintaining an exact **12px gap** to the left edge of the Beta icon (`x = 828px`).
   - Dynamically shown whenever any burner is active across both the main Cooktop screen and Guided Cooking screen, and hidden when all burners are OFF.

---

## 🔄 8. How to Resume Work After Antigravity Restart
When opening a new conversation or restarting Antigravity:
1. Open this workspace directory: `/Users/a240165853/Documents/PolarisPrototypeCooktopPrecisionCooking`.
2. Antigravity automatically reads `GEMINI.md` to load full memory of the project.
3. If background tasks stopped, re-launch:
   ```bash
   python3 -m http.server 8080 -d /Users/a240165853/Documents/PolarisPrototypeCooktopPrecisionCooking &
   ssh -o StrictHostKeyChecking=no -R 80:localhost:8080 serveo.net &
   ```
4. If Figma MCP is connected, you can directly query Figma components or tokens by node ID or frame name!

