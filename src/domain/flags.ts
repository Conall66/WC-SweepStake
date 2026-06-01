// Derive a flag emoji from an ISO-3166-1 alpha-2 country code by mapping each
// letter to its regional-indicator symbol. Avoids hardcoding flags per team.

export function flagEmoji(isoCode: string): string {
  const code = isoCode.trim().toUpperCase();
  if (code.length !== 2) return '🏳️';
  const base = 0x1f1e6; // regional indicator 'A'
  const first = base + (code.charCodeAt(0) - 65);
  const second = base + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}
