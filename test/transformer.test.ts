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
    slide: { index: 2, source: { filepath: `${process.cwd()}/slides.md` } },
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

  it("passes the steps and binds the options as Slidev does", async () => {
    const html = await transform(
      contextFor(
        "mermaid {a|b,c|*}{reveal: true, at: 1}",
        "flowchart LR\n  a --> b\n  b --> c\n"
      )
    );

    expect(html).toContain('steps="a|b,c|*"');
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
      await transform(contextFor("mermaid {a|x}", "flowchart LR\n  a --> b\n"));
    } finally {
      spy.mockRestore();
    }

    expect(errors.join("\n")).toMatch(
      /^\[pele\] .*Unknown step id "x"\. Use the ids of the diagram: a, b\./u
    );
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

  it("prints warnings in the terminal with the file and slide number", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await transform(contextFor("mermaid {scale: 0}", flowchart));

    expect(warn).toHaveBeenCalledWith(
      "[pele] slides.md, slide 3: scale must be a number greater than 0, as in {scale: 0.8}."
    );
  });

  it("hands the block's preset to the diagram component", async () => {
    const html = await transform(
      contextFor("mermaid {theme: 'dark'}", flowchart, {
        pele: { theme: "flexoki" },
      })
    );

    expect(html).toContain(' preset="auto"');
    expect(html).toContain(' tone="dark"');
  });

  it("prints the block's warnings in the terminal", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await transform(contextFor("mermaid {theme: 'forest'}", flowchart));

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[pele\] slides.md, slide 3: Mermaid's "forest" theme/u
      )
    );
    warn.mockRestore();
  });
});
