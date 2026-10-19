import { describe, expect, it } from "vitest";

import { read } from "./blocks";

const flowchart = "flowchart LR\n  user --> agent\n";
const optedOut = { pele: { mermaid: false } };

describe("hand-back to mermaid.js", () => {
  it("hands every ```mermaid block back when the deck opts out", async () => {
    await expect(
      read("mermaid {scale: 0.8}", flowchart, optedOut)
    ).resolves.toStrictEqual({ renderer: "slidev", warnings: [] });
  });

  it("still draws a ```pele block with Pele when the deck opts out", async () => {
    await expect(read("pele", flowchart, optedOut)).resolves.toMatchObject({
      renderer: "pele",
    });
  });

  it.each([
    "mermaid {renderer: 'mermaid'}",
    'mermaid {renderer: "mermaid", scale: 0.8}',
    "mermaid { scale: 0.8, renderer: `mermaid` }",
  ])("hands `%s` back", async (fence) => {
    await expect(read(fence, flowchart)).resolves.toStrictEqual({
      renderer: "slidev",
      warnings: [],
    });
  });

  it("draws a block with renderer: 'pele' with Pele even when the deck opts out", async () => {
    await expect(
      read("mermaid {renderer: 'pele'}", flowchart, optedOut)
    ).resolves.toMatchObject({ renderer: "pele" });
  });

  it("drops steps from a block it hands back, since mermaid.js cannot take them", async () => {
    await expect(
      read("mermaid {user|agent}{renderer: 'mermaid', scale: 0.8}", flowchart)
    ).resolves.toStrictEqual({
      fence: "mermaid {renderer: 'mermaid', scale: 0.8}",
      renderer: "slidev",
      warnings: [
        "[pele] mermaid.js cannot step through a diagram, so the steps {user|agent} are ignored: remove them, or remove renderer: 'mermaid' to draw it with Pele.",
      ],
    });
  });

  it("drops steps from a block the deck opt-out hands back", async () => {
    await expect(
      read("mermaid {user|agent}", flowchart, optedOut)
    ).resolves.toStrictEqual({
      fence: "mermaid",
      renderer: "slidev",
      warnings: [
        "[pele] mermaid.js cannot step through a diagram, so the steps {user|agent} are ignored: remove them, or remove `pele: { mermaid: false }` from the headmatter to draw it with Pele.",
      ],
    });
  });

  it("keeps a ```pele block with renderer: 'mermaid' on Pele, with a warning", async () => {
    await expect(
      read("pele {renderer: 'mermaid'}", flowchart)
    ).resolves.toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] A ```pele block is always drawn with Pele: write ```mermaid {renderer: 'mermaid'} to draw it with mermaid.js.",
      ],
    });
  });

  it("warns about an unknown renderer and draws with Pele", async () => {
    await expect(
      read("mermaid {renderer: 'mermaidjs'}", flowchart)
    ).resolves.toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] Unknown renderer 'mermaidjs': use renderer: 'pele' or renderer: 'mermaid'.",
      ],
    });
  });
});

describe("diagram types Pele cannot draw", () => {
  const zenuml = "zenuml\n  title Order\n  Client->Server.order()\n";

  it("hands ZenUML back to mermaid.js with a warning", async () => {
    await expect(read("mermaid", zenuml)).resolves.toStrictEqual({
      renderer: "slidev",
      warnings: [
        "[pele] Pele cannot draw ZenUML, so this diagram is handed to mermaid.js, which needs the @mermaid-js/mermaid-zenuml plugin registered to draw it.",
      ],
    });
  });

  it("finds ZenUML after front matter and comments", async () => {
    await expect(
      read("mermaid", `---\ntitle: Order\n---\n%% a comment\n${zenuml}`)
    ).resolves.toMatchObject({ renderer: "slidev" });
  });

  it("leaves a ```pele ZenUML block to Pele, which shows why it cannot draw it", async () => {
    await expect(read("pele", zenuml)).resolves.toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] Pele cannot draw ZenUML: write ```mermaid to draw it with mermaid.js.",
      ],
    });
  });
});
