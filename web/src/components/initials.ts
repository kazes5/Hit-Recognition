/**
 * The letters shown on a taken timeline spot and in the legends: the first
 * letter of each name, or the first two when another player shares it.
 */
export function playerInitials(names: readonly string[]): string[] {
  const letters = names.map((n) => Array.from(n.replace(/\s+/g, '')));
  const first = letters.map((l) => (l[0] ?? '?').toLocaleUpperCase());
  return letters.map((l, i) => {
    const shared = first.filter((f) => f === first[i]).length > 1;
    if (!shared || l.length < 2) return first[i]!;
    return first[i]! + l[1]!.toLocaleLowerCase();
  });
}
