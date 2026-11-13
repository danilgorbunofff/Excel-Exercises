import { describe, expect, it } from "vitest";
import { findUnguardedMotion } from "./motion.ts";

const props = (css: string) => findUnguardedMotion(css).map((f) => f.declaration);

describe("findUnguardedMotion", () => {
  it("allows motion inside prefers-reduced-motion: no-preference", () => {
    expect(
      props(
        `@media (prefers-reduced-motion:no-preference){.a{transition:color .15s}.b{animation:x 1s}}`,
      ),
    ).toEqual([]);
  });

  it("allows motion nested deeper inside the guard", () => {
    expect(
      props(
        `@media (prefers-reduced-motion: no-preference) { @media (min-width: 40em) { .a { transition: opacity 120ms; } } }`,
      ),
    ).toEqual([]);
  });

  it("flags transition and animation outside the guard", () => {
    expect(props(`.a{color:red;transition:color .15s}.b{animation-name:spin}`)).toEqual([
      "transition:color .15s",
      "animation-name:spin",
    ]);
  });

  it("flags motion inside other media queries", () => {
    expect(props(`@media (min-width:40em){.a{transition:all 1s}}`)).toEqual(["transition:all 1s"]);
  });

  it("flags smooth scrolling but allows none values", () => {
    expect(props(`html{scroll-behavior:smooth}.a{transition:none;animation:none}`)).toEqual([
      "scroll-behavior:smooth",
    ]);
  });

  it("ignores comments, strings and keyframe definitions", () => {
    expect(
      props(
        `/* .a{transition:all 1s} */ .b::after{content:"transition:all 1s;"} @keyframes x{from{opacity:0}to{opacity:1}}`,
      ),
    ).toEqual([]);
  });

  it("checks the last declaration in a block even without a semicolon", () => {
    expect(props(`.a{transition:transform 1s}`)).toEqual(["transition:transform 1s"]);
  });
});
