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
     - **Equally Divided Power Levels (1–10) & 8px Magenta Arc Animation**:
       - Turning Knobs 1, 2, 4, or 5 clockwise rolls the dedicated burner display through power levels 1 to 10 equally divided across the entire arc from MIN ($55^\circ$) to MAX ($270^\circ$, 9 o'clock) inside the dashed white ring with haptic tick audio.
       - **Stop at Power Level (1–10)**: When the knob stops at any power level, a **1.0s quiet delay** runs (debounced so moving the knob resets the timer).
       - **3s Arc Animation**: At 1.0s, an **8px magenta arc** sweeps clockwise around the burner perimeter for **3.0 seconds** (Figma `2990:6407` $\to$ `2990:6457`).
       - **Confirmed Active State**: At 3.0s, the burner enters confirmed status:
         - Background turns to a solid light grey disc (`#D9D8D7`).
         - Numeral turns dark charcoal (`#303238`, font-weight 700).
         - Dashed border and arc disappear.
         - Audio chime plays (`toggleOn`).
       - **Stays on Screen**: The interface **does NOT transition** to any other screen; it stays on the cooktop start screen showing only the confirmed selected number.
       - **Neighboring Numbers Masked**: Adjacent numbers are hidden (`opacity: 0`), displaying only the single selected numeral.
       - Turning the knob to another power level removes the confirmed state and restarts the 1.0s quiet delay for the new level. Turning to OFF immediately resets the burner to idle.
     - **Knob 3 ON/OFF Behavior**: Rotates $0^\circ \to 45^\circ$. Below $25^\circ$, Burner 3 shows OFF / unlit; at $\ge 25^\circ$, it illuminates active and displays bold white "ON" inside the 106px dashed ring.
     - **PRC Rotation, 8px Arc & Smooth Slide-in Motion**:
       - Turning any PRC-enabled knob (1, 2, 4, 5) to `PRC` detent ($-56^\circ$) illuminates the knob LED and displays the glowing white Precision Cooking Temperature Icon inside that burner.
       - **Knob 1 (Front Left)**:
         - Waits **1.0s quiet delay**.
         - Runs **8px magenta arc** clockwise around burner for **3.0 seconds**.
         - At 3.0s, transitions to confirmed state (solid `#D9D8D7` disc, dark `#303238` icon, Figma `2989:5712`) and plays `toggleOn` chime.
         - After an exact **1.0s delay**, smoothly transits to Precision Cooking Spotlight screen.
       - **Other PRC Burners**:
         - Pops up the white countdown toast card from the bottom edge (`bottom: 14px; left: 180px; width: 750px; height: 60px;`, matching Figma node `2294-11451`) displaying `"Starting Precision Cooking in 3s."` with a live 1-second countdown ticker ($3 \to 2 \to 1$).
       - **✕ Button Direct Skip**: Clicking the vector cross button (`#t3ToastClose`) or "Don’t show again" (`#t3ToastDismiss`) immediately cancels the countdown and navigates directly to Precision Cooking Spotlight without waiting for the 3s timer.
       - **Smooth Slide-in Motion**: Transitions smoothly from right to left (`transform: translate3d(100%, 0, 0)` $\to$ `translate3d(0, 0, 0)` over `0.38s` with `cubic-bezier(0.16, 1, 0.3, 1)`) as the Precision Cooking Spotlight screen slides into view over the Cooktop start screen.
       - **Slide-out on Cancel**: Tapping `< Cooktop` smoothly slides Spotlight back out to the right (`0.32s`), revealing the Cooktop surface and resetting the knob back to OFF ($0^\circ$).
     - **Cancel / Reset**: Turning the active PRC knob back to OFF ($0^\circ$) or clicking `< Cooktop` dismisses the toast, resets the burner roller, and returns the knob to OFF.
   - **Task 3B: Temperature Picker, Preheat & Burner Status Flow**:
     - **Spotlight $\rightarrow$ Temperature**: Tapping the **Temperature** tab navigates to the horizontal temperature picker screen (`task3b-pc-temperature.png`).
     - **Horizontal Carousel Wheel**: Allows scrolling and picking temperatures from $200^\circ\text{F}$ to $500^\circ\text{F}$ in $25^\circ$ increments, centered by default on $375^\circ\text{F}$ with active scaling and snapping.
     - **START Button Tap**:
       - **Activity Bar Rule (Strict)**: The activity bar (`#screenBottomStrip`) is completely **HIDDEN** across `start`, `turnknob`, `spotlight`, and `temperature`. It **ONLY SHOWS UP** starting on `preheat` (and remains on for `completed` and `burnerStatus`).
     - **Temp Expand Preheat Screen (`task3b-temp-expand-preheat-clean.png`)**:
       - Displays live growing temperature from $182^\circ\text{F}$ up to $375^\circ\text{F}$ over exactly $5\text{s}$.
       - Shows dynamic target temperature readout ($375^\circ\text{F}$).
       - After reaching target temp, there is an exact **2s delay** before advancing.
     - **Preheat Complete Screen (`task3b-temp-expand-completed-clean.png`)**:
       - Shows large centered $375^\circ\text{F}$ and *"Preheated"* status.
       - Toast card slides up from bottom: *"Preheat complete.    OK   ✕"*.
       - Stays on this screen for **30 seconds**, or advances immediately if the user taps `OK` or `✕`.
     - **Burner Status Overview Screen (`task3b-burner-status-clean.png` / Figma `2310:12162` & `2310:12166`)**:
       - Displays single active Rear-Left burner card running at $375^\circ\text{F}$ with authentic solid light grey circular badge (`#D9D8D7`), dark thermometer icon (`#303238`), seamless frosted glass card, `COOKTOP HOT` badge, and bottom running activity bar.
       - All other 4 burners remain unlit / OFF until another knob is rotated.
       - Back caret `<` navigation returns to `PCTemperatureRun` screen with horizontal temperature picker while keeping knob ON and activity bar running.
       - Turning knob back to OFF or clicking `< Cooktop` resets the flow back to the start screen.
   - **Task 3C: Food Mode Flow & Dual Active Burner Operation**:
     - **Second Knob Turning (From Burner Status)**: When on the 375°F Burner Status screen, rotating Knob 1 (Front Left) activates the Front Left burner's live level setting animation ($1 \to 10$ across $55^\circ - 270^\circ$).
     - **PRC Detent & Toast**: Rotating to PRC ($-56^\circ$) triggers the 3-second countdown toast card (*"Starting Precision Cooking in 3s."*).
     - **Food Mode Navigation Sequence**:
       1. **Precision Cooking Spotlight** with active **Food** tab.
       2. **Food Options (`2315:14683`)**: Categorized food options.
       3. **Protein Category (`2323:15099`)**: Protein selections.
       4. **Steak Item (`2323:14983`)**: Steak cut selection.
       5. **Vessel Selection (`2323:15041`)**: Pan type (e.g., Cast Iron).
       6. **Doneness Selection (`2323:15136`)**: Medium Rare selection.
       7. **Confirmation Screen (`2348:17304`)**: Summary & START button.
       8. **Dual Preheating Screen (`2348:17501`)**: Both Rear-Left (375°F) and Front-Left (Steak Med Rare) preheating.
       9. **Dual Active Burner Status Overview (`2327:15934`)**: Full overview with both burners running simultaneously.
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
- **Tunnel Command**: `npx --yes localtunnel --port 8080`
- **Current Live URL**: `https://busy-baths-search.loca.lt/?task=3#task3`
- **Tunnel Password / Endpoint IP**: `4.53.66.82`

---

## 🔄 6. How to Resume Work After Antigravity Restart
When opening a new conversation or restarting Antigravity:
1. Open this workspace directory: `/Users/a240165853/Documents/PolarisPrototypeCooktopPrecisionCooking`.
2. Antigravity automatically reads `GEMINI.md` to load full memory of the project.
3. If background tasks stopped, re-launch:
   ```bash
   python3 -m http.server 8080 -d /Users/a240165853/Documents/PolarisPrototypeCooktopPrecisionCooking &
   npx --yes localtunnel --port 8080 &
   ```
4. If Figma MCP is connected, you can directly query Figma components or tokens by node ID or frame name!
