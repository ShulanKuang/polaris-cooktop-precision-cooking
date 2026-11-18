# Polaris Cooktop Precision Cooking Prototype

Interactive prototype for the **October 2026 Polaris Cooktop Precision Cooking User Testing**. Designed specifically for the **ROUX 6.75" appliance touchscreen** (1024 × 384 px) with dedicated researcher controls docked outside the appliance canvas, and an authentic **5-knob physical manifold** positioned beneath the display.

---

## 🚀 Live Interactive Prototype Links

Choose any of the following methods to open and test the prototype directly:

* **⚡ [Live Web Tunnel Link (Active Now)](https://crazy-lies-shave.loca.lt/?task=3#task3)**  
  *(Live web mirror hosted directly from this machine for testing anywhere, even outside office Wi-Fi. If prompted for a tunnel password / Endpoint IP, enter: `4.53.66.82`)*

* **📶 Local iPad / Lab Wi-Fi Link**: `http://10.35.123.196:8080/?task=3#task3`  
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
| **Task 1: Awareness Test** | **ARCHIVED / HIDDEN** | *(Removed from display per research review; all code, assets, and data preserved)* Originally evaluated glance awareness of active heating burners and precision cooking states. | • **Preserved in Code**: Complete DOM markup, glance timing engine (0.5s / 1s / 2s), and flipped Figma 2294:8399 assets remain fully intact for future recall.<br>• **Display Hidden**: Switcher button and screen jumper options cleanly hidden from participant and researcher views. |
| **Task 2: Concept Evaluation** | **ACTIVE** | Evaluate participant comprehension of Precision Cooking pillars (Spotlight, Technique, Food, Temperature Picker, and Digital Pad). | • **Explore Screen (`PC-explore`)** with clickable Explore button<br>• **Tab Navigation Bar** (Spotlight, Technique, Food, Temperature)<br>• **Dynamic Buttontile Components** with official Roux design tokens<br>• **Vertical Scrollable Tiles** for Food & Technique with top crop at $y = 179\text{px}$<br>• **Hardware-accelerated Backdrop Blur** (`-webkit-backdrop-filter: blur(16px)`)<br>• **Temperature Picker ⇄ Digital Pad Switcher** via secondary round button<br>• **Interactive Digipad Keypad** (0-9, Clear, Backspace, live display)<br>• *(Note: Activity bar removed from Task 2 per design direction)* |
| **Task 3: Usability Flow** | **ACTIVE** | Full interactive precision cooking workflow (Tasks 3A, 3B, 3C, 3E) with authentic 1.5× physical knobs manifold, 2s 8px magenta arc countdown for Precision Cooking, 1s delay direct active status for Power Levels 1–10, multi-tick rotary audio, dynamic preheat temperature status, vertical food options scrolling, and dual-knob control. | • **New 1.5× Scaled Physical Knobs Manifold** (`aspect-ratio: 2000 / 432`) at 2× Retina resolution (4000 × 864 px)<br>• **5 Rotatable Knobs with Pointer/Touch Drag & Tap Toggle** (`knob-nose-figma.png`)<br>• **Glowing LED Light Indicators (`knob-light-figma.png`)**: Unlit in standby, illuminates white when turned to PRC/ON<br>• **Magnetic Detents**: Snaps cleanly to `OFF` (0°), `PRC` (-56°), and power levels 1–10 ($55^\circ - 270^\circ$ evenly distributed)<br>• **Rotary Encoder Multi-Tick Audio**: Web Audio API polyphonic engine plays selection tick sound (`Touch.wav`) for every single number passed by during fast sweeps (e.g. 10 rapid "da-da-da...da" clicks for 1–10 at 38ms spacing), reproducing physical haptic ratchet feel<br>• **Power Levels 1–10 Direct Confirmation (No Arc)**: Stopping at any power level waits 1.0s quiet delay, directly transforms into active confirmed status (solid `#D9D8D7` disc, dark `#303238` numeral, chime), hides neighboring gray numbers, and stays permanently on the start screen without showing any magenta arc<br>• **Precision Cooking 2s Magenta Arc Countdown**: Turning any PRC knob to Precision Cooking waits 1.0s quiet delay, runs an 8px magenta arc closing up in 2.0s to confirmed state (`#D9D8D7` disc with dark thermometer), delays 1.0s, and smoothly slides to Precision Cooking Spotlight<br>• **Interactive Temperature Picker & Digital Pad**: Horizontal scroll carousel ($200^\circ\text{F} - 500^\circ\text{F}$) and 10-key digital pad with seamless two-way switching<br>• **Burner Status Screen (Figma 2310:12162 & 3051:42542)**: Active burner card running at target temperature with live dynamic climbing readout, 1.0s target reached delay, and 2-row preheated state<br>• **Preheat Complete Toast (Figma 3051:42525)**: Slides up from bottom with 10s auto-dismiss<br>• **Food Mode Grid & Vertical Scroll (Figma 3021:26359 & 3060:42632)**: 3 cards per row, transparent background, touch drag scrolling, and Beef selection transitioning to Beef Menu (Figma 3028:28875). |

---

## 🔒 iPad Touch & Gesture Lockdown (Zero Enlarging or Shifting)

To prevent unintentional viewport shifting, bounce, or accidental zooming when participants touch or swipe the screen:
1. **Viewport Fixed Lock**: `html, body` is strictly fixed (`position: fixed; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; touch-action: none;`), eliminating Safari's elastic drag and rubber-band bounce.
2. **Pinch-to-Zoom Prevention**: Active JavaScript interceptors (`gesturestart`, `gesturechange`, `gestureend` calling `e.preventDefault()`) block Safari's multi-touch pinch magnification.
3. **Multi-Touch Zoom Suppression**: `touchstart` and `touchmove` events with `e.touches.length > 1` are intercepted and cancelled immediately.
4. **Selective Touch Routing**: Touch scrolling is strictly confined to designated scroll containers (`.t3-picker-track`, `.t2-picker-track`, `.t2-options-scroll-container`, `.t3-drawer-scrollable-options`, `.t3-doneness-carousel`, `.t3-recipe-cards-track`), while touch movement on the manifold, bezels, buttons, and canvas is prevented from panning the viewport.
5. **Double-Tap Zoom Blocked**: Non-interactive double-taps are cancelled within a 300ms window, and button elements leverage `touch-action: manipulation` for instant, non-zooming single taps.
6. **Selection & Loupe Suppression**: Context menus and callout loupes (`contextmenu`, `-webkit-touch-callout: none; user-select: none;`) are completely suppressed.

---

## 🍳 Task 3 Flow Details (Precision Cooking Usability Flow)

### 1. Startup via Physical Knob
- **Standby (`Task3A-start`)**: All burners OFF. Manifold panel sits beneath display with 5 clean, unlit knobs.
- **Continuous Knob Turning (Min to Max & PRC)**: Turning any standard knob (1, 2, 4, 5) clockwise rolls the dedicated burner display through power levels **1 to 10** equally divided across the entire arc from MIN (55 deg) to MAX (270 deg). While setting and moving the knob, previous and next numbers remain visible in gray above and below the selected number (e.g. 4 and 6 in gray when 5 is selected). Users can seamlessly continue turning clockwise past Level 10/MAX directly into **PRC** (-56 deg) without getting locked at MAX!
- **Power Levels 1–10 Confirmation**:
  - Stopping at any power level (1–10) begins a **1.0s quiet delay**.
  - **No magenta arc** appears for power levels.
  - After 1.0s, the burner disc background transitions directly to the active white status (solid light grey `#D9D8D7` circle, dark `#303238` numeral, neighboring gray numbers hidden, and confirmation chime).
  - Stays permanently on the home start screen without navigating away.
- **Turn Knob to Precision Cooking (PRC)**:
  - Turning or stopping at PRC (whether directly counter-clockwise from OFF, or clockwise past power levels 1–10) always reliably triggers the precision cooking sequence.
  - Any previous power level confirmation or pending timers are automatically cancelled.
  - Knob LED indicator illuminates white.
  - Dedicated burner displays the glowing white **Precision Cooking Temperature Icon**.
  - **1.0s Pre-Delay**: The screen stays quiet on the home view for 1.0s.
  - **2-Second Magenta Arc Countdown**: A solid 8px magenta arc (`#cf42b7`) starts from 12 o'clock and closes up smoothly over **2.0 seconds** around the burner circle.
  - **Confirmed State**: At 2.0s, the circle closes completely and immediately switches to the confirmed active status (solid `#D9D8D7` disc, dark `#303238` thermometer icon, and confirmation chime).
  - **1.0s Transition Delay**: The confirmed status stays visible for 1.0s, and then smoothly push-slides to the Precision Cooking Spotlight screen.

### 2. Temperature Selection & Preheating
- **Navigate to Temperature**: Tapping the temperature section or tab opens `Task3B-PCTemperature`.
- **Horizontal Temperature Picker & Digital Pad**: Custom horizontal wheel ($200^\circ\text{F} - 500^\circ\text{F}$ in $25^\circ$ steps), centered on $375^\circ\text{F}$ with touch-snap physics and tick audio. Circular keypad button toggles seamlessly with the 10-key Digital Pad screen (Figma `3017:25641`).
- **Tap START**:
  - **Direct Transition to Burner Status**: Directly navigates to the 3-Burner Status screen (`Task3B-burnerStatus` / Figma `2310:12162`).
  - **Activity Bar Rule**: The bottom flowing magenta-to-blue activity bar **only starts appearing now**! (It does NOT show up before START is tapped).
- **Burner Status Overview (`Task3B-burnerStatus` / Figma `2310:12162` & `3051:42542`)**:
  - Shows the rear-left burner actively running at the selected target temperature with authentic solid light grey circular badge (`#D9D8D7`), dark thermometer icon (`#303238`), seamless frosted glass card, `COOKTOP HOT` badge, and bottom running activity bar.
  - **Live Dynamic Temperature**: Title displays `"Temperature"`, number climbs smoothly ($182^\circ\text{F} \to \text{target}$ over 5s), and `"Preheat to [Target]°F"` remains locked to a single line.
  - **Target Reached & 1.0s Delay**: When reaching target temperature, waits 1.0s before transforming into the 2-row `"Preheated"` card.
  - **Preheat Complete Toast (Figma `3051:42525`)**: Slides up from bottom (*"Preheat complete.    OK   ✕"*) with 10s auto-dismiss.
  - **Status Card Tap Navigation (Figma `3017:26093`, `3017:26217`, `2315:14158`)**: Tapping the active burner info card opens the temperature picker screen with the current running temperature and `UPDATE` button.
  - All other 4 burners are OFF until the user turns another knob.

### 3. Food Mode & Multi-Burner Usability Flow (Task 3C)
- **Multi-Knob Rotation & Control**: All 5 knobs can be independently turned and controlled.
- **Front-Left Knob PRC Activation**: Turning Knob 1 (Front Left) to PRC ($-56^\circ$) directly navigates to the Precision Cooking Temperature Picker and enables the **Food** tab (Figma `3021:26359`).
- **Content-Only Slide Transition**: Switching between Precision Cooking tabs (`temperature`, `food`, `technique`) animates content smoothly to left/right while keeping header, mini-map, status bar, and background fixed.
- **Food Mode Grid & Vertical Scrolling (Figma `3021:26359` & `3060:42632`)**:
  - Categorized food option tiles arranged in 3 columns.
  - Transparent card background with crisp white typography.
  - Smooth vertical touch dragging & momentum scrolling starting at $y = 123\text{px}$.
  - Tapping **Beef** activates the authentic white selected state and transitions to the **Beef Menu screen** (Figma `3028:28875`).
- **Physical Knobs Hardware Metaphor (Knobs Never Auto Turn Off)**:
  - Knobs reflect the physical state of the cooktop dials and never auto-turn off across screen transitions.
  - Multiple knobs can remain illuminated and active simultaneously.
  - Knobs only turn off when the user explicitly rotates or taps them back to $0^\circ$ (OFF).
  - When all active knobs are turned off, the screen burner readouts show OFF, the activity bar shuts off, and the interface smoothly resets back to `3-start`.

### 4. Caramelize Technique Flow from Main Burner (Task 3E)
- **Direct Main Burner Trigger**: Turning Knob 4 (Right Front 176px Main Burner) to PRC detent ($-56^\circ$) or clicking the main burner graphic hotspot on `3-start`:
  - Illuminates Knob 4's white halo LED and sets roller 4 to PRC.
  - Activates the gradient **Activity Bar** at the bottom.
  - Displays the red **COOKTOP HOT** indicator pill ($130 \times 24\text{px}$, Figma `2315:14060`) in the 48px top status bar.
  - Triggers the 3-second countdown toast (*"Switching to precision cooking in 3s... Cancel"*).
  - Automatically transitions to Spotlight (`3A-spotlight`) upon countdown completion.
- **Technique Tab Navigation**: Tapping the **Technique** tab on the navigation bar switches to the 8-tile Technique grid (`3E-technique`).
- **Caramelize Selection & Direct Preheating**:
  - Selecting the **Caramelize** mode tile immediately launches the Caramelize Preheating screen (Figma `2348:17716`).
  - Dynamic Current temperature ramps up from **182°F** to **375°F** with clean, glitch-free typography and exact baseline alignment with the Target 375°F column.
- **Preheat Complete Transition & Toast Notification**:
  - When the temperature reaches **375°F**, transitions to the Preheated screen (Figma `2348:17836`).
  - **Preheat complete** toast (Figma `2348:17877`) smoothly slides up from the bottom with spring motion.
  - Clicking **OK** or **✕** dismisses the toast while maintaining the Preheated state.
  - Turning Knob 4 back to **OFF** turns off the burner, deactivates the activity bar, and cleanly returns to `3-start`.

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
