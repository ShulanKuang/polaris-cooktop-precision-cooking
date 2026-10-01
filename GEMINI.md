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

3. **Task 3: Usability Flow & Physical Knobs Manifold** (`?task=3#task3`)
   - **Task 3A: Precision Cooking Startup Flow**:
     - **Start Screen (`task3a-start.png`)**: All burners OFF, left card shows *"Precision Cooking / Select temperature or mode for precise results! / Explore"*.
     - **Knob 1 Interaction**: Turning Knob 1 to `PRC` position (-56°) illuminates Knob 1 LED indicator and activates the rear-left burner on screen (`task3a-turnknob.png`).
     - **Countdown Toast (`t3-toast-card`)**: Bottom white toast card ($750 \times 60\text{px}$) slides up with *"Starting Precision Cooking in 3s."* (counts down $3\text{s} \rightarrow 2\text{s} \rightarrow 1\text{s}$).
     - **Spotlight Transition**: After 3s holding time, directly transitions to Precision Cooking Spotlight screen (`task3a-pc-spotlight.png`).
     - **Cancel / Reset**: Turning Knob 1 back to OFF or clicking `✕` dismisses the toast and resets to start. Clicking `< Cooktop` returns to start and turns Knob 1 OFF.
   - **Task 3B: Temperature Picker, Preheat & Burner Status Flow**:
     - **Spotlight $\rightarrow$ Temperature**: Tapping the **Temperature** tab navigates to the horizontal temperature picker screen (`task3b-pc-temperature.png`).
     - **Horizontal Carousel Wheel**: Allows scrolling and picking temperatures from $200^\circ\text{F}$ to $500^\circ\text{F}$ in $25^\circ$ increments, centered by default on $375^\circ\text{F}$ with active scaling and snapping.
     - **START Button Tap**:
       - **Activity Bar Rule (Strict)**: The activity bar (`#screenBottomStrip`) is completely **HIDDEN** across `start`, `turnknob`, `spotlight`, and `temperature`. It **ONLY SHOWS UP** starting on `preheat` (and remains on for `completed` and `burnerStatus`).
     - **Temp Expand Preheat Screen (`task3b-temp-expand-preheat-clean.png`)**:
       - Displays live growing temperature from $182^\circ\text{F}$ up to $375^\circ\text{F}$ over exactly $5\text{s}$.
       - Shows dynamic target temperature readout ($375^\circ\text{F}$).
     - **Preheat Complete Screen (`task3b-temp-expand-completed-clean.png`)**:
       - Shows large centered $375^\circ\text{F}$ and *"Preheated"* status.
       - Toast card slides up from bottom: *"Preheat complete.    OK   ✕"*.
       - After $3\text{s}$ holding time (or upon tapping `OK` or `✕`), transitions directly to the final `burnerStatus` screen.
     - **Burner Status Overview Screen (`task3b-burner-status-clean.png`)**:
       - Displays rear-left burner card actively running at $375^\circ\text{F}$ with `COOKTOP HOT` badge and running activity bar.
       - Turning Knob 1 back to OFF or clicking `< Cooktop` resets the flow back to the start screen.
   - **Physical Cooktop Manifold**: Located 80px below the screen, stretching across the full width of the iPad Pro.
   - **Direct Figma Vector SVG (`assets/manifold-figma.svg`)**: Native `viewBox="0 0 2894 432"` containing vector path text (`OFF`, `PRC`, `MAX`, `MIN`, `ON`), tick marks, thermometer icons, and burner locator rectangles using exact Roux token `--core-color-steel-40: rgba(75, 76, 82, 1)` (`#4B4C52`).
   - **5 Rotatable Knobs**: Sized at $232\text{px}$ touch targets with `assets/knob-nose-figma.png` ($111 \times 250\text{px}$) and active glowing LED indicators `assets/knob-light-figma.png` ($96 \times 50\text{px}$).
   - **Magnetic Detents**: Snaps cleanly to `OFF` (0°) and `PRC` (-56°).

---

## 📐 2. Canvas & Display Geometry

| Component | Resolution / Aspect Ratio | Visual Styling / Notes |
| :--- | :--- | :--- |
| **Appliance Touch Screen** | $1024 \times 384\text{px}$ (6.75" ROUX display) | Centered inside dark appliance bezel; rounded corners (8px) |
| **Physical Knobs Manifold** | $2894 \times 432\text{px}$ (`aspect-ratio: 2894 / 432`) | Vector SVG; brushed stainless background `#b1b1b1` |
| **iPad Pro 13" Physical Scale** | `transform: scale(0.8146)` | Renders display at authentic 1:1 physical dimensions on iPad Pro (2752×2064, ~264 PPI) |
| **Knob Nose Asset** | $111 \times 250\text{px}$ (`assets/knob-nose-figma.png`) | Center-anchored rotation |
| **Knob Light Indicator** | $96 \times 50\text{px}$ (`assets/knob-light-figma.png`) | Glows white when turned to PRC/ON; unlit when OFF |

### 5 Knobs Coordinate Map (relative to 2894 × 432 SVG canvas):
- **Knob 1 (Front Left)**: `cx = 22.94402%` ($664 / 2894$), `cy = 53.24074%` ($230 / 432$)
- **Knob 2 (Rear Left)**: `cx = 36.45473%` ($1055 / 2894$), `cy = 53.24074%` ($230 / 432$)
- **Knob 3 (Center)**: `cx = 49.96545%` ($1446 / 2894$), `cy = 53.24074%` ($230 / 432$)
- **Knob 4 (Rear Right)**: `cx = 63.47616%` ($1837 / 2894$), `cy = 53.24074%` ($230 / 432$)
- **Knob 5 (Front Right)**: `cx = 76.98687%` ($2228 / 2894$), `cy = 53.24074%` ($230 / 432$)
- **Dial Pitch**: Exactly $391\text{px}$ ($13.51\%$) between all adjacent centers.

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
- **Current Live URL**: `https://chatty-dogs-kiss.loca.lt/?task=3#task3`
- **Tunnel Password / Endpoint IP**: `4.53.66.82`
