import type { CodeblockTransformContext } from "@slidev/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import setupTransformers from "../setup/transformers";
import { decodeSource } from "../src/source-prop";

const flowchart = "flowchart LR\n  a[\"Say {{ hi }}\"] --> b['<b>it</b>']\n";

const contextFor = (
  info: string,
  code: string,
  headmatter: Record<string, unknown> = {}
) =>
  ({
    code,
    info,
    options: { data: { headmatter } },
    slide: { index: 2 },
  }) as unknown as CodeblockTransformContext;

const transform = async (context: CodeblockTransformContext) => {
  const [transformer] = setupTransformers().codeblocks ?? [];
  if (!transformer) {
    throw new Error("the addon registers no codeblock transformer");
  }
  return await transformer(context);
};

describe("codeblock transformer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits the addon's diagram component carrying the block's source", async () => {
    const html = await transform(contextFor("mermaid", flowchart));

    expect(html).toMatch(/^<PeleDiagram /u);
    const encoded = html?.match(/source="(?<encoded>[^"]*)"/u)?.groups?.encoded;
    expect(decodeSource(encoded ?? "")).toBe(flowchart.trim());
  });

  it("binds the fence's options as a JavaScript object, as Slidev does", async () => {
    const html = await transform(
      contextFor(
        "mermaid {user|agent}{scale: 0.8, theme: 'neutral'}",
        flowchart
      )
    );

    expect(html).toContain(`v-bind="{scale: 0.8, theme: 'neutral'}"`);
    expect(html).toContain(`steps="user|agent"`);
  });

  it("returns nothing for other code blocks, so Slidev handles them", async () => {
    await expect(
      transform(contextFor("ts {1|2}", "const x = 1"))
    ).resolves.toBeNull();
  });

  it("hands a block back to mermaid.js without the steps it cannot take", async () => {
    vi.spyOn(console, "warn").mockReturnValue();
    const context = contextFor("mermaid {a|b}{renderer: 'mermaid'}", flowchart);

    await expect(transform(context)).resolves.toBeNull();
    expect(context.info).toBe("mermaid {renderer: 'mermaid'}");
  });

  it("prints warnings in the terminal with the slide number", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await transform(contextFor("mermaid {scale: 0}", flowchart));

    expect(warn).toHaveBeenCalledWith(
      "[pele] Slide 3: scale must be a number greater than 0, as in {scale: 0.8}."
    );
  });
});
