# Hitster — Visual Design Spec

Source of truth for styles: `web/src/styles/theme.css` (tokens and shared classes, see CONTRACTS.md §5). Logo: `web/src/styles/logo.svg`. Live showcase: `web/src/styles/preview.html`, screenshot at `docs/design-preview.png`.

Mood: a dark party room with neon signs, based on the box cover. Near-black matte background, thin hot-pink neon logo, cyan glowing frames, a grey loudspeaker. The song cards are the opposite: soft, light pastel squares like the printed deck.

## Palette

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#1a1d1f` | App background, with a faint pink/cyan radial glow and texture |
| `--color-bg-deep` | `#111315` | Deeper wells |
| `--color-surface` | `#24282b` | Inputs, list rows, overlay panel |
| `--color-surface-2` | `#2e3337` | Default button fill |
| `--color-border` | `#3a4046` | Hairlines |
| `--color-text` | `#f4f5f6` | Body text (about 16:1 on bg) |
| `--color-text-muted` | `#a9b0b6` | Labels and hints (about 8:1 on bg) |
| `--color-neon-pink` | `#ff2fb3` | Logo, titles, primary button, score badge (about 5:1 on bg) |
| `--color-neon-cyan` | `#7fd8ff` | Outline buttons, frames, timeline slots, focus ring |
| `--color-success` | `#3ee08f` | Correct |
| `--color-error` | `#ff5a6e` | Wrong, errors |
| `--color-card-ink` | `#1b1c1e` | Text on pastel cards |

Card decade gradients (160°, light to slightly deeper):

| Class | Colors | Feel |
|---|---|---|
| `.song-card--d1950` | `#f6e3b4` → `#e8c98a` | butter |
| `.song-card--d1960` | `#a9cfe6` → `#7fb2d4` | sky blue (James Brown card) |
| `.song-card--d1970` | `#f7c6a3` → `#eea37e` | peach |
| `.song-card--d1980` | `#d6c2f2` → `#b39be3` | lavender |
| `.song-card--d1990` | `#f9d77e` → `#b8e2a0` | lemon to lime |
| `.song-card--d2000` | `#dcebb6` → `#a6d8c8` | mint (O-Zone card) |
| `.song-card--d2010` | `#f59ad2` → `#e267b8` | pink (Eyal Golan card) |
| `.song-card--d2020` | `#bfe3f7` → `#8ec5ea` | ice blue |

The frontend picks the modifier as `song-card--d${Math.floor(year / 10) * 10}`, clamped to the 1950–2020 range.

## Typography

- **Body:** `Rubik` (Google Fonts, Hebrew and Latin), falling back to Heebo, system-ui, Segoe UI, Roboto and Arial.
- **Display:** `Tilt Neon` (Latin only), falling back to Rubik. It is used for `.neon-title` and the hidden-card "?". For Hebrew headings, Rubik is used automatically.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 px (`--fs-xs` … `--fs-2xl`). Inputs are always 16px so iOS does not zoom in.
- Card: artist semi-bold (600), year extra-bold (800, about 27% of the card width, tabular numbers), title italic 400, deck code and number 4% of the width.

## Layout

- `.app-shell`: a centered column, max 480px wide. Designed for 360–430px phones. On desktop it is the same column with more vertical padding.
- `.screen` is a flex column: `.screen__header` (48px row), `.screen__body` (centered, fills the space), `.screen__footer` (sticky at the bottom, holds the main action, full-width `.btn--block`).
- Spacing tokens: 4 / 8 / 12 / 16 / 24 / 32 px (`--space-1` … `--space-6`).
- All layout uses logical properties, so `dir="rtl"` mirrors it automatically. The timeline and the card's deck code and number are the only exceptions (see below).

## Screens

