import { render } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readFencedBlock } from "../src/fenced-block";
import { fences, magicMove } from "./blocks";

// The bot from the Showcase deck, growing over three versions.
const v1 = "flowchart LR\n  user[User] --> bot[Bot]";
const v2 = `${v1}\n  bot --> llm[LLM]`;
const v3 = `${v2}\n  bot --> tools[Tools]\n  tools --> bot`;

describe("magic-move between diagram versions", () => {
  it("takes over a magic-move whose fences are all diagram blocks", async () => {
    const block = await magicMove({
      body: fences(["mermaid", v1], ["pele", v2], ["mermaid", v3]),
      fence: "md magic-move",
    });

    expect(block).toMatchObject({
      clicks: 2,
      preset: { name: "auto" },
      renderer: "pele",
      versions: [v1, v2, v3],
      warnings: [],
    });
    expect(block).not.toHaveProperty("options");
  });

  it("reads the outer fence's options, as Slidev does", async () => {
    const block = await magicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move {at: 2, duration: 1200}",
    });

    expect(block).toMatchObject({
      options: "{at: 2, duration: 1200}",
      renderer: "pele",
      versions: [v1, v2],
      warnings: [],
    });
  });

  it("follows the deck's preset", async () => {
    const block = await magicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move",
      headmatter: { pele: { theme: "flexoki" } },
    });

    expect(block).toMatchObject({ preset: { name: "flexoki" } });
  });

  it("reads a magic-move only from a four-backtick fence, as Slidev does", async () => {
    const block = await readFencedBlock({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move",
    });

    expect(block).toStrictEqual({ renderer: "slidev", warnings: [] });
  });
});

describe("the version shown at each click", () => {
  const three = fences(["mermaid", v1], ["mermaid", v2], ["mermaid", v3]);
  // Slidev's CLICKS_MAX: the click overview, print and going back land on.
  const CLICKS_MAX = 999_999;

  it("shows the first version before any click and one more per click", async () => {
    const block = await magicMove({ body: three, fence: "md magic-move" });

    expect(
      [0, 1, 2, 3, CLICKS_MAX].map((click) => block.versionAt(click))
    ).toStrictEqual([0, 1, 2, 2, 2]);
  });

  it("starts moving at the click `at` names", async () => {
    const block = await magicMove({
      body: three,
      fence: "md magic-move {at: 3}",
    });

    expect([0, 2, 3, 4].map((click) => block.versionAt(click))).toStrictEqual([
      0, 0, 1, 2,
    ]);
  });

  it("shows the last version and takes no clicks with `at: false`", async () => {
    const block = await magicMove({
      body: three,
      fence: "md magic-move {at: false}",
    });

    expect(block.clicks).toBe(0);
    expect(block.versionAt(0)).toBe(2);
  });
});

describe("moving between two versions", () => {
  const withLlm = `flowchart LR
  user[User] --> bot[Bot]
  bot --> llm[LLM]`;
  const withTools = `${withLlm}
  bot --> tools[Tools]
  tools --> bot
  subgraph agent[Agent]
    bot
    tools
  end`;

  it("glides the parts both versions have and fades in the new ones", async () => {
    const block = await magicMove({
      body: fences(["mermaid", withLlm], ["mermaid", withTools]),
      fence: "md magic-move",
    });

    expect(block.changeAt(1)).toStrictEqual({
      enter: ["agent", "L_bot_tools_0", "L_tools_bot_0", "tools"],
      glide: ["L_user_bot_0", "L_bot_llm_0", "user", "bot", "llm"],
      leave: [],
    });
  });

  it("fades out the parts only the old version has", async () => {
    const block = await magicMove({
      body: fences(["mermaid", withTools], ["mermaid", withLlm]),
      fence: "md magic-move",
    });

    expect(block.changeAt(1)).toStrictEqual({
      enter: [],
      glide: ["L_user_bot_0", "L_bot_llm_0", "user", "bot", "llm"],
      leave: ["agent", "L_bot_tools_0", "L_tools_bot_0", "tools"],
    });
  });

  it("matches parts by their ids as Pele wrote them, quotes and ampersands decoded", async () => {
    const block = await magicMove({
      body: fences(
        ["mermaid", `pie\n  "Cats & 'Dogs'" : 3\n  "Birds" : 1`],
        ["mermaid", `pie\n  "Cats & 'Dogs'" : 3\n  "<b>" : 2`]
      ),
      fence: "md magic-move",
    });

    expect(block.changeAt(1)).toStrictEqual({
      enter: ["<b>"],
      glide: ["Cats & 'Dogs'"],
      leave: ["Birds"],
    });
  });
});

/** Whether a drawing runs down rather than across. */
const runsDown = (source: string, maxWidth: number, autoDirection = false) => {
  const { width, height } = render(source, { autoDirection, maxWidth });
  return height > width;
};

