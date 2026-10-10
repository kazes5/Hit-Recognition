# Research: each player on their own device, from different places

**Status:** research only, nothing implemented (2026-10-10).

## Summary

**Recommendation:** add online game rooms to the server we already have.

- **Rooms on the server:** the server holds each game, and every player's phone connects to it over a live connection (WebSocket, through Socket.IO).
- **Joining:** players join with a short code or a link.
- **Talking:** players keep talking on WhatsApp or Zoom.
- **Cost:** no new paid service. The current one-phone mode stays as it is.
- **Effort:** about 2–3 weeks of development.

## What already helps, and what is missing

**Already helps:**

- **Rules in one place.** They are already a separate, fully tested piece of code (`web/src/game/`: `reducer.ts`, `rules.ts`, `tokens.ts`). The server can run the same code, so the rules are not written twice.
- **Server-side work.** Name checking is already on the server (`POST /api/songs/:id/guess`), and so are previews and covers.
- **One server process.** Railway runs a single copy of the server (`numReplicas: 1` in `railway.json`), so it can keep all rooms in memory and no shared database is needed at first.

**Missing:**

- **Pushing updates to phones.** Today the server only answers when a phone asks (plain Express, no WebSocket), and the game state lives in one browser (`hitster.game` in local storage).
- **Hiding the answer.** `POST /api/songs/next` sends the song's year and title to the phone. That is fine on one shared phone. In an online game anyone could read the answer from the page's network traffic, so the server must keep it until Reveal.

## Options compared

| Option | How it works | For | Against |
|---|---|---|---|
| **A. Rooms on our own server (recommended)** | Socket.IO added to the Express server; rooms kept in memory; the server runs the rules | No new service; runs on Railway as today, and Railway has a Socket.IO guide; Socket.IO has rooms and auto-reconnect built in | We build the room logic; a redeploy drops games in progress unless rooms are saved |
| B. Hosted realtime service (Ably, Pusher, Supabase Realtime) | A third-party service passes messages between phones | Free tiers allow about 100–200 phones connected at once, enough for small groups | Someone still has to enforce the rules (a "host phone", or our server anyway); another account, limits, and game data leaves our setup |
| C. Cloudflare rooms (Durable Objects / PartyKit) | Each room is a small server at Cloudflare | Built for exactly this; copes well with restarts | Moves part of the game off Railway; the paid Workers plan starts at $5 a month; a second platform to run |
| D. Phone-to-phone (WebRTC) | The host's phone runs the game | No server cost | Connection problems between networks; the game ends if the host's phone sleeps. Not recommended |
| E. One shared screen with phone controllers (Jackbox style) | One screen shows the game; remote players watch a screen share | A familiar format | A poor fit for remote play: the music has to travel over the video call |

The official Hitster app does not help here. It is a music player for the physical card game, played together in one room, with no remote mode.

## How the online game would work (option A)

### Joining

1. One player taps "Online game" and gets a 4–5 letter code and a link to share on WhatsApp.
2. The others open the link and type their names.
3. The host sets the target score, the tokens switch, the languages and the difficulty, and starts the game.

### What each phone shows

- **On your turn:** your timeline and the slots to choose from.
- **On another player's turn:** that player's timeline, live.
- **Betting:** this is better than today. Each bettor names the song and bets on their own phone at the same time, with no passing the phone around.
- **"We accept it":** each player taps it on their own phone.

### Who decides

The server runs the rules and sends each phone only what that phone may see. The answer stays on the server until Reveal.

### Audio (the hardest part)

**Playback:**

- Each phone plays the 30-second preview itself, straight from Apple.
- The server sends "start now", so all phones start within a fraction of a second of each other. That is close enough when the players are in different places.

**iPhone limit:**

- Safari only plays sound directly in response to a tap.
- So each player either taps once when joining, which unlocks sound for the session, or taps "Play" for each new song, like turning over the card in the real game.

**To test before relying on it:**

- whether the one-tap unlock lasts a whole game on an iPhone;
- whether Apple's preview files can be loaded for timed playback directly, or must be passed through our server.

### Talking

Players use their usual video call. Building voice into the game would be a large project of its own and is not needed at first.

### When things go wrong

- **Disconnects.** A phone that disconnects (screen lock, network change) reconnects on its own. The server then sends it the whole current game, and the player carries on where they were.
- **Railway edge cuts.** Some Railway users report unexpected WebSocket disconnects. Regular keep-alive messages, automatic reconnect and the full resend cover this.
- **Redeploys.** A redeploy wipes games in progress. At first, avoid deploying during play; later, each room can be saved to Redis on Railway.
- **Host leaves.** The next player becomes host.
- **Late joiners.** They watch the current game and join the next one.

## Suggested phases if we go ahead

| Phase | Work | Estimate |
|---|---|---|
| 1. Shared rules on the server | Move the rules into a shared folder; the server runs them; the answer stays on the server until Reveal | 2–3 days |
| 2. Rooms | Socket.IO, codes and links, joining, reconnecting, the set of messages between phones and server | about 3 days |
| 3. Screens | Online lobby, each player's own view of a turn, simultaneous betting, Hebrew and English | about 4 days |
| 4. Audio | Synchronized start, the iPhone unlock, tests on real iPhone and Android phones | about 2 days |
| 5. Hardening and tests | Browser tests that run several "players" at once, so whole online games are tested automatically; optionally save rooms to Redis | 2–3 days |

## Open decisions for the owner

1. **One phone per player?** Can a player take a turn on someone else's behalf (for example a grandparent and a grandchild sharing a phone), or is it strictly one phone per player?
2. **Turn timer?** Should online play have one?
3. **Lost games on redeploy?** Is it acceptable at first that a redeploy ends games in progress, or should rooms be saved from the start?

## Sources

- [Railway: Deploy a WebSocket application with Socket.IO](https://docs.railway.com/guides/socketio)
- [Railway: sticky sessions feature request (staff answer)](https://station.railway.com/questions/feature-request-session-affinity-sti-e534d718)
- [Railway: reports of WebSocket disconnects](https://station.railway.com/questions/frequent-websocket-disconnects-affecting-7b44d307)
- [Socket.IO: connection state recovery](https://socket.io/docs/v4/connection-state-recovery)
- [Socket.IO vs WebSocket comparison](https://websocket.org/comparisons/socket-io/)
- [WebKit bug on Safari's play() gesture rule](https://bugs.webkit.org/show_bug.cgi?id=282053)
- [Agora: browser autoplay restrictions](https://docs.agora.io/en/realtime-media/rtc/build/optimize-and-operate/autoplay.md)
- [mediasoup forum: iOS Safari audio autoplay](https://mediasoup.discourse.group/t/audio-auto-play-issues-ios-safari/4782)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- [Ably vs Pusher pricing (Ably's own page)](https://ably.com/compare/ably-vs-pusher/pricing)
- [Hitster FAQ](https://hitstergame.com/en-us/faq-v3/)
