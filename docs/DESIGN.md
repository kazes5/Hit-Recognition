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
| `--color-token` | `#ffd166` | Tokens. **Gold means spending a token:** the token icon, the token meter, the "Bet 1 token" and "Skip · 3" buttons, bet markers, a won bet |
| `--color-token-soft` | `#ffe3a3` | Token text on dark (the header chip, counts) |
| `--color-token-ink` | `#2a1c00` | Text on gold |

Every other main action stays pink. `--glow-token-box` is the gold glow.

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
   - Footer: `Reveal` `.btn--primary`, disabled until a slot is chosen. With tokens and bets on and someone able to bet, it is `Lock in` instead (see "Tokens, naming and bets").
   - The sticky footer has `margin-block-start: auto` and `z-index` 5. `html` has `scroll-padding-block-end: var(--footer-h)`, so focus and `scrollIntoView` never land under the footer.
4. **Result (same screen):** `.turn-stage.turn-stage--result` (a column). The hidden card becomes the revealed card with the decade gradient (add `.song-card--reveal` for the flip). Add `.song-card--correct` or `.song-card--wrong`. Below it: `.result--correct` "Correct!" or `.result--wrong` "Wrong, it was 2003". If correct, the card appears in the timeline with `.song-card--new`. Footer: `Next player` `.btn--primary`.
5. **Scoreboard overlay:** `.overlay` > `.overlay__panel` (a bottom sheet with a cyan top edge). It holds a `.score-table` (fixed layout) with a row per player.
   - Name cells follow the table (page) direction even if they carry `dir`. They are bidi-isolated and aligned to the start side; names that are too long get an ellipsis.
   - The score column is 3.5em wide at the end side, so "Avi" in Hebrew UI never runs into its score.
   - The leader row gets `.is-leader` (★); the current player's row gets `.is-current` (cyan text). There is a close `.btn--ghost`.
6. **Winner:** `.neon-title` with the winner's name, a ★ and "wins!", then each player's final `.timeline` (read-only, no slots), and footer `Play again` `.btn--primary`.
7. **Settings:** sections with a `.field__label` and a `.chip-group`: Language (עברית / English), Song languages (Hebrew / English / Both), Music source (Previews; Spotify and Apple shown as disabled chips "soon"). The active choice uses `.chip--active`, which adds a ✓. Back button in the header.

Errors: `.error-banner` (⚠ plus red-tinted box) at the top of `.screen__body`.

## Tokens, naming and bets

Only shown when the Setup switch "Tokens & bets" is on (the default). Rules: `docs/TOKENS_AND_BETS.md`.

