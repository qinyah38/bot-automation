# NeoSketch Design System (shadcn Source of Truth)

This file is the single source of truth for every UI decision in NeoSketch. Any change to colors, spacing, typography, or component behavior must start here and then be propagated into code (Tailwind config, shadcn components, CSS vars). Treat this document as authoritative when implementing new screens or refactoring the design layer.

## 1. Workflow Guidelines
- Start every UI task by checking this file; do not hardcode values outside the tokens documented here.
- Update the tokens and component guidance first, then sync `globals.css`, `tailwind.config.js`, and the relevant shadcn component files.
- When adding a new component, follow the patterns under **Component Mapping** and note any additions in the **Component Guidelines** subsection below.


## 2. Foundation

### 2.1 Palette Overview

| Token | Hex | Usage Notes |
|-------|-----|-------------|
| `Ink` | `#0A0D14` | Primary text and icon color on Paper. |
| `Paper` | `#FAF7F2` (alt `#F7F4EE`) | Default background surfaces. |
| `Graph Gray` | `#E6E1D9` | Dividers, strokes, gridlines. |
| `Accent Metric Red` | `#D94841` | Critical highlights, deltas. |
| `Accent Teal` | `#2CB1A1` | Secondary accents, focus rings. |
| `Highlight Marker Yellow` | `#FFE063` | Inline emphasis behind short phrases. |
| `Primary Earth` | `#505F4E` | Primary buttons, key CTAs. |

Usage ratios on Paper mode: Paper 75%, Ink 10%, Graph Gray 8%, combined Accents 7%.

### 2.2 Status Colors
- Success `#15803D`
- Warning `#B45309`
- Error `#B91C1C`
- Info `#1D4ED8`

### 2.3 Contrast Pairs
- Always pair Paper with Ink (body text) and Primary with On-Primary (`#F4F6FA`).
- Marker Yellow is a supporting highlight; keep coverage brief to avoid glare.

## 3. Semantic Tokens

### 3.1 Paper Mode Variables (`:root`)
```css
:root {
  --paper: #FAF7F2;
  --ink: #0A0D14;
  --graph: #E6E1D9;
  --accentR: #D94841;
  --accentT: #2CB1A1;
  --highlight: #FFE063;
  --success: #15803D;
  --warning: #B45309;
  --error: #B91C1C;
  --info: #1D4ED8;
  --primary: #505F4E;
  --onPrimary: #F4F6FA;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --shadow-1: 0 1px 0 rgba(0, 0, 0, 0.06);
  --shadow-2: 0 4px 0 var(--graph);
}
```

### 3.2 JSON Export (design tooling)
```json
{
  "colors": {
    "ink": "#0A0D14",
    "paper": "#FAF7F2",
    "graph": "#E6E1D9",
    "accentR": "#D94841",
    "accentT": "#2CB1A1",
    "highlight": "#FFE063",
    "success": "#15803D",
    "warning": "#B45309",
    "error": "#B91C1C",
    "info": "#1D4ED8",
    "primary": "#505F4E",
    "onPrimary": "#F4F6FA"
  },
  "radius": { "sm": 8, "md": 12, "lg": 16 },
  "space": { "1": 4, "2": 8, "3": 12, "4": 16, "6": 24, "8": 32 }
}
```

## 4. Tailwind and shadcn Integration

### 4.1 Tailwind Extension
Update `tailwind.config.js` to consume the CSS variables:
```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        graph: "var(--graph)",
        accentR: "var(--accentR)",
        accentT: "var(--accentT)",
        highlight: "var(--highlight)",
        primary: "var(--primary)",
        onPrimary: "var(--onPrimary)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        info: "var(--info)"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)"
      },
      boxShadow: {
        subtle: "var(--shadow-1)",
        lifted: "var(--shadow-2)"
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
        8: "var(--space-8)"
      }
    }
  }
};
```

### 4.2 shadcn Component Mapping
- Keep shadcn components under `@/components/ui`. When generating a component, immediately align it with NeoSketch tokens.
- Use `class-variance-authority` (CVA) variants for color or emphasis states so global token updates propagate automatically.
- Avoid business-specific styling inside components; layout-level tweaks belong in consuming views.

## 5. Typography
- Base family: Inter (or equivalent geometric sans).
- Size ramp (rem): 0.75, 0.875, 1, 1.125, 1.25, 1.5, 2, 2.5, 3.
- Headings (H1–H3): letter-spacing 0.2–0.4px, tighter line-height (110%).
- Prefer Marker Yellow accents for emphasis instead of heavy bold weight.

## 6. Layout, Spacing, and Elevation
- Core spacing system: 8-point with 12/24 rhythm; section spacing 24–48px, card padding 16–24px, grid gaps 16–24px.
- Borders: 1px Graph Gray, preferably dashed for the drafting aesthetic.
- Shadows: `--shadow-1` for base elevation, `--shadow-2` for lifted cards. Do not stack multiple drop shadows.
- Border radius scale: 8 / 12 / 16px (small / medium / large).

## 7. Component Guidelines

### 7.1 Buttons
- Primary: background `var(--primary)`, text `var(--onPrimary)`, hover lighten by ~7%, active darken by ~8%.
- Focus outline: 2px `var(--accentT)`.
- Disabled: 60% opacity, remove elevated shadow.

### 7.2 Secondary & Tertiary Buttons
- Secondary: Paper background, 1px Graph border, hover adds subtle Paper tint.
- Tertiary: Ink text, transparent background, add underline on hover.

### 7.3 Inputs
- Background Paper, border 1px Graph, focus state uses a Teal ring.
- Placeholder color: Ink at 60% opacity.

### 7.4 Cards
- Paper fill, dashed Graph border, `--shadow-2` for lifted effect.
- Keep padding at `var(--space-4)` minimum.

### 7.5 Chips / Badges
- Info: Teal, text Ink on Paper.
- Critical alerts: Metric Red with On-Primary text.

### 7.6 Tabs
- Use underline indicator in Accent Teal; inactive tabs drop to 60% Ink.

### 7.7 Alerts & Callouts
- Map directly to status tokens. Title row may include faint tinted background.
- Highlight short phrases with Marker Yellow; never flood entire blocks.

## 8. Data Visualization
- Chart canvas: Paper background, Graph Gray gridlines.
- Primary series: Accent Teal; secondary/deltas: Metric Red; use Yellow for annotations only.
- Labels: Ink; reference lines: Graph Gray.

## 9. Motion
- Durations between 150–250ms with easing `cubic-bezier(0.2, 0.6, 0.2, 1)`.
- Limit pressed-state scale or translate to 2% to maintain grounded feel.

## 10. Accessibility
- Ensure WCAG AA contrast for all text on Paper and on Primary.
- Do not rely on color alone—pair Red warnings with icons or copy.
- Focus states must remain visible in every interaction state.

## 11. Do / Do Not
- Do use dashed Graph borders to reinforce the sketch motif.
- Do cap accent usage at roughly 7% of any screen.
- Do highlight only short phrases with Marker Yellow.
- Do not flood layouts with Metric Red; reserve it for critical data.
- Do not stack heavy shadows or randomize spacing with decorative grids.

## 12. Update Procedure
1. Edit token values or component rules in this file.
2. Sync CSS variables (`globals.css`) and Tailwind theme extensions to match.
3. Update shadcn component styles and document changes in their file-level comments.
4. Notify the team and append change notes to release documentation.

Keeping these steps synchronized guarantees any future UI change is reflected consistently across the entire front-end.
