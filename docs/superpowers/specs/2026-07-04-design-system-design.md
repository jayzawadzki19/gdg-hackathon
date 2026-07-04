# Design system — R&D inventive-problem-solving tool

Date: 2026-07-04
Status: Approved (design), pending implementation plan

## Context

`solution-system` is an NX monorepo (Angular 21 frontend + NestJS 11 API). The app
helps an R&D engineer solve an assigned inventive problem: it reframes the problem as
a technical contradiction, generates at least 3 TRIZ candidates via the contradiction
matrix and at least 3 from a second method, evaluates all candidates against the
original problem, selects one, and presents the full inspectable reasoning trail:
problem → contradiction → candidates → evaluation → choice.

This spec defines the design system that dresses that product — not the reasoning
logic itself.

## Decisions (from brainstorming)

- **Primary audience:** the R&D engineer using it daily. Optimize for information
  density, inspectability, and low visual fatigue over demo flash.
- **Design DNA:** a modern, light enterprise instrument — the cleanliness and
  data-viz confidence of ITONICS combined with the information density of Planisware,
  minus Planisware's datedness.
- **Dominant layout:** a five-stage guided pipeline. Each stage (Problem,
  Contradiction, Candidates, Evaluation, Choice) is a focused, inspectable workspace,
  and each is a real, inspectable step of logic.
- **Scope:** lean and targeted — a complete token layer plus only the components the
  pipeline needs. No broad general-purpose component kit yet; the token layer makes
  growing later cheap.
- **Restraint principle:** the reasoning trail is the hero, not the chrome. One accent
  per view; color that carries meaning (traffic-light) appears only where it means
  something (evaluation).

## Foundations (tokens)

Tokens are the single source of truth. Everything below is expressed as CSS custom
properties on `:root` (runtime-themeable, dark-ready) mirrored by SCSS maps for
compile-time use.

### Token layering

Three layers, each referencing the one below:

1. **Primitive tokens** — the raw palette and scales. Never consumed directly by
   components. Example: `--pink-600: #C2185B`, `--gray-900: #1A1620`, `--space-4: 16px`.
2. **Semantic tokens** — role mappings that components consume. Example:
   `--color-accent: var(--pink-600)`, `--color-surface-card: var(--white)`,
   `--eval-strong: var(--green-600)`, `--method-triz: var(--pink-600)`,
   `--method-alt: var(--indigo-600)`.
3. **Component tokens** (optional, only where a component needs its own knob) —
   example: `--stage-node-size`, `--candidate-badge-radius`.

A dark theme is a later swap of the primitive→semantic mapping under a
`[data-theme="dark"]` selector; components do not change.

### Color

Neutrals (warmed purple-gray to sit under the pink brand):

| Role | Token | Value |
|------|-------|-------|
| Page background | `--color-surface-page` | `#F7F6F8` |
| Card / raised surface | `--color-surface-card` | `#FFFFFF` |
| Hairline border | `--color-border` | `#E8E5EC` |
| Strong border | `--color-border-strong` | `#D8C9D5` |
| Text primary | `--color-text-primary` | `#1A1620` |
| Text secondary | `--color-text-secondary` | `#625C6B` |
| Text muted | `--color-text-muted` | `#948E9C` |

Brand:

| Role | Token | Value | Notes |
|------|-------|-------|-------|
| Accent | `--color-accent` | `#C2185B` | Primary actions, current stage, TRIZ lineage. AA-safe for white text. |
| Accent deep | `--color-accent-deep` | `#971247` | Hover/active, emphasis numerals. |
| Accent tint | `--color-accent-tint` | `#FBE6F0` | Selected-row background, subtle fills. |
| Accent tint border | `--color-accent-tint-border` | `#F5C6DD` | Badges on tint. |
| Method-2 hue | `--color-method-alt` | `#4B3FA3` | Second-method badges/lineage (cool complement to magenta). |
| Method-2 tint | `--color-method-alt-tint` | `#DBD6F2` | Second-method badge background. |

The vivid ITONICS magenta `#E6007E` fails WCAG AA for text, so it is not used as a
functional accent; `#C2185B` is the usable deeper variant.

Semantic (traffic-light) — reserved for the evaluation stage only:

| Role | Token | Value |
|------|-------|-------|
| Strong candidate | `--eval-strong` | `#2F9E44` |
| Moderate candidate | `--eval-moderate` | `#E8940C` |
| Weak candidate | `--eval-weak` | `#D92D20` |

`--eval-weak` is a true orange-red, deliberately distinct from brand magenta so status
and brand never read as the same color. Rule: **traffic-light color is never the sole
signal** — it always pairs with a numeric score and/or an icon (colorblind-safe).

### Typography

- **Inter** (`--font-sans`) for all UI text — neutral, dense-friendly, strong at small
  sizes.
- **JetBrains Mono** (`--font-mono`) for technical values only: TRIZ parameter IDs,
  contradiction-matrix cells, principle numbers, candidate scores. Monospace is a
  deliberate signal that a value is a technical fact, not prose.
- Two weights only: 400 (regular), 500 (medium). No 600/700.
- Sentence case everywhere. No ALL CAPS, no Title Case except proper nouns.
- Type scale (px): 12 (caption) / 13 (footnote) / 14 (body) / 16 (subhead) /
  18 (heading) / 22 (title). Line-height 1.5 for body, 1.3 for headings.

