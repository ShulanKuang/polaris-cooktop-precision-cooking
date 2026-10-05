# Polaris Cooktop Precision Cooking Prototype

Interactive prototype for the **October 2026 Polaris Cooktop Precision Cooking User Testing**. Designed specifically for the **ROUX 6.75" appliance touchscreen** (1024 × 384 px) with dedicated researcher controls docked outside the appliance canvas, and an authentic **5-knob physical manifold** positioned beneath the display.

---

## 🚀 Live Interactive Prototype Links

Choose any of the following methods to open and test the prototype directly:

* **🌟 [Permanent GitHub Pages Link](https://shulankuang.github.io/polaris-cooktop-precision-cooking/?task=3#task3)**  
  *(Permanent cloud-hosted link that never expires and requires no password. To enable on your repo: go to **Settings** → **Pages** → under **Source**, choose **GitHub Actions** or **Deploy from a branch (`main` / root)**).*

* **⚡ [Live Web Tunnel Link (Active Now)](https://huge-zoos-build.loca.lt/?task=3#task3)**  
  *(Live web mirror directly from this machine. If prompted for a tunnel password / Endpoint IP, enter: `4.53.66.82`)*

* **📶 Local iPad / Lab Wi-Fi Link**: `http://10.35.122.114:8080/?task=3#task3`  
  *(Recommended for zero-latency in-person testing when your iPad is connected to the same Wi-Fi network as this computer)*

* **💻 Direct Local Browser**:  
  Clone or download this repository, and open [`index.html`](index.html) directly in Safari, Chrome, or Edge. You can also run:
  ```bash
  python3 -m http.server 8080
  ```
  and visit `http://localhost:8080/?task=3#task3`.

---

## 📱 iPad Setup for User Testing

To achieve the authentic, borderless appliance feel during user research:
1. Open the prototype link in **Safari** on the iPad.
2. Tap the **Share** button (square with upward arrow).
3. Select **"Add to Home Screen"**.
4. Launch the app from the home screen icon — it runs full-screen without browser URL bars or navigation tabs!

---

## 📏 Physical 1:1 Hardware Scale (iPad Pro 13" Calibration)

To ensure true-to-life ergonomics, reachability, and touch target sizing during in-person testing, the prototype accurately scales the 1024 × 384 px digital canvas to match the physical ROUX 6.75" appliance hardware:

* **Real Physical Dimensions**: **160.512 mm** wide × **60.192 mm** tall
* **iPad Pro 13-inch (M5) Retina**: 264 physical PPI (132 CSS points/in)
* **Calibrated Scale Ratio**: **0.8146×** (`834.16 CSS px ÷ 1024 px`)
* **Researcher Controls**: Tap **`📏 Physical 1:1 (160.5mm)`** or **`100% Canvas`** in the top right corner of the toolbar to instantly switch between physical size and full-width presentation.
* **Vertical Position Stability**: The researcher subbar (`.researcher-subbar`) is locked to an exact fixed height of **52px** across all three tasks, guaranteeing zero vertical shifting or jumping of the appliance screen when switching between tasks.

---

## 📋 User Test Plan & Status

The prototype includes an external researcher toolbar positioned above the appliance screen:

| Task | Status | Focus / Objectives | Controls Available |
| :--- | :---: | :--- | :--- |
| **Task 1: Awareness Test** | **COMPLETE** | Test whether participants notice active heating burners and precision cooking states during quick glance exposures. | • **0.5s / 1s / 2s glance reveal buttons**<br>• **Silent execution** (zero sound cues to prevent audio bias)<br>• **1024 × 12px running activity bar** (magenta ⇄ blue left-to-right)<br>• **Stable 140px status pill** (`Hidden`, `Revealed`, `Preview`) |
| **Task 2: Concept Evaluation** | **COMPLETE** | Evaluate participant comprehension of Precision Cooking pillars (Spotlight, Technique, Food, Temperature Picker, and Digital Pad). | • **Explore Screen (`PC-explore`)** with clickable Explore button<br>• **Tab Navigation Bar** (Spotlight, Technique, Food, Temperature)<br>• **Dynamic Buttontile Components** with official Roux design tokens<br>• **Vertical Scrollable Tiles** for Food & Technique with top crop at $y = 179\text{px}$<br>• **Hardware-accelerated Backdrop Blur** (`-webkit-backdrop-filter: blur(16px)`)<br>• **Temperature Picker ⇄ Digital Pad Switcher** via secondary round button<br>• **Interactive Digipad Keypad** (0-9, Clear, Backspace, live display)<br>• *(Note: Activity bar removed from Task 2 per design direction)* |
| **Task 3: Usability Flow** | **COMPLETE** | Full interactive precision cooking workflow (Tasks 3A & 3B) with authentic 1.5× physical knobs manifold and live burner roller. | • **New 1.5× Scaled Physical Knobs Manifold** (`aspect-ratio: 2000 / 432`) at 2× Retina resolution (4000 × 864 px)<br>• **5 Rotatable Knobs with Pointer/Touch Drag & Tap Toggle** (`knob-nose-figma.png`)<br>• **Glowing LED Light Indicators (`knob-light-figma.png`)**: Unlit in standby, illuminates white when turned to PRC/ON<br>• **Magnetic Detents**: Snaps cleanly to `OFF` (0°), `PRC` (-56°), and power levels 1–10 ($55^\circ - 270^\circ$ evenly distributed)<br>• **Min to Max Knob Turning Animation**: Dedicated burner dynamically rolls numbers 1–10 equally divided throughout the full $55^\circ \to 270^\circ$ clockwise rotation ($215^\circ$ total arc span) with tick audio<br>• **PRC Temperature Icon & 3s Countdown Toast**: Turning any PRC knob to PRC shows the glowing temperature icon, pops up the white 3s countdown toast 14px above screen bottom edge, with ✕ button instant skip<br>• **Smooth Slide-in Transition**: Precision Cooking Spotlight screen smoothly slides into view from the right (`0.38s cubic-bezier(0.16, 1, 0.3, 1)`)<br>• **Interactive Temperature Picker**: Horizontal scroll carousel ($200^\circ\text{F} - 500^\circ\text{F}$ in $25^\circ$ increments, default $375^\circ\text{F}$)<br>• **Preheating Animation**: Activity bar starts running on START tap; live temperature climbs $182^\circ\text{F} \to 375^\circ\text{F}$ over 5s $\to$ 2s delay $\to$ "Preheat complete" toast (30s timeout or OK/✕)<br>• **Burner Status Screen**: Active burner card at 375°F with `COOKTOP HOT` badge and running activity bar<br>• **Back Navigation**: Returns to `PCTemperatureRun` maintaining active running burner and activity bar. |

---

## 🍳 Task 3 Flow Details (Precision Cooking Usability Flow)

### 1. Startup via Physical Knob
- **Standby (`Task3A-start`)**: All burners OFF. Manifold panel sits beneath display with 5 clean, unlit knobs.
- **Continuous Knob Turning (Min to Max & PRC)**: Turning any standard knob (1, 2, 4, 5) clockwise rolls the dedicated burner display through power levels **1 to 10** equally divided across the entire arc from MIN (55 deg) to MAX (270 deg). Users can seamlessly continue turning clockwise past Level 10/MAX directly into **PRC** (-56 deg) without getting locked at MAX!
- **Turn Knob to PRC (1s Quiet Delay + Toast Quick Raise-Up)**:
  - Knob LED indicator illuminates white.
  - Dedicated burner immediately displays the glowing white **Precision Cooking Temperature Icon**.
  - **1s Quiet Delay**: The screen stays quiet on the home view for 1.0s without displaying the toast.
  - **Toast Quick Raise-Up**: At t = 1.0s, the white toast card quickly raises up from the bottom edge ( above bottom edge, ): "Starting Precision Cooking in 3s."
  - **3-Second Countdown**: Live countdown ticker ticks 3 -> 2 -> 1 with audio ticks.
  - **Direct Skip**: Clicking the vector close button or "Don’t show again" immediately advances directly to Spotlight without waiting.
  - **Synchronized Screen Push-Slide Transition**: Advancing to Spotlight executes a synchronized screen push-slide ( pushes left 0% -> -25% while  slides in from right 100% -> 0% with elevation shadow in 0.40s).

### 2. Temperature Selection & Preheating
- **Navigate to Temperature**: Tapping the temperature section or tab opens `Task3B-PCTemperature`.
- **Horizontal Temperature Picker**: Custom horizontal wheel ($200^\circ\text{F} - 500^\circ\text{F}$ in $25^\circ$ steps), centered on $375^\circ\text{F}$ with touch-snap physics and tick audio.
- **Tap START**:
  - **Activity Bar Rule**: The bottom flowing magenta-to-blue activity bar **only starts appearing now**! (It does NOT show up before START is tapped).
- **Temp Expand Preheat Screen (`Task3B-TempExpandPreheat`)**:
  - Live temperature readout dynamically climbs from $182^\circ\text{F}$ to $375^\circ\text{F}$ over **5 seconds**.
  - Once $375^\circ\text{F}$ is reached, there is a **2-second delay**.
- **Preheat Completed Screen (`Task3B-TempExpand`)**:
  - Displays large $375^\circ\text{F}$ and "Preheated" status.
  - Toast popup appears: *"Preheat complete.    OK   ✕"*.
  - Stays on screen for **30 seconds**, or advances immediately if the user taps `OK` or `✕`.
- **Burner Status Overview (`Task3B-burnerStatus` / Figma `2310:12162` & `2310:12166`)**:
  - Shows the rear-left burner actively running at $375^\circ\text{F}$ with authentic solid light grey circular badge (`#D9D8D7`), dark thermometer icon (`#303238`), seamless frosted glass card, `COOKTOP HOT` badge, and bottom running activity bar.
  - All other 4 burners are OFF until the user turns another knob.
- **Back Navigation**: Tapping `<` returns to `PCTemperatureRun` screen with horizontal temperature picker while keeping Knob 2 ON and the activity bar running.

### 3. Food Mode & Multi-Burner Usability Flow (Task 3C)
- **Second Knob Interaction**: From the $375^\circ\text{F}$ Burner Status screen, rotating Knob 1 (Front Left) triggers the live level setting roller animation ($1 \to 10$ power levels).
- **PRC Detent & Countdown Toast**: Rotating Knob 1 to PRC ($-56^\circ$) pops up the 3s countdown toast (*"Starting Precision Cooking in 3s."*) with instant skip option.
- **Direct Navigation into Food Mode**: Spotlight screen transitions into view with the **Food** tab active.
- **Full Recipe Selection Flow**:
  1. **Food Category Options** (Figma `2315:14683`)
  2. **Protein Category** (Figma `2323:15099`)
  3. **Steak Item** (Figma `2323:14983`)
  4. **Cooking Vessel / Pan** (Figma `2323:15041`)
  5. **Doneness (Medium Rare)** (Figma `2323:15136`)
  6. **Summary & Confirmation** (Figma `2348:17304`)
  7. **Dual Preheat Screen** (Figma `2348:17501`) — Both Rear-Left ($375^\circ\text{F}$) and Front-Left (Steak Med Rare) preheat simultaneously!
  8. **Dual Active Burner Status** (Figma `2327:15934`) — Both burners active on the appliance overview screen.
- **Physical Knobs Hardware Metaphor (Knobs Never Auto Turn Off)**:
  - Knobs reflect the physical state of the cooktop dials and never auto-turn off across screen transitions.
  - Both Knob 2 ($-56^\circ$) and Knob 1 ($-56^\circ$) remain illuminated and active simultaneously.
  - Knobs only turn off when the user explicitly rotates or taps them back to $0^\circ$ (OFF).
---

## 🎛️ Manifold & Knobs Geometry (1.5× Enlarged)

The cooktop manifold was upgraded with the new Figma design export at **2000 × 432 px** canvas:

* **Resolution**: Rendered at **2× Retina (4000 × 864 px)** for razor-sharp visual fidelity on iPad Pro 13".
* **On-Screen Size**: Knobs and manifold are **1.45× (~1.5×) larger** on screen compared to the original 2894px frame.
* **Knob Center Coordinates (2000 × 432 coordinate system)**:
  - **Knob 1 (Front Left)**: `10.9%` ($X = 218\text{px}$)
  - **Knob 2 (Rear Left)**: `30.45%` ($X = 609\text{px}$)
  - **Knob 3 (Center)**: `50.0%` ($X = 1000\text{px}$)
  - **Knob 4 (Rear Right)**: `69.55%` ($X = 1391\text{px}$)
  - **Knob 5 (Front Right)**: `89.1%` ($X = 1782\text{px}$)
  - **Center Y**: `53.24074%` ($Y = 230\text{px}$)
  - **Symmetrical Margins**: Exactly $218\text{px}$ from both outer edges.
* **Knob Touch Target & Assembly**: `calc(232 / 2000 * 100cqw)` with centered 3D nose image overlay (`assets/knob-nose-figma.png`).
* **Active LED Glow**: `top: calc(50% - (128.25 / 232 * 100%))` with smooth opacity transition.

---

## 🍳 Task 2 Details (Precision Cooking Concept Evaluation)

Task 2 is fully wired with authentic 1024 × 384 px Figma artboards and interactive components:

1. **Start Screen (`PC-explore`)**: Clickable pill-shaped **Explore** button navigating to Precision Cooking.
2. **Back Navigation (`< Cooktop`)**: Returns to the Explore screen.
3. **Tab Group Navigation**: Spotlight, Technique, Food, and Temperature tabs.
4. **Dynamic Option Tiles**: Authentic `.buttontile` components using Roux tokens (`176 × 96px`, `rgba(75, 76, 82, 0.8)` default, `rgba(244, 244, 242, 1)` selected).
5. **Vertical Scrolling & Top Cropping**: 14 Technique options and 16 Food options scroll smoothly with fixed crop at $y = 179\text{px}$.
6. **Frosted Glass / Background Blur**: `-webkit-backdrop-filter: blur(16px)` with GPU acceleration.
7. **Temperature Dial & Digipad**:
   - Horizontal snap carousel ($200^\circ\text{F} - 500^\circ\text{F}$ in $10^\circ$ increments).
   - 12-key numeric Digipad (0–9, Clear, Backspace).
   - Seamless two-way state synchronization.

---

## 🎛 Task 3 Details (Precision Cooking Flow & Multi-Burner Animated Rollers)

Task 3 replicates the full physical-to-digital interaction model between the 5 cooktop knobs and the appliance touch screen:

1. **5 Interactive Burner Displays (Exact Concentric Alignment)**:
   - **Knob 1 (Far Left)** $\rightarrow$ **Front-Left Burner (128px)**: `left: 323.5px; top: 216px;`
   - **Knob 2 (Mid-Left)** $\rightarrow$ **Rear-Left Burner (128px)**: `left: 323.5px; top: 72px;`
   - **Knob 3 (Center)** $\rightarrow$ **Rear-Center Burner (106px)**: `left: 469px; top: 73px;` (ON/OFF rotary toggle)
   - **Knob 4 (Mid-Right)** $\rightarrow$ **Main Burner (176px)**: `left: 521.5px; top: 169px;` ($1.375\times$ scaled diameter, 52px item height, 47px bold selected numerals, scaled $42\times 55\text{px}$ thermometer SVG)
   - **Knob 5 (Far Right)** $\rightarrow$ **Rear-Right Burner (128px)**: `left: 663px; top: 72px;`
2. **Equally Divided Power Levels (1–10)**:
   - Turning Knobs 1, 2, 4, or 5 clockwise rolls the dedicated burner display through power levels 1 to 10 equally divided across the entire arc from MIN ($55^\circ$) to MAX ($270^\circ$, 9 o'clock) inside the dashed white ring with haptic tick audio.
3. **Knob 3 ON/OFF Behavior**:
   - Rotates $0^\circ \to 45^\circ$. Below $25^\circ$, Burner 3 shows OFF / unlit; at $\ge 25^\circ$, it illuminates active and displays bold white "ON" inside the 106px dashed ring.
4. **Precision Cooking Trigger & 2-Second Hold Delay**:
   - Turning any PRC-enabled knob (1, 2, 4, 5) counter-clockwise to `PRC` detent ($-56^\circ$) illuminates the knob LED and scrolls that burner to the glowing Precision Cooking temperature icon.
   - Holds on the temperature icon for **exactly 2 seconds**, giving the user clear visual feedback before transitioning smoothly to the **Spotlight** screen.
5. **Full Precision Cooking Workflow**:
   - **Spotlight $\rightarrow$ Temperature**: Select recipes or navigate directly to the Temperature tab.
   - **Horizontal Carousel Wheel**: Temperature selection from $200^\circ\text{F}$ to $500^\circ\text{F}$ ($25^\circ\text{F}$ steps).
   - **Preheat & Status Flow**: Live 5-second animated preheat from $182^\circ\text{F}$ to $375^\circ\text{F}$ $\rightarrow$ Preheat Complete banner $\rightarrow$ Active Burner Status card with running activity bar.

---

## 🔬 Task 1 Details (Awareness Test)

* **Silent Operation**: All sounds are disabled for Task 1 to ensure participant responses are purely driven by visual recognition.
* **Standby Shield**: Screen remains hidden under a dark standby cover until the researcher triggers an exposure.
* **Timed Auto-Re-cover**: Clicking `0.5s`, `1s`, or `2s` reveals the screen for that exact duration before automatically returning to standby.
* **Preview Mode**: Clicking `Preview` toggles the screen continuously on/off for inspection.
* **Running Activity Bar**: Seamless gradient animation cycling from magenta to blue to magenta with GPU hardware-accelerated `transform: translate3d(-1024px, 0, 0)` on a dedicated 2048px track.

---

## 🛠 Technical Specifications

* **Appliance Display Canvas**: Exact 1024 × 384 pixels (ROUX 6.75" display aspect ratio).
* **Typography**: GE Appliances Profile Display and Profile Text font families loaded via local `@font-face`.
* **Architecture**: Vanilla HTML5, CSS3, and JavaScript — zero external dependencies, no build steps required.
* **Cache Busting**: Versioned CSS/JS URLs (e.g. `?v=20261001-manifold-15x`) preventing iOS Safari cache issues.
