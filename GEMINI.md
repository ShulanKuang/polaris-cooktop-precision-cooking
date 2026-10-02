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
   - **Running Activity Bar**: GPU-accelerated $1024 \times 12\text{px}$ flowing magenta-to-blue gradient along the bottom edge.

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
   - **Task 3A: Precision Cooking Startup Flow**:
     - **Start Screen (`task2-start-new.png`)**: All burners OFF, clean cooktop without Precision Cooking card per Figma node `2345:16560`.
     - **Knob Turning Animation (Min to Max)**: Turning Knob 1 clockwise rolls the rear-left burner display through levels 1 to 10 equally divided across the entire arc from MIN ($55^\circ$) to MAX ($270^\circ$, 9 o'clock) inside the dashed white ring with haptic tick audio.
     - **Knob 1 to PRC**: Turning Knob 1 to `PRC` detent (-56°) illuminates Knob 1 LED and displays the white Precision Cooking Temperature Icon centered within the dashed ring.
     - **2s Delay & Transition**: Holds the temperature icon for 2 seconds, then automatically advances to the Precision Cooking Spotlight screen.
     - **Cancel / Reset**: Turning Knob 1 back to OFF (0°) or clicking `< Cooktop` resets the burner roller and turns Knob 1 OFF.
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
     - **Burner Status Overview Screen (`task3b-burner-status-clean.png`)**:
       - Displays rear-left burner card actively running at $375^\circ\text{F}$ with `COOKTOP HOT` badge and running activity bar.
       - Back caret `<` navigation returns to `PCTemperatureRun` screen with horizontal temperature picker while keeping Knob 1 ON and activity bar running.
       - Turning Knob 1 back to OFF or clicking `< Cooktop` resets the flow back to the start screen.
   - **Physical Cooktop Manifold**: Located 80px below the screen, stretching across the full width of the iPad Pro.
   - **1.5× Scaled Manifold Image (`assets/manifold-new-clean.png`)**:
     - Rendered from Figma vector frame at **2× Retina (4000 × 864 px)** based on 2000 × 432 px artboard.
     - Knobs are **1.45× (~1.5×) larger on screen**, providing comfortable touch targets.
   - **5 Rotatable Knobs**:
     - Touch targets: `calc(232 / 2000 * 100cqw)`
     - Dynamic center calculation: `target.getBoundingClientRect()`
     - Magnetic Detents: Snaps cleanly to `OFF` (0°), `PRC` (-56°), and power levels 1–10 ($55^\circ \to 270^\circ$ in 9 equal intervals of $23.89^\circ$)
     - End-stop enforcement: stops at MAX ($270^\circ$, 9 o'clock) clockwise and PRC ($-56^\circ$) counter-clockwise
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
- **Current Live URL**: `https://clean-stars-beam.loca.lt/?task=3#task3`
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
