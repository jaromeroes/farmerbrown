/**
 * Constant-time string comparison for share tokens.
 *
 * A timing attack on a 32-character random token over the public internet is
 * not a realistic threat, but comparing secrets in constant time costs
 * nothing and removes the question. Length is compared first and leaks only
 * the length, which is fixed and public anyway.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
