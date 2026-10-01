# Polaris Cooktop Precision Cooking Prototype

Interactive prototype for the **October 2026 Polaris Cooktop Precision Cooking User Testing**. Designed specifically for the **ROUX 6.75" appliance touchscreen** (1024 × 384 px) with dedicated researcher controls docked outside the appliance canvas.

---

## 🚀 Live Interactive Prototype Links

Click below to open and test the prototype directly:

* **[Live Web Prototype Link](https://gold-boats-admire.loca.lt)**  
  *(If prompted for a tunnel password, enter: `4.53.66.82`)*

* **Local iPad / Lab Wi-Fi Link**: `http://10.35.122.114:8080`  
  *(Recommended for zero latency when on the same Wi-Fi network as the host machine)*

* **Direct Browser**:  
  Clone or download this repository, and double-click `index.html` in Safari, Chrome, or Edge.

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
| **Task 2: Concept Evaluation** | **COMPLETE** | Evaluate participant comprehension of Precision Cooking pillars (Spotlight, Technique, Food, Temperature Picker, and Digital Pad). | • **Explore Screen (`PC-explore`)** with clickable Explore button<br>• **Tab Navigation Bar** (Spotlight, Technique, Food, Temperature)<br>• **Dynamic Buttontile Components** with official Roux design tokens<br>• **Vertical Scrollable Tiles** for Food & Technique with top crop at $y = 179\text{px}$<br>• **Hardware-accelerated Backdrop Blur** (`-webkit-backdrop-filter: blur(16px)`)<br>• **Temperature Picker ⇄ Digital Pad Switcher** via secondary round button<br>• **Interactive Digipad Keypad** (0-9, Clear, Backspace, live display) |
| **Task 3: Usability Flow** | **IN PROGRESS** | Interactive burner flow (Tasks A – E):<br>• Task A: Rear left 375°F<br>• Task B: Set 500°F<br>• Task C: Front left Steak mode<br>• Task D: Turn OFF precision<br>• Task E: Front right Caramelize mode | • **Physical Knobs Manifold (1024 × 152px)** positioned 80px below screen (Task 3 only)<br>• Interactive burners, drawer stepper, food selection cards, technique mode options, and native audio feedback. |

---

## 🍳 Task 2 Details (Precision Cooking Concept Evaluation)

Task 2 is fully wired with authentic 1024 × 384 px Figma artboards and interactive components:

1. **Start Screen (`PC-explore`)**:
   - Displays the initial cooktop explore screen with the prominent pill-shaped **Explore** button.
   - Clicking **Explore** navigates directly into the Precision Cooking experience on the **Spotlight** tab.
2. **Back Navigation (`< Cooktop`)**:
   - Tapping the top-left `< Cooktop` button at any point returns seamlessly to the Explore screen.
3. **Tab Group Navigation**:
   - Participants can tap between the 4 core tabs:
     - **Spotlight**: Highlights suggested cooking recipes (Steak, Bacon, Beef).
     - **Technique**: Displays technique tiles (Sear, Sauté, Poach, Caramelize, Simmer, etc.).
     - **Food**: Displays food-guided ingredient categories (Bacon, Beef, Butter, Chicken, etc.).
     - **Temperature**: Precision temperature selection.
4. **Dynamic Option Tiles with Roux Design Tokens**:
   - Option tiles are implemented as real HTML/CSS `.buttontile` components using the official design tokens:
     - **Size**: 176px wide × 96px tall (`min-height: 88px`, `padding: 12px`, `border-radius: 8px`).
     - **Colors**: Default `rgba(75, 76, 82, 0.8)` (`--brands-roux-color-basetile-secondary`); Selected `rgba(244, 244, 242, 1)` (`--brands-roux-color-basetile-secondaryselected`).
     - **Typography**: `"Profile Text"`, 28px, semi-bold (600), letter-spacing 0.56px, line-height 120%, color `#ffffff`. Selected text: `rgba(31, 32, 36, 1)`.
     - **Interactive Selection**: Tapping any tile triggers the tactile selection state and audio touch feedback.
5. **Vertical Scrolling & Top Cropping**:
   - Both **Technique** (14 options) and **Food** (16 options) grids scroll vertically over the underlying cooktop background artwork (`pc-bg.png`).
   - Fixed crop container begins cleanly at the first row ($y = 179\text{px}$) beneath the pinned header and navigation tab bar, matching Figma layout behavior.
6. **Frosted Glass / Background Blur**:
   - Uses `-webkit-backdrop-filter: blur(16px)` with GPU hardware compositing (`transform: translateZ(0)`).
   - Cooktop food photography (bacon and eggs) subtly blurs through the translucent 80% opacity tiles.
7. **Real Horizontal Temperature Carousel & Digital Pad**:
   - **Horizontal Scroll Carousel Dial**:
     - **Range**: **$200^\circ\text{F}$ to $500^\circ\text{F}$** in **$10^\circ\text{F}$ increments** (31 discrete selectable values).
     - **Visual Hierarchy**: Centered directly above the `START` button. Active center number renders bold ($68\text{px}$) with an inline $^\circ\text{F}$ unit badge; immediate neighbors scale smoothly down to $46\text{px}$ ($80\%$ opacity), $36\text{px}$ ($45\%$ opacity), and fade gracefully into the edge masks.
     - **Physics & Touch**: Native CSS touch scroll-snap (`scroll-snap-type: x mandatory`) for iPad Pro, plus desktop mouse drag-and-flick and click-to-center.
     - **Audio Feedback**: Subtle tactile tick (`playSound("touch")`) triggers dynamically each time a new $10^\circ\text{F}$ increment is snapped or scrolled into center.
   - **Dynamic Interactive Digipad**:
     - **Live Display**: Clean digital readout ($76\text{px}$ bold numbers + $30\text{px}$ $^\circ\text{F}$ unit) positioned above `START`.
     - **12-Key Numeric Keypad**: Interactive 0–9 digits, Clear (clears to `---` with audio cue), and Backspace.
     - **Validation & Clamping**: Clamped to valid cooktop range ($200^\circ\text{F} - 500^\circ\text{F}$) when pressing `START` or switching back to Dial.
   - **Two-Way Synchronization**:
     - Seamless two-way sync: Scrolling the dial to a temperature (e.g. $420^\circ\text{F}$) automatically updates the Digipad buffer; switching back to Dial from the Digipad instantly scrolls and snaps the wheel to the typed temperature.

---

## 🔬 Task 1 Details (Awareness Test)

* **Silent Operation**: All sounds are intentionally disabled for Task 1 to ensure participant responses are purely driven by visual recognition.
* **Standby Shield**: Screen remains hidden under a dark standby cover until the researcher triggers an exposure.
* **Timed Auto-Re-cover**: Clicking `0.5s`, `1s`, or `2s` reveals the screen for that exact duration before automatically returning to standby.
* **Preview Mode**: Clicking `Preview` toggles the screen continuously on/off for inspection.
* **Layout Stability**: The status indicator is locked at a fixed 140px width to ensure surrounding buttons never shift during state transitions.
* **Running Activity Bar**: A full-width (1024px × 12px) seamless gradient animation runs along the bottom edge, cycling continuously from magenta to blue to magenta.

---

## 💡 Engineering Note: Background Blur on Embedded Appliances

If engineering teams report difficulty implementing real-time `backdrop-filter: blur()` on the production cooktop:
* **The Root Cause**: Low-power embedded Linux/Android SoCs (e.g. NXP i.MX, Allwinner, STM32) lack the GPU fill-rate and memory bandwidth for multi-pass real-time Gaussian shaders across 16 moving tiles, dropping 60 FPS scrolling to 10–15 FPS.
* **The Production Solution (Pre-blurred Background)**: In Figma, export an alternative background image (`pc-bg-blur.png`) with the Gaussian blur pre-baked into the artwork. On screens with option tiles, display `pc-bg-blur.png` under the semi-transparent tiles (`rgba(75, 76, 82, 0.8)`). This delivers the exact frosted glass aesthetic with **zero GPU overhead** and buttery smooth 60 FPS performance.

---

## 🛠 Technical Specifications

* **Appliance Display Canvas**: Exact 1024 × 384 pixels (ROUX 6.75" display aspect ratio).
* **Typography**: GE Appliances Profile Display and Profile Text font families loaded via local `@font-face`.
* **Iconography**: Clean SVG vector assets matching Polaris production design.
* **Architecture**: Vanilla HTML5, CSS3, and JavaScript — zero external dependencies, no build steps required.
