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

---

## 📋 User Test Plan & Status

The prototype includes an external researcher toolbar positioned above the appliance screen:

| Task | Status | Focus / Objectives | Controls Available |
| :--- | :---: | :--- | :--- |
| **Task 1: Awareness Test** | **COMPLETE** | Test whether participants notice active heating burners and precision cooking states during quick glance exposures. | • **0.5s / 1s / 2s glance reveal buttons**<br>• **Silent execution** (zero sound cues to prevent audio bias)<br>• **1024 × 12px running activity bar** (magenta ⇄ blue left-to-right)<br>• **Stable 140px status pill** (`Hidden`, `Revealed`, `Preview`) |
| **Task 2: Concept Evaluation** | **COMPLETE** | Evaluate participant comprehension of Precision Cooking pillars (Spotlight, Technique, Food, Temperature Picker, and Digital Pad). | • **Explore Screen (`PC-explore`)** with clickable Explore button<br>• **Tab Navigation Bar** (Spotlight, Technique, Food, Temperature)<br>• **Vertical Scrollable Tiles** for Food & Technique with top crop<br>• **Temperature Picker ⇄ Digital Pad Switcher** via round secondary button<br>• **Interactive Digipad Keypad** (0-9, Clear, Backspace, live display)<br>• **Researcher Quick-Jump subbar** to leap directly to any state |
| **Task 3: Usability Flow** | *Planned* | Interactive burner flow (Tasks A – E):<br>• Task A: Rear left 375°F<br>• Task B: Set 500°F<br>• Task C: Front left Steak mode<br>• Task D: Turn OFF precision<br>• Task E: Front right Caramelize mode | Interactive burners, drawer stepper, food selection cards, technique mode options, and native audio feedback. |

---

## 🍳 Task 2 Details (Precision Cooking Concept Evaluation)

Task 2 is fully built and wired with authentic 1024 × 384 px Figma artboards and interactive components:

1. **Start Screen (`PC-explore`)**:
   - Displays the initial cooktop explore screen with the prominent pill-shaped **Explore** button.
   - Clicking **Explore** navigates directly into the Precision Cooking experience on the **Spotlight** tab.
2. **Back Navigation (`< Cooktop`)**:
   - Tapping the top-left `< Cooktop` button at any point returns seamlessly to the Explore screen.
3. **Tab Group Navigation**:
   - Participants or researchers can tap between the 4 core tabs:
     - **Spotlight**: Highlights suggested cooking recipes (Steak, Bacon, Beef).
     - **Technique**: Displays technique tiles (Sear, Sauté, Poach, Caramelize, Simmer, etc.).
     - **Food**: Displays food-guided ingredient categories.
     - **Temperature**: Precision temperature selection.
4. **Vertical Scrollable Option Tiles (Top Cropped)**:
   - Both **Technique** and **Food** tabs feature vertical touch scrolling for their full grid of options.
   - Fixed crop container starts cleanly at the first row ($y = 179\text{px}$) beneath the pinned header and navigation tab bar, matching Figma layout behavior.
5. **Temperature Dial Picker & Digital Pad Toggle**:
   - **Dial Picker Mode**: Shows the dial selector with clickable preset values (`325°F`, `350°F`, `375°F`, `400°F`, `425°F`) and the `START` button.
   - **Switch to Digipad**: Tapping the secondary round keypad button next to `START` toggles to the **Digital Pad** screen.
   - **Interactive Digipad Keypad**: 12-key numeric keypad (1–9, Clear, 0, Backspace) with live dynamic temperature readout updates (`°F`).
   - **Switch to Dial**: Tapping the secondary round carousel button next to `START` toggles back to the Dial Picker.
6. **Researcher Subbar Quick Jump**:
   - When Task 2 is active, the researcher toolbar provides dedicated quick-jump buttons (`Explore`, `Spotlight`, `Technique`, `Food`, `Temp (Dial)`, `Temp (Keypad)`) for direct test administration.

---

## 🔬 Task 1 Details (Awareness Test)

* **Silent Operation**: All sounds are intentionally disabled for Task 1 to ensure participant responses are purely driven by visual recognition.
* **Standby Shield**: Screen remains hidden under a dark standby cover until the researcher triggers an exposure.
* **Timed Auto-Re-cover**: Clicking `0.5s`, `1s`, or `2s` reveals the screen for that exact duration before automatically returning to standby.
* **Preview Mode**: Clicking `Preview` toggles the screen continuously on/off for inspection.
* **Layout Stability**: The status indicator is locked at a fixed 140px width to ensure surrounding buttons never shift during state transitions.
* **Running Activity Bar**: A full-width (1024px × 12px) seamless gradient animation runs along the bottom edge, cycling continuously from magenta to blue to magenta.

---

## 🛠 Technical Specifications

* **Appliance Display Canvas**: Exact 1024 × 384 pixels (ROUX 6.75" display aspect ratio).
* **Typography**: GE Appliances Profile Display and Profile Text font families.
* **Iconography**: Clean SVG vector assets matching Polaris production design.
* **Architecture**: Vanilla HTML5, CSS3, and JavaScript — zero external dependencies, no build steps required.
