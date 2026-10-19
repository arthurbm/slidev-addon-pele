import { describe, expect, it } from "vitest";

import { readFencedBlock } from "../src/fenced-block";
import { diagram, read } from "./blocks";

const body = "flowchart LR\n  user --> agent\n";

const warningsFor = async (
  fence: string,
  headmatter?: Record<string, unknown>
) => {
  const block = await read(fence, body, headmatter);
  return block.warnings;
};

describe("block options", () => {
  it("accepts every option the addon documents without a warning", async () => {
    await expect(
      warningsFor(
        "mermaid {user|agent}{scale: 0.8, theme: 'neutral', reveal: true, renderer: 'pele', at: 1}"
      )
    ).resolves.toStrictEqual([]);
  });

  it("warns about an option Pele does not use, listing the ones it does", async () => {
    await expect(
      warningsFor(
        "mermaid {scale: 0.8, themeVariables: {primaryColor: '#f00'}}"
      )
    ).resolves.toStrictEqual([
      "[pele] Pele ignores the option themeVariables: its options are scale, theme, reveal, renderer, at. Add renderer: 'mermaid' to draw this diagram with mermaid.js.",
    ]);
  });

  it.each(["{scale: 0}", "{scale: -1}", "{scale: '80%'}"])(
    "warns that scale in %s must be a positive number",
    async (options) => {
      await expect(warningsFor(`mermaid ${options}`)).resolves.toStrictEqual([
        "[pele] scale must be a number greater than 0, as in {scale: 0.8}.",
      ]);
    }
  );

  it("leaves options that are not plain literals to Vue, without warnings", async () => {
    await expect(
      read("mermaid {scale: $slidev.nav.currentPage / 10}", body)
    ).resolves.toMatchObject({
      options: "{scale: $slidev.nav.currentPage / 10}",
      renderer: "pele",
      warnings: [],
    });
  });

  it.each([
    [
      "{reveal: true}",
      "[pele] reveal does nothing on a diagram block without steps: add steps before the options, as in ```mermaid {a|b|*}{reveal: true}, or remove reveal.",
    ],
    [
      "{at: '+2'}",
      "[pele] at does nothing on a diagram block without steps: add steps before the options, as in ```mermaid {a|b|*}{at: '+2'}, or remove at.",
    ],
  ])(
    "warns that %s does nothing without steps, naming the fix",
    async (options, warning) => {
      await expect(warningsFor(`mermaid ${options}`)).resolves.toStrictEqual([
        warning,
      ]);
    }
  );

  it("names the file and slide in a warning when it knows them", async () => {
    const block = await readFencedBlock({
      body,
      fence: "mermaid {scale: 0}",
      where: "slides.md, slide 3",
    });

    expect(block.warnings).toStrictEqual([
      "[pele] slides.md, slide 3: scale must be a number greater than 0, as in {scale: 0.8}.",
    ]);
  });

  it("binds the options as written, for Vue to evaluate as Slidev does", async () => {
    const block = await diagram(
      "mermaid {user|agent}{scale: 0.8, theme: 'neutral'}",
      body
    );

    expect(block.options).toBe("{scale: 0.8, theme: 'neutral'}");
  });
});

describe("deck settings", () => {
  it("warns when the deck's pele.mermaid is not a boolean", async () => {
    await expect(
      warningsFor("mermaid", { pele: { mermaid: "no" } })
    ).resolves.toStrictEqual([
      '[pele] pele.mermaid in the headmatter must be true or false, got "no": write `pele: { mermaid: false }` to draw ```mermaid blocks with mermaid.js.',
    ]);
  });

  it("warns about a setting it does not know, listing the ones it does", async () => {
    await expect(
      warningsFor("mermaid", { pele: { scale: 0.8, theme: "auto" } })
    ).resolves.toStrictEqual([
      "[pele] Unknown setting pele.scale in the headmatter: the settings are pele.theme, pele.mermaid.",
    ]);
  });
});
