const DEV_SECRET = "lr-dev-secret-change-in-production";

let cached: Uint8Array | null = null;

/**
 * The JWT signing key. Production refuses to run without AUTH_SECRET:
 * falling back to a secret that is public in this repo would let anyone
 * forge a session for any user or role.
 */
export function getAuthSecret(): Uint8Array {
  if (cached) return cached;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production");
    }
    cached = new TextEncoder().encode(DEV_SECRET);
    return cached;
  }
  cached = new TextEncoder().encode(secret);
  return cached;
}
