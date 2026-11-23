// Why this exists: sends one email through Resend's HTTP API, with the
// unsubscribe headers mail apps show as a button. No SDK: one fetch call.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.ts";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** The HTML part (src/server/mail-templates.ts); text is the fallback. */
  html?: string;
  /** The one-click unsubscribe address for this person. */
  unsubscribe: string;
}

export async function sendMail(mail: Mail): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom(),
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
      headers: {
        "List-Unsubscribe": `<${mail.unsubscribe}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  }).catch(() => null);
  return res?.ok === true;
}

const sign = (key: string, userId: string) =>
  createHmac("sha256", key).update(`unsubscribe:${userId}`).digest("base64url");

/** A token that lets the link in an email turn that person's weekly email off. */
export const unsubscribeToken = (key: string, userId: string): string =>
  `${userId}.${sign(key, userId)}`;

/** The user id the token was signed for, or null. */
export function readUnsubscribeToken(key: string, token: string | null): string | null {
  const [userId = "", sig = ""] = (token ?? "").split(".");
  if (!/^[0-9a-f-]{36}$/u.test(userId)) return null;
  const want = Buffer.from(sign(key, userId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? userId : null;
}
