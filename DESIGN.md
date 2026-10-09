# GrowTH design system

The rules the interface follows, so pages built by different people look like one product.
Tokens live in `frontend/tailwind.config.js` (Tailwind classes) and `frontend/src/index.css`
(CSS variables for the component stylesheets). New code uses the tokens; older code still has
raw hex values and is moved over when it is touched.

## Colour

| Role | Light | Dark | Tailwind |
|---|---|---|---|
| Primary (buttons, links, active tab) | `#056559` | `#2dd4bf` with `#0f172a` text | `bg-brand`, `dark:bg-brand-dark` |
| Primary hover | `#03443c` | `#5eead4` | `hover:bg-brand-hover` |
| Brand text on mint | `#035048` | `#99f6e4` | `text-brand-ink` |
| Tinted surface | `#eefbf7` | `rgba(45,212,191,0.12)` | `bg-brand-mint` |
| Page background | `#f8fafc` (slate-50) | `#0f172a` (slate-900) | `bg-slate-50 dark:bg-slate-900` |
| Card | `#ffffff` | `#1e293b` (slate-800) | `bg-white dark:bg-slate-800` |
| Text / muted text | slate-900 / slate-600 | slate-100 / slate-300 | |
| Danger | `#dc2626` (red-600) | `#f87171` (red-400) | |
| Warning ("worth a look") | amber-700 on amber-50 | amber-300 on amber-500/10 | |
| Success | emerald-700 on emerald-50 | emerald-300 | |

One primary teal. `#00685f` and `#00695c` were near-copies and were replaced by `#056559`.

**Contrast:** body text at least 4.5:1 on its real background, large text (24px, or 18.66px bold)
and UI borders/icons at least 3:1 (WCAG 2.1 AA). Never put white text on the dark-mode teal
(1.9:1): use slate-950. Muted grey on white is slate-500 (`#64748b`) at the lightest, never
slate-400.

## Type

- Font: **Anuphan** (Cadson Demak, SIL OFL), chosen 2026-10-09 over Prompt, Plus Jakarta Sans and
  Nunito for being modern and calm with clear, even numbers for the measurement cards. Self-hosted
  from `frontend/public/fonts/`, English letters only (the TOR asks for an English interface):
  one 34 KB variable file, weights 300–700, preloaded. Fallbacks: Segoe UI, Roboto, system-ui,
  then the system Thai faces for names typed in Thai (`font-sans`). The Knowledge hero alone uses
  Baloo 2 for its display title.
- Scale (Tailwind): 12 `text-xs` (labels, chips only), 14 `text-sm` (body in cards, forms),
  16 `text-base` (reading text), 18 `text-lg`, 20 `text-xl` (page titles in the app),
  24 `text-2xl`, 30 `text-3xl`, 36 `text-4xl` (Home hero). Nothing under 12px except the
  notification count.
- Weights: 400 body, 600 labels and buttons, 700 headings.
- Every page has one `h1`.

## Spacing and shape

- Spacing on a 4px grid (Tailwind's scale). Cards `p-5`, sections `gap-6`, form fields `gap-3`.
- Radius: fields 12px (`rounded-field` / `rounded-xl`), cards 16px (`rounded-card` /
  `rounded-2xl`), buttons and chips fully round (`rounded-full`).
- Primary button: `rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white`,
  at least 44px tall. Secondary: same shape, slate-100 fill or a 1.5px border.

## Interaction

- Tap targets at least 44×44px (`min-h-tap min-w-tap`). An icon button keeps a 16–20px icon in a
  44px round hit area; use negative margin if the row must stay compact.
- Focus: the browser ring is kept; custom controls show `focus-visible` with a 2px teal ring.
- Every action that takes time disables its button and says what it is doing ("Saving…").
- Errors sit next to what caused them, in plain words ("Height should be between 20 and 250 cm"),
  never the API's field names. A failed load says so and offers **Try again**; it is never shown
  as an empty state.
- Destructive actions ask first.
- Dates people know by heart (date of birth, due date) are Day / Month / Year fields
  (`DateFields.jsx`, the GOV.UK pattern), not a calendar: on iOS the calendar opens on today, so
  a 9-year-old's birthday is dozens of taps away, and its native Reset cannot be controlled by
  the page. Recent dates (a measurement, an X-ray) keep the native date picker.
- Motion respects `prefers-reduced-motion`, except the Home logo (a brand decision, 2026-10-04).

## Layout

- Breakpoints: phone < 768px (bottom tab bar, signed in or out), tablet 768–1023px,
  desktop ≥ 1024px (top links).
- Reading width: content is capped (Knowledge at 1240px, text pages narrower); full-width
  backgrounds are fine, full-width text and cards are not.
- Nothing may scroll sideways at 360px wide or with text at 200%: let rows wrap
  (`flex-wrap`) and give flex children `min-w-0`.
