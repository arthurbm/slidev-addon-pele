import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";

const body = "flowchart LR\n  user --> agent\n";

const warningsFor = (fence: string, headmatter?: Record<string, unknown>) =>
  readDiagramBlock({ body, fence, headmatter }).warnings;

describe("block options", () => {
  it("accepts every option the addon documents without a warning", () => {
    expect(
      warningsFor(
        "mermaid {scale: 0.8, theme: 'neutral', reveal: true, renderer: 'pele', at: 1}"
      )
    ).toStrictEqual([]);
  });

  it("warns about an option Pele does not use, listing the ones it does", () => {
    expect(
      warningsFor(
        "mermaid {scale: 0.8, themeVariables: {primaryColor: '#f00'}}"
      )
    ).toStrictEqual([
      "[pele] Pele ignores the option themeVariables: its options are scale, theme, reveal, renderer, at. Add renderer: 'mermaid' to draw this diagram with mermaid.js.",
    ]);
  });

  it.each(["{scale: 0}", "{scale: -1}", "{scale: '80%'}"])(
    "warns that scale in %s must be a positive number",
    (options) => {
      expect(warningsFor(`mermaid ${options}`)).toStrictEqual([
        "[pele] scale must be a number greater than 0, as in {scale: 0.8}.",
      ]);
    }
  );

  it("leaves options that are not plain literals to Vue, without warnings", () => {
    const block = readDiagramBlock({
      body,
      fence: "mermaid {scale: $slidev.nav.currentPage / 10}",
    });

    expect(block).toMatchObject({
      options: "{scale: $slidev.nav.currentPage / 10}",
      renderer: "pele",
      warnings: [],
    });
  });

  it("warns when the deck's pele.mermaid is not a boolean", () => {
    expect(warningsFor("mermaid", { pele: { mermaid: "no" } })).toStrictEqual([
      '[pele] pele.mermaid in the headmatter must be true or false, got "no": write `pele: { mermaid: false }` to draw ```mermaid blocks with mermaid.js.',
    ]);
  });
});
