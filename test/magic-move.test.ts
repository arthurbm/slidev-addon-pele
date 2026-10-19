import { describe, expect, it } from "vitest";

import { readMagicMove } from "../src/magic-move";

// The bot from the Showcase deck, growing over three versions.
const v1 = "flowchart LR\n  user[User] --> bot[Bot]";
const v2 = `${v1}\n  bot --> llm[LLM]`;
const v3 = `${v2}\n  bot --> tools[Tools]\n  tools --> bot`;

/** The body of a ````md magic-move fence holding these fences. */
const fences = (...blocks: [fence: string, body: string][]) =>
  blocks.map(([fence, body]) => `\`\`\`${fence}\n${body}\n\`\`\`\n`).join("");

describe("magic-move between diagram versions", () => {
  it("takes over a magic-move whose fences are all diagram blocks", () => {
    const block = readMagicMove({
      body: fences(["mermaid", v1], ["pele", v2], ["mermaid", v3]),
      fence: "md magic-move",
    });

    expect(block).toStrictEqual({
      preset: { name: "auto" },
      renderer: "pele",
      versions: [v1, v2, v3],
      warnings: [],
    });
  });

  it("reads the outer fence with a title and options, as Slidev does", () => {
    const block = readMagicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move [bot.mmd] {at: 2, lines: true}",
    });

    expect(block).toMatchObject({
      options: "{at: 2, lines: true}",
      renderer: "pele",
      versions: [v1, v2],
    });
  });

  it("follows the deck's preset", () => {
    const block = readMagicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move",
      headmatter: { pele: { theme: "flexoki" } },
    });

    expect(block).toMatchObject({ preset: { name: "flexoki" } });
  });
});

describe("steps and options inside versions", () => {
  it("ignores a version's steps with a warning that names the fix", () => {
    const block = readMagicMove({
      body: fences(["mermaid", v1], ["mermaid {user|bot,llm}", v2]),
      fence: "md magic-move",
    });

    expect(block).toMatchObject({
      renderer: "pele",
      versions: [v1, v2],
      warnings: [
        "[pele] Steps are not supported inside magic-move, so {user|bot,llm} on version 2 is ignored: remove it, or put the diagram on a slide of its own to step through it.",
      ],
    });
  });

  it("ignores a version's options with a warning that names the fix", () => {
    const block = readMagicMove({
      body: fences(["mermaid {scale: 0.8, theme: 'flexoki'}", v1]),
      fence: "md magic-move",
    });

    expect(block).toMatchObject({
      preset: { name: "auto" },
      warnings: [
        "[pele] Options are not supported on a version inside magic-move, so {scale: 0.8, theme: 'flexoki'} on version 1 is ignored: remove it, and set the preset for the deck with pele: { theme } in the headmatter.",
      ],
    });
  });

  it("prints a warning of the deck's settings once, not once per version", () => {
    const block = readMagicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move",
      headmatter: { pele: { theme: "forest" } },
    });

    expect(block).toMatchObject({
      warnings: [expect.stringMatching(/^\[pele\] Mermaid's "forest" theme/u)],
    });
  });
});

describe("magic-move left to Slidev", () => {
  it.each([
    ["a fence of code", fences(["yaml", "theme: default"], ["yaml", "a: 1"])],
    [
      "code mixed with a diagram",
      fences(["mermaid", v1], ["ts", "const bot = 1"]),
    ],
    [
      "a version sent to mermaid.js",
      fences(["mermaid", v1], ["mermaid {renderer: 'mermaid'}", v2]),
    ],
    ["a ZenUML version", fences(["mermaid", v1], ["mermaid", "zenuml\n  A.b"])],
    ["no fences at all", "just text\n"],
  ])("hands back %s", (_, body) => {
    expect(readMagicMove({ body, fence: "md magic-move" })).toStrictEqual({
      renderer: "slidev",
    });
  });

  it("hands back ```mermaid versions when the deck opts out", () => {
    const body = fences(["mermaid", v1], ["mermaid", v2]);
    const optedOut = { pele: { mermaid: false } };

    expect(
      readMagicMove({ body, fence: "md magic-move", headmatter: optedOut })
    ).toStrictEqual({ renderer: "slidev" });
    expect(
      readMagicMove({
        body: fences(["pele", v1], ["mermaid {renderer: 'pele'}", v2]),
        fence: "md magic-move",
        headmatter: optedOut,
      })
    ).toMatchObject({ renderer: "pele", versions: [v1, v2] });
  });

  it("leaves other fences alone", () => {
    expect(readMagicMove({ body: v1, fence: "mermaid" })).toStrictEqual({
      renderer: "slidev",
    });
  });
});
