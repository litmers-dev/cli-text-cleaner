# CLI Text Cleaner Design System

## 1. Atmosphere & Identity

A focused desktop utility for turning mangled terminal copy into plain text that feels natural in KakaoTalk and email. The signature is command-palette clarity: a dark, precise workspace with physical keycap controls and one bright accent used only where action or state needs attention.

## 2. Color

### Palette

| Role | Token | Value | Usage |
|---|---|---|---|
| Surface/page | --surface-page | #07080a | App background |
| Surface/panel | --surface-panel | #101111 | Primary editor panels |
| Surface/elevated | --surface-elevated | #18191a | Toolbar, controls, result blocks |
| Surface-muted | --surface-muted | #1b1c1e | Chips, counters, inactive controls |
| Text/primary | --text-primary | #f9f9f9 | Headings, input text |
| Text/secondary | --text-secondary | #cecece | Body and labels |
| Text/muted | --text-muted | #9c9c9d | Helper text, metadata |
| Text-dim | --text-dim | #6a6b6c | Disabled or low emphasis |
| Border/default | --border-default | #252829 | Panel borders |
| Border/strong | --border-strong | rgba(255,255,255,0.14) | Focus and active states |
| Accent/primary | --accent-primary | #ff6363 | Primary action, changed-count emphasis |
| Accent/info | --accent-info | #55b3ff | Focus rings, selected options |
| Accent/success | --accent-success | #5fc992 | Success state |
| Accent/warning | --accent-warning | #ffbc33 | Caution state |

### Rules

- Accent red is punctuation, not decoration. Use it for the clean action and changed output count.
- Info blue is reserved for focus rings and selected toggles.
- No raw colors outside this document.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| Display | 40px | 650 | 1.16 | 0 | App title |
| H1 | 28px | 650 | 1.2 | 0 | Panel headings |
| H2 | 20px | 600 | 1.3 | 0 | Section labels |
| Body | 16px | 500 | 1.55 | 0.2px | Main UI copy |
| Body/sm | 14px | 500 | 1.45 | 0.2px | Labels and helper text |
| Caption | 12px | 600 | 1.35 | 0.2px | Stats, badges |
| Mono | 14px | 500 | 1.6 | 0.2px | Text areas, sample output |

### Font Stack

- Primary: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace

### Rules

- Text areas always use mono.
- Body text never drops below 14px.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|---|---:|---|
| --space-1 | 4px | Tight inline gaps |
| --space-2 | 8px | Compact groups |
| --space-3 | 12px | Control padding |
| --space-4 | 16px | Panel inner spacing |
| --space-5 | 20px | Main gaps |
| --space-6 | 24px | Panel padding |
| --space-8 | 32px | Page grid gaps |
| --space-10 | 40px | Header spacing |

### Grid

- Max content width: 1440px.
- Desktop: two equal editor columns with a compact toolbar above.
- Mobile: single column, source first, output second.
- Breakpoints: 720px and 1080px.

### Rules

- The two editors keep stable heights via clamp, never content-driven jumps.
- No nested cards. Toolbars and panels are sibling surfaces.

## 5. Components

### App Header
- Structure: title, short description, privacy note.
- States: static.
- Accessibility: title is the single h1.
- Motion: soft opacity and translate entry only.

### Toolbar Button
- Structure: button with Lucide icon and label.
- Variants: primary, secondary, ghost.
- Spacing: --space-2 icon gap, --space-3 horizontal padding.
- States: hover opacity shift, active translate, focus blue ring, disabled dim.
- Accessibility: semantic button, visible focus.
- Motion: 140ms transform and opacity.

### Toggle Chip
- Structure: checkbox input wrapped by label.
- Variants: default, checked.
- States: hover border, checked blue ring, focus ring.
- Accessibility: native checkbox remains in flow.
- Motion: 140ms color and border.

### Editor Panel
- Structure: header row, textarea, stat footer.
- Variants: source, output, sample.
- States: focus-within border and blue glow, empty helper state.
- Accessibility: textarea has visible label and keyboard support.
- Motion: none beyond focus transition.

### Toast
- Structure: fixed status message.
- Variants: success, warning.
- States: shown, hidden.
- Accessibility: aria-live polite.
- Motion: transform and opacity only.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 140ms | ease-out | Button and chip feedback |
| Standard | 220ms | cubic-bezier(0.16, 1, 0.3, 1) | Toast entry, panel focus |

### Rules

- Only transform and opacity animate.
- Respect prefers-reduced-motion.
- Hover communicates real affordance only.

## 7. Depth & Surface

### Strategy

Mixed Raycast-style rings and inset highlights.

| Level | Value | Usage |
|---|---|---|
| Panel | 0 0 0 1px var(--border-default), inset 0 1px 0 rgba(255,255,255,0.05) | Editor panels |
| Button | inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.22), 0 8px 22px rgba(0,0,0,0.22) | Toolbar buttons |
| Floating | 0 18px 60px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08) | Toast |

### Rules

- Dark surfaces are separated by tonal shift plus subtle rings.
- Shadows always include an inset highlight when used on controls.
