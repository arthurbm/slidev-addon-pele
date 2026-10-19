import type { CodeblockTransformContext } from "@slidev/types";
import { describe, expect, it } from "vitest";

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

  it("returns nothing for other code blocks, so Slidev handles them", async () => {
    await expect(transform("ts {1|2}", "const x = 1")).resolves.toBeNull();
  });
});
