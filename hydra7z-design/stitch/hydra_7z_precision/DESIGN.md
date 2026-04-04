```markdown
# Design System Specification: Industrial Precision & Atmospheric Depth

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Laboratory"**

This design system moves beyond the static "dashboard" trope to create a living, breathing industrial instrument. Inspired by high-end SCADA (Supervisory Control and Data Acquisition) systems, the aesthetic balances the cold precision of aerospace engineering with the fluid, organic nature of water management. 

We break the "template" look through **Intentional Asymmetry** and **Atmospheric Layering**. Instead of rigid, boxed-in modules, components float within a deep, pressurized environment. We utilize high-contrast typography scales (Space Grotesk for data, Inter for utility) to create an editorial hierarchy that feels both authoritative and hyper-modern.

---

## 2. Colors & Atmospheric Surface Logic
The palette is rooted in a deep-sea charcoal, allowing functional colors to act as "light sources" rather than just fills.

### Core Palette
*   **Primary (Hydra Blue):** `#a4e6ff` (Main Action) | `#00d1ff` (Active Flow)
*   **Secondary (Warning Amber):** `#ffdb9d` | `#feb700` (Alert/System Caution)
*   **Tertiary (Status Green/Cyan):** `#4bf1ff` | `#00d5e2` (Hydration Health)
*   **Background:** `#131313` (The "Void")

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for defining sections. 
In this system, boundaries are created through **Tonal Shifts**. To separate a sidebar from a main feed, transition from `surface` (#131313) to `surface_container_low` (#1c1b1b). This mimics the way high-end hardware is machined from a single block of material.

### The "Glass & Gradient" Rule
To achieve a "breathing" state for active irrigation zones, use the **Signature Glow**:
*   Apply a `primary_container` (#00d1ff) fill at 15% opacity with a `backdrop-blur` of 20px.
*   Incorporate a subtle linear gradient (Top-Left to Bottom-Right) transitioning from `primary` to `primary_container` for primary CTAs to give them a "liquid glass" dimension.

---

## 3. Typography: The Technical Editorial
We utilize a dual-typeface system to separate *Data* from *Utility*.

*   **Display & Headlines (Space Grotesk):** This is our "Technical Brand" voice. Use `display-lg` (3.5rem) for macro-data like total water volume. The wide apertures and geometric construction feel industrial and precise.
*   **Body & Labels (Inter):** Our "Utility" voice. Inter is used for all functional readouts, ensuring maximum legibility under harsh industrial lighting or mobile field use.
*   **Hierarchy Note:** Use `label-sm` (0.6875rem) in uppercase with 0.1rem letter-spacing for metadata (e.g., "ZONE 04 - ACTIVE") to mimic blueprint annotations.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows look "web-standard." We use **Ambient Depth** to create a sophisticated, layered SCADA environment.

*   **The Layering Principle:** Stack `surface_container_highest` (#353534) elements on top of `surface_container` (#201f1f) to create a natural protrusion. 
*   **Ambient Shadows:** For floating modals, use a 40px blur, 0px offset shadow with 6% opacity using the `on_surface` color. It should feel like a soft glow of light being blocked, not a drop shadow.
*   **The "Ghost Border" Fallback:** If high-density data requires separation, use the `outline_variant` token (#3c494e) at **15% opacity**. This creates a "etched glass" effect rather than a line.
*   **Glassmorphism:** All floating controls must use `surface_bright` at 60% opacity with a heavy blur. This keeps the user grounded in the system's "environment" while interacting with the foreground.

---

## 5. Components
Our components are "Primitive-Plus"—minimalist shapes enhanced by light and texture.

### Buttons & Interaction
*   **Primary:** A solid `primary` (#a4e6ff) container. On hover, apply a `box-shadow` of 0 0 15px `primary_container` to create a "breathing" active state.
*   **Tertiary (Ghost):** No container. Text in `primary`. For use in low-emphasis actions.
*   **Roundedness:** All buttons and inputs use the `md` scale (12px / 0.75rem).

### Inputs & Form Fields
*   **Container:** `surface_container_lowest`. No border.
*   **Focus State:** A "Ghost Border" of `primary` at 40% opacity and a 2px inner glow.
*   **Error State:** Use `error` (#ffb4ab) for text, never a solid red background.

### Cards & Monitoring Modules
*   **No Dividers:** Separate content using the Spacing Scale (e.g., `spacing-8` for logical blocks).
*   **Active States:** An active irrigation zone card should feature a 2px wide vertical "Power Bar" on the left edge using `tertiary` (#4bf1ff) rather than a full border.

### Contextual Components
*   **Flow Gauges:** Use high-contrast radial gradients. 
*   **Status Micro-chips:** Small capsules using `surface_container_high` with a 4px circular "LED" indicator in the `on_secondary` or `tertiary` color.

---

## 6. Do's and Don'ts

### Do
*   **Use Asymmetry:** Place large `display-lg` data points off-center to create a modern, editorial layout.
*   **Embrace the "Void":** Use `spacing-24` (5.5rem) between major modules to let the high-tech elements breathe.
*   **Vary Opacity:** Use 40-70% opacity on `on_surface_variant` text for secondary labels to create depth.

### Don't
*   **Don't use 100% Black:** Never use #000000. Use `surface_container_lowest` (#0e0e0e) for the deepest blacks to maintain "inkiness."
*   **Don't use Solid Lines:** If you feel the urge to draw a line, use a background color shift instead.
*   **Don't Over-Glow:** Glow effects should be reserved for *active* states (water flowing, alerts). If everything glows, nothing is important.
*   **Don't use Standard Shadows:** Avoid high-opacity, small-blur shadows that make the UI look like a 2014 material design clone.