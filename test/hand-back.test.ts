import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";

const flowchart = "flowchart LR\n  user --> agent\n";
const optedOut = { pele: { mermaid: false } };

describe("hand-back to mermaid.js", () => {
  it("hands every ```mermaid block back when the deck opts out", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "mermaid {scale: 0.8}",
      headmatter: optedOut,
    });

    expect(block).toStrictEqual({ renderer: "slidev", warnings: [] });
  });

  it("still draws a ```pele block with Pele when the deck opts out", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "pele",
      headmatter: optedOut,
    });

    expect(block.renderer).toBe("pele");
  });

  it.each([
    "mermaid {renderer: 'mermaid'}",
    'mermaid {renderer: "mermaid", scale: 0.8}',
    "mermaid { scale: 0.8, renderer: `mermaid` }",
  ])("hands `%s` back", (fence) => {
    expect(readDiagramBlock({ body: flowchart, fence })).toStrictEqual({
      renderer: "slidev",
      warnings: [],
    });
  });

  it("draws a block with renderer: 'pele' with Pele even when the deck opts out", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "mermaid {renderer: 'pele'}",
      headmatter: optedOut,
    });

    expect(block.renderer).toBe("pele");
  });

  it("drops steps from a block it hands back, since mermaid.js cannot take them", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "mermaid {user|agent}{renderer: 'mermaid', scale: 0.8}",
    });

    expect(block).toStrictEqual({
      fence: "mermaid {renderer: 'mermaid', scale: 0.8}",
      renderer: "slidev",
      warnings: [
        "[pele] mermaid.js cannot step through a diagram, so the steps {user|agent} are ignored: remove them, or remove renderer: 'mermaid' to draw it with Pele.",
      ],
    });
  });

  it("drops steps from a block the deck opt-out hands back", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "mermaid {user|agent}",
      headmatter: optedOut,
    });

    expect(block).toStrictEqual({
      fence: "mermaid",
      renderer: "slidev",
      warnings: [
        "[pele] mermaid.js cannot step through a diagram, so the steps {user|agent} are ignored: remove them, or remove `pele: { mermaid: false }` from the headmatter to draw it with Pele.",
      ],
    });
  });

  it("keeps a ```pele block with renderer: 'mermaid' on Pele, with a warning", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "pele {renderer: 'mermaid'}",
    });

    expect(block).toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] A ```pele block is always drawn with Pele: write ```mermaid {renderer: 'mermaid'} to draw it with mermaid.js.",
      ],
    });
  });

  it("warns about an unknown renderer and draws with Pele", () => {
    const block = readDiagramBlock({
      body: flowchart,
      fence: "mermaid {renderer: 'mermaidjs'}",
    });

    expect(block).toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] Unknown renderer 'mermaidjs': use renderer: 'pele' or renderer: 'mermaid'.",
      ],
    });
  });
});

describe("diagram types Pele cannot draw", () => {
  const zenuml = "zenuml\n  title Order\n  Client->Server.order()\n";

  it("hands ZenUML back to mermaid.js with a warning", () => {
    const block = readDiagramBlock({ body: zenuml, fence: "mermaid" });

    expect(block).toStrictEqual({
      renderer: "slidev",
      warnings: [
        "[pele] Pele cannot draw ZenUML, so this diagram is drawn by mermaid.js.",
      ],
    });
  });

  it("finds ZenUML after front matter and comments", () => {
    const block = readDiagramBlock({
      body: `---\ntitle: Order\n---\n%% a comment\n${zenuml}`,
      fence: "mermaid",
    });

    expect(block.renderer).toBe("slidev");
  });

  it("leaves a ```pele ZenUML block to Pele, which shows why it cannot draw it", () => {
    const block = readDiagramBlock({ body: zenuml, fence: "pele" });

    expect(block).toMatchObject({
      renderer: "pele",
      warnings: [
        "[pele] Pele cannot draw ZenUML: write ```mermaid to draw it with mermaid.js.",
      ],
    });
  });
});