describe("one direction for every version", () => {
  const small = "flowchart LR\n  user[User] --> bot[Bot]";
  const withTools = `flowchart LR
  user[User] --> bot[Bot]
  bot --> llm[LLM]
  bot --> tools[Tools]
  tools --> bot
  subgraph agent[Agent]
    bot
    tools
  end`;

  it("turns every version top-to-bottom when one of them must turn", async () => {
    const block = await magicMove({
      body: fences(["mermaid", small], ["mermaid", withTools]),
      fence: "md magic-move",
    });
    // Room for the small version across, not for the one with tools.
    const width = render(small).width + 10;
    // Left to itself, Pele turns only the version that does not fit.
    expect(runsDown(small, width, true)).toBeFalsy();
    expect(runsDown(withTools, width, true)).toBeTruthy();

    const drawn = block.drawnWith({ maxWidth: width });

    expect(drawn.map((source) => runsDown(source, width))).toStrictEqual([
      true,
      true,
    ]);
  });

  it("leaves every version as written when they all fit", async () => {
    const block = await magicMove({
      body: fences(["mermaid", small], ["mermaid", withTools]),
      fence: "md magic-move",
    });

    expect(block.drawnWith({ maxWidth: 2000 })).toStrictEqual([
      small,
      withTools,
    ]);
  });

  it("leaves a type other than flowchart across, for the slide to shrink", async () => {
    const classes = [
      "classDiagram\n  direction LR\n  A --> B",
      "classDiagram\n  direction LR\n  A --> B\n  B --> C\n  C --> D\n  D --> E",
    ] as const;
    const block = await magicMove({
      body: fences(["mermaid", classes[0]], ["mermaid", classes[1]]),
      fence: "md magic-move",
    });
    const narrow = render(classes[0]).width + 10;
    expect(runsDown(classes[1], narrow, true)).toBeTruthy();

    expect(block.drawnWith({ maxWidth: narrow })).toStrictEqual([...classes]);
  });
});

describe("what a diagram cannot take from Slidev's magic-move", () => {
  const two = fences(["mermaid", v1], ["mermaid", v2]);

  it("ignores lines with a warning that names the fix", async () => {
    const block = await magicMove({
      body: two,
      fence: "md magic-move {at: 2, lines: true}",
    });

    expect(block.warnings).toStrictEqual([
      "[pele] A magic-move of diagrams ignores the option lines, since diagrams have no line numbers: remove it. Its options are at, duration.",
    ]);
  });

  it("ignores an option it does not know with a warning listing the ones it does", async () => {
    const block = await magicMove({
      body: two,
      fence: "md magic-move {speed: 2}",
    });

    expect(block.warnings).toStrictEqual([
      "[pele] A magic-move of diagrams ignores the option speed, since it has no effect: remove it. Its options are at, duration.",
    ]);
  });

  it("ignores a title with a warning", async () => {
    const block = await magicMove({
      body: two,
      fence: "md magic-move [bot.mmd]",
    });

    expect(block.warnings).toStrictEqual([
      "[pele] A magic-move of diagrams shows no title, so [bot.mmd] is ignored: remove it.",
    ]);
  });
});

describe("steps and options inside versions", () => {
  it("ignores a version's steps with a warning that names the fix", async () => {
    const block = await magicMove({
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

  it("ignores a version's options with a warning that names the fix", async () => {
    const block = await magicMove({
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

  it("prints a warning of the deck's settings once, not once per version", async () => {
    const block = await magicMove({
      body: fences(["mermaid", v1], ["mermaid", v2]),
      fence: "md magic-move",
      headmatter: { pele: { theme: "forest" } },
    });

    expect(block).toMatchObject({
      warnings: [expect.stringMatching(/^\[pele\] Mermaid's "forest" theme/u)],
    });
  });

  it("names the file and slide in its warnings", async () => {
    const block = await readFencedBlock({
      backticks: 4,
      body: fences(["mermaid", v1], ["mermaid {user}", v2]),
      fence: "md magic-move",
      where: "slides.md, slide 3",
    });

    expect(block.warnings).toStrictEqual([
      expect.stringMatching(
        /^\[pele\] slides\.md, slide 3: Steps are not supported inside magic-move/u
      ),
    ]);
  });
});

/** How a four-backtick fence is shown. */
const shown = (
  body: string,
  fence = "md magic-move",
  headmatter?: Record<string, unknown>
) => readFencedBlock({ backticks: 4, body, fence, headmatter });

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
  ])("hands back %s", async (_, body) => {
    await expect(shown(body)).resolves.toStrictEqual({
      renderer: "slidev",
      warnings: [],
    });
  });

  it("hands back ```mermaid versions when the deck opts out", async () => {
    const optedOut = { pele: { mermaid: false } };

    await expect(
      shown(fences(["mermaid", v1], ["mermaid", v2]), "md magic-move", optedOut)
    ).resolves.toStrictEqual({ renderer: "slidev", warnings: [] });
    await expect(
      shown(
        fences(["pele", v1], ["mermaid {renderer: 'pele'}", v2]),
        "md magic-move",
        optedOut
      )
    ).resolves.toMatchObject({ renderer: "pele", versions: [v1, v2] });
  });
});
