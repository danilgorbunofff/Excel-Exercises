import { describe, expect, it } from "vitest";
import { back, safePath } from "./http.ts";

describe("safePath", () => {
  it("keeps paths on this site and drops everything else", () => {
    expect(safePath("/profile/")).toBe("/profile/");
    expect(safePath("/exercises/x/?a=1")).toBe("/exercises/x/?a=1");
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "",
      null,
      undefined,
      "profile",
    ]) {
      expect(safePath(bad), String(bad)).toBe("/");
    }
  });
});

describe("back", () => {
  it("redirects to the page with the message", () => {
    expect(back("/login/", { error: "Wrong password" }).headers.get("Location")).toBe(
      "/login/?error=Wrong+password",
    );
    expect(back("//evil.com", { ok: "x" }).headers.get("Location")).toBe("/?ok=x");
  });
});
