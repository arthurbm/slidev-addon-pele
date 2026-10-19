import type { CodeblockTransformContext } from "@slidev/types";
import { describe, expect, it, vi } from "vitest";

import setupTransformers from "../setup/transformers";
import { decodeSource } from "../src/source-prop";

const flowchart = "flowchart LR\n  a[\"Say {{ hi }}\"] --> b['<b>it</b>']\n";

const transform = async (info: string, code: string) => {
  const [transformer] = setupTransformers().codeblocks ?? [];
  if (!transformer) {
    throw new Error("the addon registers no codeblock transformer");
  }
  const context = {
    code,
    info,
    options: { data: { headmatter: {} } },
  } as unknown as CodeblockTransformContext;
  return await transformer(context);
};

describe("codeblock transformer", () => {
  it("emits the addon's diagram component carrying the block's source", async () => {
    const html = await transform("mermaid", flowchart);

    expect(html).toMatch(/^<PeleDiagram /u);
    const encoded = html?.match(/source="(?<encoded>[^"]*)"/u)?.groups?.encoded;
    expect(decodeSource(encoded ?? "")).toBe(flowchart.trim());
  });

  it("passes the steps and binds the options as Slidev does", async () => {
    const html = await transform(
      "mermaid {a|b,c|*}{reveal: true, at: 1}",
      "flowchart LR\n  a --> b\n  b --> c\n"
    );

    expect(html).toContain(`:steps='["a","b,c","*"]'`);
    expect(html).toContain(`v-bind="{reveal: true, at: 1}"`);
  });

  it("prints an unknown step id in the terminal with the known ids", async () => {
    const errors: unknown[][] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });
    try {
      await transform("mermaid {a|x}", "flowchart LR\n  a --> b\n");
    } finally {
      spy.mockRestore();
    }

    expect(errors.join("\n")).toMatch(
      /^\[pele\] .*Unknown step id "x"\. Use the ids of the diagram: a, b\./u
    );
  });

  it("returns nothing for other code blocks, so Slidev handles them", async () => {
    await expect(transform("ts {1|2}", "const x = 1")).resolves.toBeNull();
  });
});
