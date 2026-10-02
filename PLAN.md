# Hitster — Song Timeline Game: Plan

A party game for one shared phone, based on the Hitster board game. The app plays 30 seconds of a well-known song. The current player places it on their timeline of songs, then reveals the artist, year and title to see whether they placed it correctly.

---

## 1. How the game works

1. **Setup:** enter the player names (2–10 players) and choose the target score (default: 10 cards).
2. **Starting card:** each player gets one random song card, already revealed. It starts their timeline.
3. **A turn:**
   1. The app plays a 30-second clip of a new random song. Artist, year and title stay hidden.
   2. The player picks the slot on their timeline where the song belongs (before, between or after their cards).
   3. The player taps **Reveal** to show the artist, year and title on the card.
   4. **Correct placement:** the card is added to the player's timeline. **Wrong placement:** the card is discarded.
   5. Play passes to the next player.
4. **Score:** the number of cards on a player's timeline.
5. **Winner:** the first player to reach the target score. Players can also end the game early, and the most cards wins.

**Rules for picking songs**
- A song is never played twice in the same game.
- The app avoids picking an artist who has already appeared in the game. It only repeats an artist when no other artist is left.
- Songs with the same year as a card already on the timeline count as correct on either side of it.

---

## 2. The song card

The card copies the physical card, with these elements:

| Position | Content |
|---|---|
| Top | Artist (e.g. *James Brown* / *אייל גולן*) |
| Center, large | Release year (e.g. **1965**) |
| Bottom, italic | Song title (e.g. *I Got You (I Feel Good)* / *מי שמאמין*) |
| Bottom left / right, small | Deck code (`IL01`) / card number (`227`) |

- The card color depends on the decade: soft gradients of blue, mint, pink and so on.
- **Hidden state:** the card is dark, shows a neon "?" and a playing/equalizer animation, and has no text.
- Hebrew text is shown right-to-left and English text left-to-right, on the same card.

---

## 3. Visual design (based on the box cover)

- **Background:** near-black (`#1a1d1f`) with a slight texture.
- **Neon accents:** hot pink (`#ff2fb3`) for the logo and headings, cyan (`#7fd8ff`) for outlined buttons and frames, with a glow effect.
- **Logo:** "HITSTER / היטסטר" in a thin neon outline font.
- **Play screen:** a large speaker graphic in the center that pulses while the clip plays.
- **Timeline:** horizontal and scrollable, with cards sorted by year. Empty slots between cards light up in cyan so the player can choose where the song goes.
- **Language:** Hebrew (RTL) and English, switchable in Settings.

---

## 4. Music source (Spotify / Apple Music)

| Option | What it needs | Notes |
|---|---|---|
| **Apple Music previews (MVP)** | Nothing: free iTunes Search API | Official 30-second previews, including Israeli songs. No login needed. |
| **Spotify** | User login (OAuth) + **Premium** account | Spotify's SDK plays the full track. The app starts at a random point and stops after 30 seconds. Spotify no longer gives new apps 30-second preview links, so Premium is required. |
| **Apple Music (full)** | MusicKit + Apple Music subscription | Same approach as Spotify: play the track, stop after 30 seconds. |

The MVP ships with the free Apple previews. Connecting Spotify or Apple Music is added in phase 2, and the user picks one in Settings.

**Song list:** the app uses its own curated list (`songs.json`) instead of release dates from Spotify or Apple. Their dates often belong to remasters or compilations, which would put songs in the wrong year.

```json
{ "id": 227, "artist": "James Brown", "title": "I Got You (I Feel Good)",
  "year": 1965, "language": "en", "genre": "pop",
  "spotifyId": "...", "appleId": "..." }
```

- Target: about 300 songs at launch, roughly half Hebrew and half English, spread from the 1950s to the 2020s.
- Genres: pop, classic and light rock.
- A script checks the list: every song has a working preview, there are no duplicate songs, and each decade has enough songs.

---

## 5. Tech stack

- **App:** React Native + Expo (TypeScript), one codebase for iOS and Android.
- **Audio:** `expo-av` for the previews; Spotify iOS/Android SDK and MusicKit for phase 2.
- **State:** a small local game store (Zustand). No server is needed for the MVP.
- **Storage:** an unfinished game is saved on the phone so it can be resumed.
- **Tests:** Jest for the game logic (placement checks, picking songs without repeats).

---

## 6. Screens

1. **Home:** logo, *New Game*, *Settings*.
2. **Players:** add or remove names, choose the target score.
3. **Turn:** player name, hidden card with the playing speaker, replay button, the player's timeline with slots to choose from, **Reveal** button.
4. **Result:** the revealed card plus ✅ "Correct!" or ❌ "Wrong, it was 2003", then *Next player*.
5. **Scoreboard:** card counts for all players (available at any time).
6. **Winner:** the final timelines and a *Play again* button.
7. **Settings:** language, music source (Previews / Spotify / Apple Music), song languages (Hebrew / English / both).

---

## 7. Milestones

1. **Setup:** Expo project, theme (colors and fonts), Hebrew/English text, RTL support.
2. **Song list:** `songs.json` with about 300 songs, the check script, and preview links.
3. **Game logic:** players, turns, song picking without repeats, placement check, score, winner, all with tests.
4. **UI:** the screens from section 6, the card component, and the timeline.
5. **Audio:** play a 30-second preview, replay, and handle errors (skip to another song if a preview fails).
6. **Polish:** animations, save and resume, testing on real phones.
7. **Phase 2:** Spotify and Apple Music login and playback.

---

## 8. Out of scope (for now)

- Online multiplayer across several phones.
- Tokens for challenging or stealing cards (from the original game).
- Guessing the artist or title for bonus points.