1. **Home:** `.logo` (the SVG) in the upper third. Below it, a centered `.neon-frame` tagline (`.screen--home .screen__header` stacks them vertically, like the box cover) ("Music party game" / "משחק מסיבת מוזיקה"). The `.speaker` (not playing) in the center. Footer: `New Game` (`.btn--primary .btn--block`) and `Settings` (`.btn--outline .btn--block`).
2. **Setup:** header with a back `.btn--icon .btn--ghost` and the title. Body: a `.field` with a `.field__row` (`.input` + `Add` `.btn--outline`), the `.player-list` (each `li` has the name and a ✕ `.btn--icon .btn--ghost`), and a target-score `.field` with a numeric `.input` or −/+ icon buttons. Footer: `Start` `.btn--primary`, disabled until there is at least one player.
3. **Turn:** must fit 390x844 with no scrolling. Measured: card 86–206, timeline 256–392, Reveal 768–816, document height 844.
   - Header: the current player's `.player-badge` (name plus pink score pill) and a scoreboard `.btn--icon .btn--outline`.
   - `.turn-stage`: a compact row that wraps if needed. It holds the hidden card (`--card-size: 120px`; 96px on screens shorter than 700px, when the size is not set inline) with an `.equalizer` (`.equalizer--playing` animates it) under the "?". Beside it, `.turn-stage__controls`: `.speaker.speaker--small` (`.speaker--playing` while audio plays) above the "▶ Play / Replay" `.btn--outline`.
   - `.turn-timeline`: a `.turn-timeline__hint` line, then the `.timeline` in a faint framed well, centered when short. It contains the player's cards (`.song-card--small`) with a `.timeline-slot` before, between and after them; the chosen slot gets `.timeline-slot--selected`.
   - Footer: `Reveal` `.btn--primary`, disabled until a slot is chosen.
   - The sticky footer has `margin-block-start: auto` and `z-index` 5. `html` has `scroll-padding-block-end: var(--footer-h)`, so focus and `scrollIntoView` never land under the footer.
4. **Result (same screen):** `.turn-stage.turn-stage--result` (a column). The hidden card becomes the revealed card with the decade gradient (add `.song-card--reveal` for the flip). Add `.song-card--correct` or `.song-card--wrong`. Below it: `.result--correct` "Correct!" or `.result--wrong` "Wrong, it was 2003". If correct, the card appears in the timeline with `.song-card--new`. Footer: `Next player` `.btn--primary`.
5. **Scoreboard overlay:** `.overlay` > `.overlay__panel` (a bottom sheet with a cyan top edge). It holds a `.score-table` (fixed layout) with a row per player.
   - Name cells follow the table (page) direction even if they carry `dir`. They are bidi-isolated and aligned to the start side; names that are too long get an ellipsis.
   - The score column is 3.5em wide at the end side, so "Avi" in Hebrew UI never runs into its score.
   - The leader row gets `.is-leader` (★); the current player's row gets `.is-current` (cyan text). There is a close `.btn--ghost`.
6. **Winner:** `.neon-title` with the winner's name, a ★ and "wins!", then each player's final `.timeline` (read-only, no slots), and footer `Play again` `.btn--primary`.
7. **Settings:** sections with a `.field__label` and a `.chip-group`: Language (עברית / English), Song languages (Hebrew / English / Both), Music source (Previews; Spotify and Apple shown as disabled chips "soon"). The active choice uses `.chip--active`, which adds a ✓. Back button in the header.

Errors: `.error-banner` (⚠ plus red-tinted box) at the top of `.screen__body`.

## Card anatomy

```
┌──────────────────────┐
│     James Brown      │  .song-card__artist  (top, 600, max 2 lines)
│                      │
│        1965          │  .song-card__year    (center, 800, huge)
│                      │
│ I Got You (I Feel…)  │  .song-card__title   (italic, max 2 lines)
│IL01               227│  .song-card__deck / .song-card__number
└──────────────────────┘
```

- Square (`aspect-ratio: 1`), size set by `--card-size`: default `min(72vw, 280px)`. `.song-card--small` is 104px (110px on desktop), and in it the artist and title are one line with an ellipsis. All text sizes scale with `--card-size`, so any size works; you can set `style="--card-size:150px"`.
- Artist and title use `unicode-bidi: plaintext`: Hebrew text runs RTL and English LTR on the same card, whatever the page direction.
- The deck code is always bottom-left and the number bottom-right, as on the printed card, in both languages.

## States

