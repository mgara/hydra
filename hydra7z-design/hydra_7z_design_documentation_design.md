# HYDRA-7Z Design Specification

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Laboratory"**
The HYDRA-7Z interface is designed as a precision instrument, blending the intuitive nature of consumer IoT (like Nest) with the robust, data-dense utility of industrial SCADA systems. It’s built to feel "status-aware"—where every element reflects the live pulse of the 7-zone irrigation network.

---

## 2. Visual Identity & Design Tokens

### Color Palette: "Deep Field & Electric Signal"
*   **Surface (Background):** `#131313` (Deep Onyx) — Provides atmospheric depth and maximum contrast for data.
*   **Primary Action/Status:** `#00D1FF` (Electric Cyan) — Used for active flow, running zones, and primary CTA pulses.
*   **Safety/Warning:** `#FFB800` (Amber) — Used for scheduled tasks and minor system warnings.
*   **Critical/Alert:** `#FF5C5C` (Soft Red) — Reserved for leaks, master valve shutoffs, and system failures.
*   **Neutral/Data:** `#A4E6FF` (Ice Blue) — Sub-headers, secondary metrics, and borders.

### Typography: "Technical Precision"
*   **Primary Headings:** `Space Grotesk` (Bold/Medium) — A geometric sans-serif that evokes a modern, engineering feel. Used for branding and large telemetry readouts.
*   **Body & Utility:** `Inter` (Regular/Semi-Bold) — Optimized for legibility in dense data tables and settings menus.
*   **Character:** Uppercase tracking for labels (`tracking-widest`) to enhance the instrument-cluster aesthetic.

### Shape & Elevation
*   **Corner Radius:** `8px` (Round Eight) — Professional and structured, avoiding the "bubbly" look of consumer apps.
*   **Separation:** Thin, low-opacity borders (`#3C494E/15%`) and subtle tonal shifts rather than heavy shadows.

---

## 3. Component Architecture

### The "Breathing" Zone Card
*   **States:** `IDLE` (Dimmed), `RUNNING` (Pulse Animation + Cyan Border), `SCHEDULED` (Amber Indicator).
*   **Interaction:** Quick-start buttons are secondary; deep-dive configuration is accessed via the card body.

### Telemetry Readouts
*   Large-scale numbers (Flow GPM, Pressure PSI) use high-contrast Ice Blue.
*   Micro-charts (Sparklines) are integrated directly into headers to show 24-hour trends at a glance.

### Navigation Logic
*   **Mobile:** Bottom fixed bar with high-intensity icons.
*   **Desktop:** Persistent left sidebar for "Command Center" access, with a top-bar dedicated to global system health (System Status: NOMINAL).

---

## 4. UX & API Implications

### Real-Time Syncing
*   The UI expects a high-frequency WebSocket or MQTT stream for "Live Flow" and "Pressure" monitoring.
*   **Decision:** "Slide to Start" controls are implemented to prevent accidental irrigation triggers via touch.

### Logic Layer
*   **Rain Skip:** The API must provide both local sensor data (Moisture %) and external Forecast data (Precipitation %) for the UI to display the "Rain Delay Active" logic clearly.
*   **Master Valve:** This is a global override. If `OPEN`, it flows to zones; if `CLOSED`, all zone-level requests must be visually locked out in the UI.

---

## 5. View Inventory
1.  **Main Dashboard (Mobile/Desktop):** Real-time monitoring and zone toggles.
2.  **Zone Detail & Editor:** Granular scheduling (Time/Duration/Days).
3.  **Weekly Dynamics:** Timeline view of upcoming events vs. historical volume.
4.  **Execution Logs:** Historical audit trail of every valve open/close event.
5.  **Configuration Terminal:** Diagnostic and integration settings.