- **Token icon** `.token-icon`: a small gold disc with a "♪" and a glow. Decorative (`aria-hidden`).
- **Header chip** `.token-chip`: "◉ 3" beside the pink card-count pill in `.player-badge`. It has `role="img"` and the label "3 of 5 tokens".
- **Token meter** `.token-meter`: 5 pips (`.token-meter__pip`, filled ones `.token-meter__pip--on`). At 5 it shows "Max" (`.token-meter__max`, and `.token-meter--full`); the scoreboard and Winner screen add the number (`.token-meter__count`). Always `direction: ltr`. Used in the "Who's betting?" list, the bettor screens, the scoreboard's Tokens column (`.score-table--tokens`, `.score-table__tokens`) and the Winner screen.
- **Setup switch** `.rule-box` with a `.switch` (`role="switch"`, gold when on, ✓ in the knob) and a one-line rule (`.rule-box__text`). Off: `.rule-box--off` (grey).
- **Naming** `.name-it`: a dashed cyan toggle `.name-it__toggle` ("✎ Name artist + title"; `--open` when open) under the timeline. It opens `.guess-fields`: a `<fieldset>` with a legend, two labelled 16px inputs and a 🔒 note (`.guess-fields__note`). When closed, `.name-it__who` says who can bet. The footer button is **Lock in** (pink), or **Reveal** when nobody can bet (it checks the typed names first).
- **Skip** `.btn--sm.btn--token-outline` "♪ Skip · 3" beside Replay, only with 3+ tokens. Its sheet is an `.overlay__panel--token` (gold top edge) with `.skip-sheet`: the question, a hint, `.token-change` (meter now → meter after), a gold `.btn--token` "Skip · 3" and a ghost "Keep listening".
- **Timeline markers** (betting only): a taken spot is `.timeline-slot--taken` plus `--pick` (pink bar and disc, the current player's spot) or `--bet` (gold). The disc shows the player's initial (two letters when initials clash) from `data-initials`. Taken spots are `aria-disabled` and cannot be picked.
- **Legend** `.bet-legend` under the timeline: one `li` per marker, with a `.marker` disc (`.marker--pick` pink, `.marker--bet` gold, `.marker--mine` cyan ✓ for the bettor's choice, `.marker--free` "+" for free spots) and the full name ("Bob · 1st bet"). Long names get an ellipsis.
- **Betting panel** (the screen gets `.screen--betting`, the body `.bet-stage`): a `.bet-box` (gold frame) on top.
  - "Who's betting?": `.bet-box__kicker` "Bets are open!" (or "All bets are in!"), a mini hidden card with Replay (`.bet-box__mini`), the hint. Then the timeline with markers and the `.bettor-list` of `.bettor-btn` rows: an `.avatar` initial, the name, a meter and a gold "Bet ›" (`.bettor-btn__go`). A player who cannot try is greyed (`aria-disabled`) with a reason pill (`.bettor-btn__reason`: "tried", "no tokens", "no free spot"; `--bet` gold "1st bet"). Footer: Reveal (pink).
  - A bettor's naming: `.bet-box__who` (large avatar, "Bob, name the artist or the title", or "Bob, name the title" when the current player got the artist), a meter and "one try" note, a compact hidden card (`.turn-stage--compact`), the same `.guess-fields` with only the open fields. Footer: Cancel (outline) and Check (pink).
  - Allowed: `.bet-box--ok` (green) "✓ You can bet!", the free spots light up. Footer: Cancel and the gold **Bet 1 token** (`.btn--token`).
  - Denied: `.bet-box--denied` with a ✗ icon, "Not this time. Pass the phone on.", and the kept token (`.bet-box__keep`). Footer: OK.
- **Result rows** `.turn-outcome` under the result line:
  - Badges `.result-badge--named` (cyan shield, "Named it! No bets allowed.") and `.result-badge--stolen` (gold, "Bob wins the card!").
  - The current player's names with ✓/✗ (`.guess-result`, `__yes` green, `__no` red).
  - Up to 3 `.outcome-row`s in `.outcome-list`: avatars, name(s) and what happened. `--won` green "+1 card", or "+1 card · +1 token" when the current player also named a part right, `--lost` red "−1 token: …", `--right` and `--refunded` muted.
  - `.accept-box`: "Were Ann's names right?" with the outline **We accept it** button.
  - A card won by a bettor gets `.song-card--stolen` (gold outline and ♪ badge) in the bettor's timeline, with the hint `.turn-timeline__hint--stolen` "Added to Bob's timeline".
- **Winner**: `.winner-note` (gold text) "Tied on cards; more tokens wins." when tokens broke a tie.
- **Small phones (360×640):** the betting screens never scroll sideways; only the timeline does. Names are cut with "…".

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

## Cover picture (result screen)

- `.cover` (a `<figure>`) holds the album art and `.cover__img` fills it (`object-fit: cover`). It is a square tile sized by `--cover-size` (108px; 88px on screens shorter than 700px, set on `.turn-stage--result`), with 14px rounded corners, a thin cyan border and glow, and a dark gradient placeholder behind the image.
- Layout: inside `.turn-stage--result` the revealed card and the cover sit side by side (cover on the inline-end side, so it mirrors in RTL), and the result text takes its own row below. Flex `order` and a zero-height `::after` line break do this whatever order the markup is in. With no cover the stage looks exactly as before (centered card, text below), and the result screen still fits 390x844 without scrolling.
- The cover fades and scales in over 0.35s (`cover-in`); this is disabled under `prefers-reduced-motion`. The figure should only be rendered once the image has loaded or is known to exist, so nothing jumps.
- Never put the cover on the hidden card, in the timeline or on the scoreboard.

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

`.neon-subtitle`, `.text-muted`, `.logo`, `.btn--block`, `.song-card--large`, `.song-card--correct`, `.song-card--wrong`, `.song-card--new`, `.song-card--reveal`, `.timeline__empty`, `.speaker--small`, `.equalizer`, `.error-banner`, `.field__label`, `.field__row`, `.chip-group`, `.player-list`, `.player-badge`, `.player-badge__score`, `.overlay`, `.overlay__panel`, `.score-table` (+ `tr.is-leader`), `.stack`, `.row`, `.center`, `.visually-hidden`, `.flip-rtl`, `.logo-heading`, `.screen__header--stacked`, `.turn-stage`, `.turn-stage--result`, `.turn-stage__controls`, `.turn-timeline`, `.turn-timeline__hint`, `.equalizer--playing`, `.cover`, `.cover__img`, `--cover-size`, `.score-table tr.is-current`. Token: `--footer-h`.

Tokens and bets (see the section above): `--color-token`, `--color-token-soft`, `--color-token-ink`, `--glow-token-box`, `.token-icon`, `.token-chip`, `.token-meter` (+ `__pip`, `__pip--on`, `__count`, `__max`, `--full`), `.btn--token`, `.btn--token-outline`, `.btn--sm`, `.overlay__panel--token`, `.skip-sheet`, `.token-change`, `.name-it` (+ `__toggle`, `__toggle--open`, `__body`, `__who`), `.guess-fields` (+ `__note`), `.timeline-slot--taken` / `--pick` / `--bet`, `.bet-legend`, `.marker` (+ `--pick`, `--bet`, `--mine`, `--free`), `.avatar` (+ `--pick`, `--bet`, `--lg`), `.bet-stage`, `.bet-box` (+ `__top`, `__kicker`, `__mini`, `__lead`, `__sub`, `__meta`, `__who`, `__icon`, `__name`, `__keep`, `--ok`, `--denied`), `.bet-list-title`, `.bettor-list`, `.bettor-btn` (+ `__name`, `__go`, `__reason`, `__reason--bet`), `.turn-stage--compact`, `.turn-outcome` (+ `__plain`), `.result-badge` (+ `--named`, `--stolen`), `.guess-result` (+ `__part`, `__yes`, `__no`), `.outcome-list`, `.outcome-row` (+ `__avatars`, `__who`, `__what`, `--won`, `--lost`, `--right`, `--refunded`), `.accept-box`, `.song-card--stolen`, `.turn-timeline__hint--stolen`, `.score-table--tokens`, `.score-table__tokens`, `.score-table__rule`, `.winner-note`, `.rule-box` (+ `__top`, `__title`, `__text`, `--off`), `.switch`, `.switch__knob`.
