---
name: Sonic Minimalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#524434'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#857462'
  outline-variant: '#d8c3ae'
  surface-tint: '#845400'
  primary: '#845400'
  on-primary: '#ffffff'
  primary-container: '#f2a01d'
  on-primary-container: '#613c00'
  inverse-primary: '#ffb95b'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#00658d'
  on-tertiary: '#ffffff'
  tertiary-container: '#2cbdff'
  on-tertiary-container: '#004967'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb7'
  primary-fixed-dim: '#ffb95b'
  on-primary-fixed: '#2a1800'
  on-primary-fixed-variant: '#643f00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#c6e7ff'
  tertiary-fixed-dim: '#81cfff'
  on-tertiary-fixed: '#001e2d'
  on-tertiary-fixed-variant: '#004c6b'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is built for a premium music and podcast experience, focusing on clarity, focus, and rhythmic precision. The aesthetic is strictly minimalist, leaning into the "Modern Corporate" movement but with a softer, more approachable edge suitable for lifestyle and entertainment. 

The goal is to move the interface into the background, allowing album art and waveform visualizations to be the focal points. By removing heavy shadows and relying on structured, low-contrast borders, the UI feels lightweight and fast. The experience should evoke a sense of organized calm, making long-form listening sessions feel effortless.

## Colors

The palette is anchored by a high-contrast foundation to ensure maximum readability for episode descriptions and tracklists. 

- **Primary Orange (#f2a01d):** Reserved exclusively for interactive elements like primary buttons, active playback states, progress bar fills, and notification badges.
- **Surface Strategy:** The primary background is pure white (#ffffff), with a secondary background of very light gray (#f9f9f9) used to distinguish container sections like the player bar or sidebar.
- **Typography Colors:** Use near-black (#121212) for headings to maintain a sophisticated punch, and a mid-to-dark gray (#636363) for secondary metadata.
- **Borders:** A consistent, subtle gray (#e5e5e5) replaces shadows to define hierarchy and grouping.

## Typography

This design system utilizes **Plus Jakarta Sans** for all roles to maintain a cohesive, friendly, and modern personality. The typeface's wide apertures and geometric structure make it exceptionally legible at small sizes, which is critical for dense podcast descriptions.

Headlines should use tighter letter spacing to feel "locked-in" and professional. Labels for timestamps and categories use uppercase styling with slight letter spacing to differentiate them clearly from body text without needing additional color.

## Layout & Spacing

This design system employs a **fluid grid** model with an 8px base unit. 

- **Mobile:** A 4-column grid with 16px side margins. Horizontal scrolling "carousels" are preferred for browsing categories to keep the vertical scan focused.
- **Desktop:** A 12-column grid with a fixed-width sidebar (280px). Content utilizes a 32px margin. 
- **Rhythm:** Use "md" (24px) spacing between distinct content sections and "xs" (8px) for related elements within a card or list item. 
- **Player Bar:** A persistent 80px high bar at the bottom of the viewport, utilizing a top border (#e5e5e5) for separation rather than a shadow.

## Elevation & Depth

In line with the minimalist aesthetic, this design system avoids traditional shadows. Depth is created through a "Planar Layering" approach:

1.  **Base Layer:** The white canvas (#ffffff).
2.  **Container Layer:** Subtle light gray (#f9f9f9) surfaces used for the sidebar, search bars, and player controls.
3.  **Boundary Layer:** 1px solid borders (#e5e5e5) are used to define cards, inputs, and section breaks.
4.  **Active Elevation:** When an item is pressed or hovered, do not lift it with a shadow. Instead, change the border color to the primary orange or use a subtle 2% gray fill to indicate state.

## Shapes

The shape language is "Rounded," striking a balance between the clinical feel of sharp corners and the playfulness of pill shapes.

- **Standard Elements:** Buttons, input fields, and album art thumbnails use a 0.5rem (8px) corner radius.
- **Large Containers:** Content cards and modal overlays use a 1rem (16px) corner radius to feel distinct from the smaller UI components.
- **Interactive Pill:** Use fully rounded (pill-shaped) borders only for "Now Playing" indicators or category chips to make them instantly recognizable as interactive filters.

## Components

- **Buttons:** Primary buttons use a solid orange fill with white text. Secondary buttons use a transparent background with an orange border and orange text.
- **Progress Bars:** The background track is a light gray (#e5e5e5). The active fill is the primary orange. The "thumb" (handle) should only appear on hover to maintain a clean look.
- **List Items:** Podcast episodes should be displayed in a clean list format with a 1px bottom border. Hover states should trigger a light gray background change (#f9f9f9).
- **Input Fields:** Search bars should be light gray (#f9f9f9) with no border in their default state, transitioning to a white background with a 1px orange border when focused.
- **Chips:** Small, rounded-pill tags used for genres (e.g., "True Crime," "Indie Rock"). They use a light gray background and transition to an orange fill when selected.
- **Cards:** Used for featured shows. They feature a 1px border (#e5e5e5) and no shadow. The title is positioned directly below the image rather than overlaid.