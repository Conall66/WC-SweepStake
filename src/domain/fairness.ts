// Commit–reveal fairness. Before the draw we publish only the SHA-256 hash of
// a random seed (the commitment). After the draw we publish the seed itself,
// so anyone can hash it to confirm it matches the commitment and re-run the
// draw to confirm the assignments were never tampered with.

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a cryptographically random seed as a hex string. */
export function generateSeed(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

/** Hash a seed to produce its public commitment. */
export async function commitSeed(seed: string): Promise<string> {
  const data = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/** Confirm that a revealed seed matches a previously published commitment. */
export async function verifyCommitment(seed: string, expectedHash: string): Promise<boolean> {
  const actualHash = await commitSeed(seed);
  return actualHash === expectedHash;
}
