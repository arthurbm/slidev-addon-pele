import { describe, expect, it } from "vitest";

import { diagram } from "./blocks";

describe("animated edges", () => {
  it("moves the edges marked `animate: true` or given an `animation` speed", async () => {
    const block = await diagram(
      "mermaid",
      `flowchart LR
  a --> b
  b e1@--> c
  c e2@==> d
  d e3@-.-> e
  e1@{ animate: true }
  e2@{ animation: slow }
  e3@{ animation: fast }
`
    );

    expect(block.animatedEdges()).toStrictEqual([
      { id: "e1", speed: "fast" },
      { id: "e2", speed: "slow" },
      { id: "e3", speed: "fast" },
    ]);
  });

  it("moves none in a diagram without edges to animate", async () => {
    const block = await diagram("mermaid", "sequenceDiagram\n  a->>b: hi\n");

    expect(block.animatedEdges()).toStrictEqual([]);
  });

  it("moves none in Mermaid syntax Pele cannot parse", async () => {
    const block = await diagram("mermaid", "flowchart LR\n  a -->> [x");

    expect(block.animatedEdges()).toStrictEqual([]);
  });
});
