import { describe, expect, it } from "vitest";

import { diagram } from "./blocks";

const body = "flowchart LR\n  user --> agent\n";

/** The steps and options a diagram block drawn by Pele carries. */
const partsOf = async (fence: string) => {
  const block = await diagram(fence, body);
  return { options: block.options, steps: block.steps };
};

describe("fence reader", () => {
  it("reads a lone object as options, as Slidev's Mermaid blocks do", async () => {
    await expect(partsOf("mermaid {scale: 0.8}")).resolves.toStrictEqual({
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
    [
      "mermaid {scale: 0.8, theme: 'neutral'}",
      undefined,
      "{scale: 0.8, theme: 'neutral'}",
    ],
    [
      "pele   {theme: 'neutral', scale: 0.8}",
      undefined,
      "{theme: 'neutral', scale: 0.8}",
    ],
    ["mermaid {a: {b: 1}, c: '}'}", undefined, "{a: {b: 1}, c: '}'}"],
    // A JavaScript shorthand property, which Vue can compile: options.
    ["mermaid {user, scale: 0.8}", undefined, "{user, scale: 0.8}"],
  ])("reads `%s` as steps %j and options %j", async (fence, steps, options) => {
    await expect(partsOf(fence)).resolves.toStrictEqual({ options, steps });
  });

  it("warns about text it has no place for, naming the grammar", async () => {
    const block = await diagram("mermaid {a|b} large", body);

    expect(block).toMatchObject({ renderer: "pele", steps: "a|b" });
    expect(block.warnings).toStrictEqual([
      '[pele] Ignored "large" in "```mermaid {a|b} large": write steps then options, as in ```mermaid {a|b|*}{scale: 0.8}.',
    ]);
  });

  it("has no warnings for a well-formed fence", async () => {
    const block = await diagram("mermaid {user|agent}{scale: 0.8}", body);

    expect(block.warnings).toStrictEqual([]);
  });
});

describe("steps and options in one pair of braces", () => {
  it.each([
    ["mermaid {user|agent, reveal: true}", "user|agent", "{reveal: true}"],
    [
      "mermaid {user,agent|*, at: 1, reveal: true}",
      "user,agent|*",
      "{at: 1, reveal: true}",
    ],
    ["mermaid {1|2-3, scale: 0.8}", "1|2-3", "{scale: 0.8}"],
  ])(
    "splits `%s` into steps %j and options %j, as the author meant",
    async (fence, steps, options) => {
      await expect(partsOf(fence)).resolves.toStrictEqual({ options, steps });
    }
  );

  it("warns how to write them, each in its own braces", async () => {
    const block = await diagram("mermaid {user|agent, reveal: true}", body);

    expect(block.warnings).toStrictEqual([
      '[pele] Steps and options share one pair of braces in "```mermaid {user|agent, reveal: true}": give each its own, as in ```mermaid {user|agent}{reveal: true}.',
    ]);
    expect(block.partsAt(0)?.hidden).toStrictEqual(["agent", "L_user_agent_0"]);
  });
});