### Spacing, radius, elevation, motion

- **Spacing:** 4px grid — `--space-1: 4px` … `--space-8: 48px` (4, 8, 12, 16, 24, 32,
  48). Vertical rhythm in rem, component-internal gaps in px.
- **Radius:** `--radius-control: 8px`, `--radius-card: 12px`, `--radius-pill: 999px`.
  Restrained — enterprise-calm, not bubbly.
- **Elevation:** near-flat. `--shadow-sm` (hairline lift for cards), `--shadow-md`
  (popovers/menus). Functional focus rings only; no decorative shadows.
- **Motion:** fast and functional. `--dur-fast: 120ms`, `--dur-base: 180ms`;
  `--ease-out: cubic-bezier(0.2, 0, 0, 1)`. No bounce.

### Accessibility (applies to all foundations)

- All text/background pairings meet WCAG 2.1 AA (4.5:1 body, 3:1 large text and UI).
- Traffic-light status always carries a redundant non-color cue (number and/or icon).
- Visible focus ring on every interactive element (2px accent ring, offset).
- Full keyboard operability of the pipeline stepper and evaluation table.
- Landmarks and heading order follow the `nx-angular-monorepo-setup` a11y guidance.

## Components (lean, pipeline-driven)

Each is a small, isolated, independently testable unit consuming semantic tokens only.

### Layout & navigation

- **Pipeline stepper** — horizontal five-node stepper. Node states: `done` (accent
  fill + check), `current` (accent ring, filled number), `upcoming` (muted, hairline).
  Every node is clickable to inspect that completed stage. Connectors are accent up to
  the current stage, muted after. Keyboard-navigable; current stage is
  `aria-current="step"`.
- **Stage panel** — the workspace shell each stage renders inside. Owns the stage
  title, a one-line stage description, and a content slot. Consistent padding and max
  width so every stage reads as the same kind of surface.

### Stage content

- **Problem card** — displays the assigned/entered problem statement in a framed,
  quotable block; supports an editable input state and a read-only "locked" state once
  the pipeline advances.
- **Contradiction block** — renders the technical contradiction as an
  improving-parameter vs. worsening-parameter pair, each shown as a **parameter chip**
  (mono TRIZ parameter ID + label). Visually communicates the tension (e.g. an arrow
  or "vs" between the two chips).
- **Candidate card** — one generated solution candidate: a **method badge** (TRIZ in
  accent, second method in indigo), the candidate title, its rationale, and a
  **provenance link** back to the contradiction/principle it came from. Used in the
  Candidates stage as a grid/list.
- **Method badge** — small mono pill; `triz` variant (accent family) or `alt` variant
  (indigo family). Single source of the TRIZ-vs-other distinction.
- **Evaluation table** — candidates × criteria matrix. Each cell shows a
  **score dot/rating** in traffic-light color plus a value; rows show a weighted total
  in mono; sortable by total or by criterion. This is the densest surface and the one
  judges scrutinize, so it gets the most careful spacing and alignment.
- **Score dot / rating** — the atomic traffic-light indicator (dot + number),
  colorblind-safe by construction.
- **Chosen-solution highlight** — the selected candidate rendered with a 2px accent
  border, accent-tint background, and a "Selected" badge. Appears highlighted in the
  Evaluation table and as the centerpiece of the Choice stage.
- **Reasoning-trail provenance** — a compact inline breadcrumb linking
  contradiction → principle → candidate, so any candidate's lineage is one glance away.
  Reinforces the "real, inspectable logic" requirement.

### Primitives (only what the above need)

Button (`primary` / `secondary` / `ghost` / `danger`), text input, textarea, select,
badge, chip, tooltip, card, divider, and shared empty / loading / error states. All
pre-wired to tokens; one `primary` button per view (restraint rule).

## Angular / SCSS implementation notes

- Tokens live in a dedicated styles layer (e.g. `styles/tokens/`): `_primitives.scss`,
  `_semantic.scss`, plus a generated `:root` custom-property sheet. Component SCSS
  references semantic CSS variables, never primitive hex.
- Components are standalone Angular components with `OnPush` change detection, one
  component per folder (`.ts` / `.html` / `.scss` / `.spec.ts`).
- Follow the `angular-design-system` skill for token naming/architecture and the
  `nx-angular-monorepo-setup` skill for component structure, CSS layout rules, and
  accessibility landmarks when implementing.
- Global `styles.scss` imports the token layer and sets base typography, the page
  background, and font-face for Inter + JetBrains Mono.

## Out of scope (YAGNI)

- Dark theme (token architecture supports it; not built now).
- General-purpose component kit beyond the pipeline (modals, tabs, toasts, data-grid,
  full nav shell) — add later on top of the token layer if needed.
- Multi-problem management shell / dashboard (the pipeline is single-problem-focused).

## Success criteria

- Every stage of the reasoning trail is presented through consistent, tokenized
  components with no hardcoded colors or spacing.
- The evaluation stage communicates candidate quality via traffic-light + number,
  passing colorblind and WCAG AA checks.
- A reviewer can trace any candidate back to its contradiction/principle via
  provenance without leaving the stage.
- Swapping the brand accent or moving to a dark theme requires editing only the
  semantic token layer, not components.
