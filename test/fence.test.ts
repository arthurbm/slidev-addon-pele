import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";

const body = "flowchart LR\n  user --> agent\n";

const read = (fence: string) => readDiagramBlock({ body, fence });

/** The steps and options a diagram block drawn by Pele carries. */
const partsOf = (fence: string) => {
  const block = read(fence);
  if (block.renderer !== "pele") {
    throw new Error(`"${fence}" was handed back to Slidev`);
  }
  return { options: block.options, steps: block.steps };
};

describe("fence reader", () => {
  it("reads a lone object as options, as Slidev's Mermaid blocks do", () => {
    expect(partsOf("mermaid {scale: 0.8}")).toStrictEqual({
      options: "{scale: 0.8}",
      steps: undefined,
    });
  });

  it.each([
    ["mermaid", undefined, undefined],
    ["mermaid {user|agent,llm|tools|*}", "user|agent,llm|tools|*", undefined],
    ["mermaid {user}", "user", undefined],
    ["mermaid {1|2-3|*}", "1|2-3|*", undefined],
    ["mermaid { user | agent }", "user | agent", undefined],
    ["mermaid {a|b}{reveal: true}", "a|b", "{reveal: true}"],
    ["mermaid {a|b} {at: 1, reveal: true}", "a|b", "{at: 1, reveal: true}"],
    ["mermaid {}", undefined, "{}"],
    ["mermaid {reveal: true}", undefined, "{reveal: true}"],
    [
      "pele   {theme: 'neutral', scale: 0.8}",
      undefined,
      "{theme: 'neutral', scale: 0.8}",
    ],
    ["mermaid {a: {b: 1}, c: '}'}", undefined, "{a: {b: 1}, c: '}'}"],
  ])("reads `%s` as steps %j and options %j", (fence, steps, options) => {
    expect(partsOf(fence)).toStrictEqual({ options, steps });
  });

  it("warns about text it has no place for, naming the grammar", () => {
    const block = read("mermaid {a|b} large");

    expect(block).toMatchObject({ renderer: "pele", steps: "a|b" });
    expect(block.warnings).toStrictEqual([
      '[pele] Ignored "large" in "```mermaid {a|b} large": write steps then options, as in ```mermaid {a|b|*}{scale: 0.8}.',
    ]);
  });

  it("has no warnings for a well-formed fence", () => {
    expect(read("mermaid {a|b}{scale: 0.8}").warnings).toStrictEqual([]);
  });
});
