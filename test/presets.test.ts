import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";

const body = "flowchart LR\n  a --> b\n";

const read = (fence: string, headmatter?: Record<string, unknown>) => {
  const block = readDiagramBlock({ body, fence, headmatter });
  if (block.renderer !== "pele") {
    throw new Error(`expected Pele to draw "${fence}"`);
  }
  return block;
};

describe("presets", () => {
  it("draws with the auto preset by default", () => {
    const block = read("mermaid");

    expect(block.preset).toStrictEqual({ name: "auto" });
    expect(block.warnings).toStrictEqual([]);
  });

  it("takes the deck's preset from `pele.theme` in the headmatter", () => {
    const block = read("mermaid", { pele: { theme: "flexoki" } });

    expect(block.preset).toStrictEqual({ name: "flexoki" });
  });

  it("takes a block's preset from its `theme` option", () => {
    const block = read("mermaid {theme: 'flexoki', scale: 0.8}");

    expect(block.preset).toStrictEqual({ name: "flexoki" });
  });

  it("lets a block's preset win over the deck's", () => {
    const block = read('pele {theme: "auto"}', { pele: { theme: "flexoki" } });

    expect(block.preset).toStrictEqual({ name: "auto" });
  });
});

describe("Mermaid theme names", () => {
  it.each([
    ["default", { name: "auto" }],
    ["base", { name: "auto" }],
    ["neutral", { name: "auto", tone: "grey" }],
    ["dark", { name: "auto", tone: "dark" }],
  ])("maps `theme: '%s'` to the nearest preset, silently", (theme, preset) => {
    const block = read(`mermaid {theme: '${theme}'}`);

    expect(block.preset).toStrictEqual(preset);
    expect(block.warnings).toStrictEqual([]);
  });

  it("draws `theme: 'forest'` with auto and warns that it has no preset", () => {
    const block = read("mermaid {theme: 'forest'}");

    expect(block.preset).toStrictEqual({ name: "auto" });
    expect(block.warnings).toStrictEqual([
      "[pele] Mermaid's \"forest\" theme has no Pele preset, so this diagram uses \"auto\". Set theme to 'auto' or 'flexoki', or style the diagram with --pele-* CSS variables.",
    ]);
  });

  it.each(["paper", "constructor"])(
    "draws an unknown `theme: '%s'` with auto and lists the valid names",
    (theme) => {
      const block = read(`mermaid {theme: '${theme}'}`);

      expect(block.preset).toStrictEqual({ name: "auto" });
      expect(block.warnings).toStrictEqual([
        `[pele] Unknown theme "${theme}", so this diagram uses "auto". Use a preset (auto, flexoki) or a Mermaid theme name (default, base, neutral, dark, forest).`,
      ]);
    }
  );

  it("warns about an unknown deck `pele.theme` too", () => {
    const block = read("mermaid", { pele: { theme: 42 } });

    expect(block.preset).toStrictEqual({ name: "auto" });
    expect(block.warnings).toStrictEqual([
      '[pele] Unknown theme "42", so this diagram uses "auto". Use a preset (auto, flexoki) or a Mermaid theme name (default, base, neutral, dark, forest).',
    ]);
  });

  it("maps them in the deck's `pele.theme` too", () => {
    const block = read("mermaid", { pele: { theme: "dark" } });

    expect(block.preset).toStrictEqual({ name: "auto", tone: "dark" });
  });
});