| State | Class | Look |
|---|---|---|
| Hidden | `.song-card--hidden` | Dark gradient card, pink neon border and glow, a big neon "?" drawn by `::after`. Child text is `visibility:hidden`, so the frontend may render the children or leave them out (do not put the real answer in the DOM before reveal, for fairness in e2e/devtools). A `.speaker` or `.equalizer` placed inside stays visible. |
| Revealed | `.song-card--dXXXX` | Pastel gradient, dark ink. |
| Just revealed | `+ .song-card--reveal` | 450ms Y-axis flip-in. |
| Correct | `+ .song-card--correct` | Green outline and glow, plus a ✓ badge on the corner. Always paired with `.result--correct` (✓ plus text). |
| Wrong | `+ .song-card--wrong` | Red outline and glow, plus a red ✗ badge on the top inline-end corner. The true year stays fully readable (no strike-through). Paired with `.result--wrong` (✗ plus text). |
| Added to timeline | `+ .song-card--new` | Pop-in. |

## Timeline

- `.timeline` is always `direction: ltr` (oldest on the left) in both languages. It scrolls horizontally with scroll-snap and has faded edges.
- `.timeline-slot` should be a `<button>`: 44px wide (64px when selected) with the full card height as its tap area, drawn as a slim 4px cyan bar with a "+" disc. On hover or focus it glows cyan. `.timeline-slot--selected` gives a thick glowing bar and a filled ✓ disc. Give each slot an `aria-label` such as "Between 1965 and 2003".
- After selecting a slot, scroll it into view (`scrollIntoView({inline:'center'})`).

## Speaker

`.speaker` is drawn with CSS only: concentric radial gradients for the frame, basket, surround, cone and dust cap, plus four screws, like the cover. Size is set with `--speaker-size` (default `min(56vw, 220px)`); `.speaker--small` is 72px. `.speaker--playing` adds a gentle 0.46s thump (scale 1 → 1.04), a pumping cap highlight and a cyan halo. Optional `.equalizer` (4 `<span>` bars) for the hidden card.

## Motion

- Fast transitions take 150ms; sheets and pops take 300ms with `cubic-bezier(.2,.8,.2,1)`. Buttons scale to 0.97 while pressed.
- `prefers-reduced-motion: reduce` turns off all animations and transitions. The playing state stays visible through the static cyan halo.

## Accessibility

- Text contrast is at least 4.5:1: body text and muted text on the background, dark ink on every pastel card (over 9:1), dark text on the pink primary button (about 5.7:1), and cyan on the background (over 10:1).
- Feedback never relies on color alone. `.result--correct` and `.result--wrong` add ✓ / ✗ through `::before`; the frontend also writes the words ("Correct!" / "Wrong, it was 2003"). A selected slot shows ✓, an active chip shows ✓, and an error banner shows ⚠.
- Tap targets: buttons are at least 48px; chips and timeline slots are at least 44px.
- Focus: a 3px cyan `:focus-visible` outline everywhere.
- Mark the hidden card `aria-label="Hidden song"`. The speaker is decorative (`aria-hidden="true"`) unless it is the play button itself, in which case give it a label.
- Directional glyphs: add `.flip-rtl` (e.g. the back arrow ←); it is mirrored with `scaleX(-1)` when `dir="rtl"`. Play ▶ is intentionally not mirrored.
- `.visually-hidden` utility for screen-reader-only text.

## Extra classes (beyond CONTRACTS §5)

`.neon-subtitle`, `.text-muted`, `.logo`, `.btn--block`, `.song-card--large`, `.song-card--correct`, `.song-card--wrong`, `.song-card--new`, `.song-card--reveal`, `.timeline__empty`, `.speaker--small`, `.equalizer`, `.error-banner`, `.field__label`, `.field__row`, `.chip-group`, `.player-list`, `.player-badge`, `.player-badge__score`, `.overlay`, `.overlay__panel`, `.score-table` (+ `tr.is-leader`), `.stack`, `.row`, `.center`, `.visually-hidden`, `.flip-rtl`, `.logo-heading`, `.screen__header--stacked`, `.turn-stage`, `.turn-stage--result`, `.turn-stage__controls`, `.turn-timeline`, `.turn-timeline__hint`, `.equalizer--playing`, `.score-table tr.is-current`. Token: `--footer-h`.
