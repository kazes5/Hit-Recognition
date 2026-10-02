export type Lang = 'he' | 'en';

const en = {
  appName: 'Hitster',
  tagline: 'Music party game',
  newGame: 'New game',
  resume: 'Resume game',
  settings: 'Settings',
  back: 'Back',

  setupTitle: 'Players',
  playerNameLabel: 'Player name',
  playerNamePlaceholder: 'Enter a name',
  addPlayer: 'Add',
  removePlayer: 'Remove {name}',
  playersCount: '{count} / {max} players',
  noPlayers: 'Add at least one player to start.',
  targetScoreLabel: 'Cards to win',
  targetScoreHint: 'Between {min} and {max}',
  startGame: 'Start game',
  errorNameEmpty: 'Please enter a name.',
  errorNameDuplicate: 'That name is already taken.',
  errorNameTooMany: 'Up to {max} players.',
  errorTargetRange: 'Choose a number between {min} and {max}.',

  dealing: 'Dealing starting cards…',
  turnOf: "{name}'s turn",
  currentPlayer: 'Current player',
  cardsCount: '{count} cards',
  loadingSong: 'Loading a song…',
  play: 'Play',
  replay: 'Replay',
  stop: 'Stop',
  playing: 'Playing…',
  tapToPlay: 'Tap play to hear the song',
  chooseSlot: 'Where does this song belong on your timeline?',
  slotLabel: 'Place here (position {index})',
  slotBefore: 'Place before {year}',
  slotAfter: 'Place after {year}',
  slotBetween: 'Place between {a} and {b}',
  slotOnly: 'Place here',
  reveal: 'Reveal',
  scoreboard: 'Scoreboard',
  hiddenCard: 'Hidden song',

  correct: 'Correct!',
  wrong: 'Wrong, it was {year}',
  nextPlayer: 'Next player',
  seeWinner: 'See the winner',

  scoreboardTitle: 'Scoreboard',
  close: 'Close',
  endGame: 'End game now',
  target: 'Target: {target} cards',

  winnerTitle: 'We have a winner!',
  wins: '{name} wins!',
  winnersTitle: "It's a tie!",
  finalTimelines: 'Final timelines',
  playAgain: 'Play again',
  home: 'Home',

  settingsTitle: 'Settings',
  language: 'Language',
  musicSource: 'Music source',
  sourcePreviews: '30s previews',
  sourceSpotify: 'Spotify',
  sourceApple: 'Apple Music',
  comingSoon: 'Coming soon',
  songLanguages: 'Song languages',
  songsHe: 'Hebrew',
  songsEn: 'English',
  songsBoth: 'Both',

  errorNetwork: "Can't reach the server. Check your connection and try again.",
  errorNoSongs: 'No songs left! End the game to see who won.',
  errorGeneric: 'Something went wrong. Please try again.',
  retry: 'Try again',
  dismiss: 'Dismiss',

  deckCode: 'Deck',
  cardNumber: 'Card {number}',
  cardLabel: '{artist} — {title} ({year})',
} as const;

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

const he: Dictionary = {
  appName: 'היטסטר',
  tagline: 'משחק מסיבת מוזיקה',
  newGame: 'משחק חדש',
  resume: 'המשך משחק',
  settings: 'הגדרות',
  back: 'חזרה',

  setupTitle: 'שחקנים',
  playerNameLabel: 'שם השחקן',
  playerNamePlaceholder: 'הקלידו שם',
  addPlayer: 'הוספה',
  removePlayer: 'הסרת {name}',
  playersCount: '{count} מתוך {max} שחקנים',
  noPlayers: 'צריך לפחות שחקן אחד כדי להתחיל.',
  targetScoreLabel: 'כמה קלפים לניצחון',
  targetScoreHint: 'בין {min} ל-{max}',
  startGame: 'יאללה, מתחילים',
  errorNameEmpty: 'נא להקליד שם.',
  errorNameDuplicate: 'השם הזה כבר תפוס.',
  errorNameTooMany: 'עד {max} שחקנים.',
  errorTargetRange: 'יש לבחור מספר בין {min} ל-{max}.',

  dealing: 'מחלקים קלפי פתיחה…',
  turnOf: 'התור של {name}',
  currentPlayer: 'שחקן נוכחי',
  cardsCount: '{count} קלפים',
  loadingSong: 'טוענים שיר…',
  play: 'נגן',
  replay: 'נגן שוב',
  stop: 'עצור',
  playing: 'מתנגן…',
  tapToPlay: 'לחצו על נגן כדי לשמוע את השיר',
  chooseSlot: 'איפה השיר הזה נכנס בציר הזמן שלך?',
  slotLabel: 'למקם כאן (מיקום {index})',
  slotBefore: 'למקם לפני {year}',
  slotAfter: 'למקם אחרי {year}',
  slotBetween: 'למקם בין {a} ל-{b}',
  slotOnly: 'למקם כאן',
  reveal: 'חשיפה',
  scoreboard: 'טבלת ניקוד',
  hiddenCard: 'שיר מוסתר',

  correct: 'נכון!',
  wrong: 'טעות, השיר יצא ב-{year}',
  nextPlayer: 'לשחקן הבא',
  seeWinner: 'למנצח',

  scoreboardTitle: 'טבלת ניקוד',
  close: 'סגירה',
  endGame: 'לסיים את המשחק עכשיו',
  target: 'יעד: {target} קלפים',

  winnerTitle: 'יש לנו מנצח!',
  wins: 'הניצחון ל-{name}!',
  winnersTitle: 'תיקו!',
  finalTimelines: 'צירי הזמן הסופיים',
  playAgain: 'משחק נוסף',
  home: 'מסך הבית',

  settingsTitle: 'הגדרות',
  language: 'שפה',
  musicSource: 'מקור המוזיקה',
  sourcePreviews: 'קטעים של 30 שניות',
  sourceSpotify: 'Spotify',
  sourceApple: 'Apple Music',
  comingSoon: 'בקרוב',
  songLanguages: 'שפת השירים',
  songsHe: 'עברית',
  songsEn: 'אנגלית',
  songsBoth: 'שתיהן',

  errorNetwork: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
  errorNoSongs: 'נגמרו השירים! סיימו את המשחק כדי לראות מי ניצח.',
  errorGeneric: 'משהו השתבש. נסו שוב.',
  retry: 'לנסות שוב',
  dismiss: 'סגירה',

  deckCode: 'חפיסה',
  cardNumber: 'קלף {number}',
  cardLabel: '{artist} — {title} ({year})',
};

export const dictionaries: Record<Lang, Dictionary> = { en, he };

export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in params ? String(params[key]) : m,
  );
}

export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  return format(dictionaries[lang][key], params);
}
