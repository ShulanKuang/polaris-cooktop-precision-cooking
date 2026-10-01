# Polaris Cooktop Precision Cooking Prototype

Interactive prototype for the **October 2026 Polaris Cooktop Precision Cooking User Testing**. Designed specifically for the **ROUX 6.75" appliance touchscreen** (1024 × 384 px) with dedicated researcher controls docked outside the appliance canvas, and an authentic **5-knob physical manifold** positioned beneath the display.

---

## 🚀 Live Interactive Prototype Links

Click below to open and test the prototype directly:

* **[Live Web Prototype Link](https://clean-stars-beam.loca.lt/?task=3#task3)**  
  *(If prompted for a tunnel password / Endpoint IP, enter: `4.53.66.82`)*

* **Local iPad / Lab Wi-Fi Link**: `http://10.35.122.114:8080/?task=3#task3`  
  *(Recommended for zero latency when on the same Wi-Fi network as the host machine)*

* **Direct Browser**:  
  Clone or download this repository, and open `index.html` in Safari, Chrome, or Edge.

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
| **Task 3: Usability Flow** | **COMPLETE** | Full interactive precision cooking workflow (Tasks 3A & 3B) with authentic 1.5× physical knobs manifold. | • **New 1.5× Scaled Physical Knobs Manifold** (`aspect-ratio: 2000 / 432`) at 2× Retina resolution (4000 × 864 px)<br>• **5 Rotatable Knobs with Pointer/Touch Drag & Tap Toggle** (`knob-nose-figma.png`)<br>• **Glowing LED Light Indicators (`knob-light-figma.png`)**: Unlit in standby, illuminates white when turned to PRC/ON<br>• **Magnetic Detents**: Snaps cleanly to `OFF` (0°) and `PRC` (-56°)<br>• **Precision Cooking Start Flow**: Turn Knob 1 to PRC $\to$ 3s countdown toast $\to$ Spotlight screen<br>• **Interactive Temperature Picker**: Horizontal scroll carousel ($200^\circ\text{F} - 500^\circ\text{F}$ in $25^\circ$ increments, default $375^\circ\text{F}$)<br>• **Preheating Animation**: Activity bar starts running on START tap; live temperature climbs $182^\circ\text{F} \to 375^\circ\text{F}$ over 5s $\to$ 2s delay $\to$ "Preheat complete" toast (30s timeout or OK/✕)<br>• **Burner Status Screen**: Active rear-left burner card at 375°F with `COOKTOP HOT` badge and running activity bar<br>• **Back Navigation**: Returns to `PCTemperatureRun` maintaining active running burner and activity bar. |

---

## 🍳 Task 3 Flow Details (Precision Cooking Usability Flow)

### 1. Startup via Physical Knob 1
- **Standby (`Task3A-start`)**: All burners OFF. Manifold panel sits beneath display with 5 clean, unlit knobs.
- **Turn Knob 1 to PRC**: Dragging or tapping Knob 1 to $-56^\circ$ (`PRC` detent):
  - Knob 1 LED indicator illuminates white.
  - Rear-left burner activates on screen (`Task3A-turnKnob`).
  - Toast card slides up from bottom: *"Starting Precision Cooking in 3s."* (counts down $3\text{s} \to 2\text{s} \to 1\text{s}$).
  - Turning Knob 1 back to OFF or clicking `✕` cancels the flow.
- **Spotlight Screen (`Task3A-PCSpotlight`)**: After the 3s holding countdown, transitions directly to the Precision Cooking Spotlight screen.

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
- **Burner Status Overview (`Task3B-burnerStatus`)**:
  - Shows the rear-left burner actively running at $375^\circ\text{F}$ with `COOKTOP HOT` badge and bottom running activity bar.
- **Back Navigation**: Tapping `<` returns to `PCTemperatureRun` screen with horizontal temperature picker while keeping Knob 1 ON and the activity bar running.

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
