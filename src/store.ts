/**
 * Shared in-memory storage for verified nullifiers.
 * Extracted to avoid circular imports between index.ts and middleware.ts.
 */
export const verifiedNullifiers: Set<string> = new Set()
