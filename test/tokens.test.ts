import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { measure, measureShowcase } from "../scripts/tokens";

const showcase = new URL("../showcase/", import.meta.url);

describe("the tokens slide's numbers", () => {
  it("counts UTF-8 bytes and o200k_base tokens", () => {
    // "é" is two bytes; o200k_base reads "hello world" as two tokens.
    expect(measure("hello world")).toStrictEqual({ bytes: 11, tokens: 2 });
    expect(measure("é").bytes).toBe(2);
  });

  it("are the ones `pnpm tokens` measures from the two files today", async () => {
    const committed = JSON.parse(
      await readFile(new URL("tokens/counts.json", showcase), "utf-8")
    );

    await expect(measureShowcase()).resolves.toStrictEqual(committed);
  });
});
