import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { setAudioFactory } from "./audio/useAudioPlayer";
import { GAME_STORAGE_KEY } from "./game/persistence";
import type { Song } from "./game/types";
import { FakeAudio } from "./test/fakeAudio";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Fake server: hands out songs with increasing years, so slot n (last) is always correct. */
function fakeServer() {
  let n = 0;
  const bodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/songs/next") {
      bodies.push(JSON.parse((init?.body as string) ?? "{}"));
      n++;
      const s: Song = {
        id: n,
        artist: `Artist ${n}`,
        title: `Song ${n}`,
        year: 1950 + n,
        language: "en",
        genre: "pop",
      };
      return Promise.resolve(json({ song: s }));
    }
    return Promise.resolve(json({ previewUrl: "/api/mock-audio" }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bodies };
}

let restoreAudio: () => void;
beforeEach(() => {
  FakeAudio.reset();
  restoreAudio = setAudioFactory(() => new FakeAudio());
});
afterEach(() => {
  restoreAudio();
  vi.unstubAllGlobals();
});

async function placeLastAndReveal(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByTestId("btn-play")).toBeEnabled());
  const slots = screen.getAllByTestId("timeline-slot");
  await user.click(slots[slots.length - 1]!);
  await user.click(screen.getByTestId("btn-reveal"));
}

describe("App flow", () => {
  it("sends the same artist twice in excludeArtists when the server deals it twice", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/songs/next") {
          bodies.push(JSON.parse((init?.body as string) ?? "{}"));
          n++;
          const s: Song = {
            id: n,
            artist: n <= 2 ? "ABBA" : `Artist ${n}`,
            title: `Song ${n}`,
            year: 1950 + n,
            language: "en",
            genre: "pop",
          };
          return Promise.resolve(json({ song: s }));
        }
        return Promise.resolve(json({ previewUrl: "/api/mock-audio" }));
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "Ann{Enter}");
    await user.type(screen.getByTestId("input-player-name"), "Ben{Enter}");
    await user.click(screen.getByTestId("btn-start-game"));
    expect(await screen.findByTestId("screen-turn")).toBeInTheDocument();
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(3));
    expect(bodies[2]?.excludeArtists).toEqual(["ABBA", "ABBA"]);
  });

  it("home → setup → deal → turns → winner → play again", async () => {
    const { bodies } = fakeServer();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId("screen-home")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-resume")).toBeNull();
    expect(document.documentElement.dir).toBe("ltr");

    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "Ann{Enter}");
    await user.type(screen.getByTestId("input-player-name"), "Ben{Enter}");
    await user.clear(screen.getByTestId("input-target-score"));
    await user.type(screen.getByTestId("input-target-score"), "3");
    await user.click(screen.getByTestId("btn-start-game"));

    expect(await screen.findByTestId("screen-turn")).toBeInTheDocument();
    expect(screen.getByTestId("current-player-name")).toHaveTextContent("Ann");
    expect(screen.getAllByTestId("timeline-card")).toHaveLength(1);
    // dealing excluded previously dealt songs
    expect(bodies[1]?.excludeIds).toEqual([1]);
    expect(bodies[1]?.excludeArtists).toEqual(["Artist 1"]);

    // Game is saved while in progress
    expect(localStorage.getItem(GAME_STORAGE_KEY)).not.toBeNull();

    // Ann ✓ (2), Ben ✓ (2), Ann ✓ (3 = target)
    for (const expected of ["Ann", "Ben", "Ann"]) {
      expect(screen.getByTestId("current-player-name")).toHaveTextContent(
        expected,
      );
      await placeLastAndReveal(user);
      expect(screen.getByTestId("result-correct")).toBeInTheDocument();
      await user.click(screen.getByTestId("btn-next"));
    }

    expect(screen.getByTestId("screen-winner")).toBeInTheDocument();
    expect(screen.getByTestId("winner-name")).toHaveTextContent("Ann");
    expect(localStorage.getItem(GAME_STORAGE_KEY)).toBeNull();

    await user.click(screen.getByTestId("btn-play-again"));
    expect(screen.getByTestId("screen-setup")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("player-item").map((p) => p.textContent),
    ).toEqual(["Ann", "Ben"]);
  });

  it("ending the game early picks the leader", async () => {
    fakeServer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "Solo{Enter}");
    await user.click(screen.getByTestId("btn-start-game"));
    await screen.findByTestId("screen-turn");
    await user.click(screen.getByTestId("btn-scoreboard"));
    await user.click(screen.getByTestId("btn-end-game"));
    expect(screen.getByTestId("screen-winner")).toBeInTheDocument();
    expect(screen.getByTestId("winner-name")).toHaveTextContent("Solo");
  });

  it("offers Resume for a saved game and restores it", async () => {
    fakeServer();
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "Ann{Enter}");
    await user.type(screen.getByTestId("input-player-name"), "Ben{Enter}");
    await user.click(screen.getByTestId("btn-start-game"));
    await placeLastAndReveal(user);
    await user.click(screen.getByTestId("btn-next"));
    await waitFor(() => expect(screen.getByTestId("btn-play")).toBeEnabled());
    unmount();

    render(<App />);
    await user.click(screen.getByTestId("btn-resume"));
    expect(screen.getByTestId("current-player-name")).toHaveTextContent("Ben");
    await user.click(screen.getByTestId("btn-scoreboard"));
    const rows = screen.getAllByTestId("score-row");
    expect(rows.map((r) => r.getAttribute("data-score"))).toEqual(["2", "1"]);
  });

  it("settings switch the UI to Hebrew RTL and set the song languages", async () => {
    const { bodies } = fakeServer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("btn-settings"));
    expect(screen.getByTestId("btn-songs-both")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByTestId("btn-lang-he"));
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("he");
    expect(localStorage.getItem("hitster.lang")).toBe("he");
    await user.click(screen.getByTestId("btn-songs-he"));
    expect(screen.getByTestId("btn-songs-he")).toHaveClass("chip--active");
    expect(localStorage.getItem("hitster.songLanguages")).toBe("he");
    await user.click(screen.getByTestId("btn-back"));
    expect(screen.getByTestId("btn-new-game")).toHaveTextContent("משחק חדש");

    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "נועה{Enter}");
    await user.click(screen.getByTestId("btn-start-game"));
    await screen.findByTestId("screen-turn");
    expect(bodies[0]?.languages).toEqual(["he"]);
    expect(screen.getByTestId("timeline")).toHaveAttribute("dir", "ltr");

    await user.click(screen.getByTestId("btn-scoreboard"));
    await user.click(screen.getByTestId("btn-close-scoreboard"));
  });

  it("shows the error banner while dealing if the server is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("btn-new-game"));
    await user.type(screen.getByTestId("input-player-name"), "Ann{Enter}");
    await user.click(screen.getByTestId("btn-start-game"));
    expect(await screen.findByTestId("error-banner")).toBeInTheDocument();
  });
});
