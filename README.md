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
| **Task 2: Concept Evaluation** | *Up Next* | Evaluate participant comprehension of Precision Cooking pillars (Temperature, Food, Technique). | Focus cards and interactive concept walkthrough. |
| **Task 3: Usability Flow** | *Planned* | Interactive burner flow (Tasks A – E):<br>• Task A: Rear left 375°F<br>• Task B: Set 500°F<br>• Task C: Front left Steak mode<br>• Task D: Turn OFF precision<br>• Task E: Front right Caramelize mode | Interactive burners, drawer stepper, food selection cards, technique mode options, and native audio feedback. |

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
