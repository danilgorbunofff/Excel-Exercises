// Why this exists: the server-made random parts of certificates. A start token
// is the server's start time of a mock assessment, signed for one user and
// set, so the time a certificate rests on is the server's own. A certificate
// id is random, so nobody can guess another person's page.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 16 random bytes as base64url: 22 characters, unguessable, not sequential. */
export const newCertificateId = (): string => randomBytes(16).toString("base64url");

const sign = (key: string, text: string) =>
  createHmac("sha256", key).update(text).digest("base64url");

/** A start token: the server's start time, signed for this user and set. */
export function startToken(key: string, userId: string, slug: string, now = Date.now()): string {
  return `${now}.${sign(key, `${userId}:${slug}:${now}`)}`;
}

/** The start time in ms if the token was signed for this user and set, else null. */
export function readStartToken(
  key: string,
  userId: string,
  slug: string,
  token: string | null,
  now = Date.now(),
): number | null {
  const [ms = "", sig = ""] = (token ?? "").split(".");
  const start = Number(ms);
  if (!/^\d{13}$/u.test(ms) || start > now) return null;
  const want = Buffer.from(sign(key, `${userId}:${slug}:${ms}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? start : null;
}
