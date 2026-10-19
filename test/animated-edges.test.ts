import { detectType, load } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { findAnimatedEdges } from "../src/animated-edges";

const loaded = async (source: string) => {
  await load(detectType(source));
  return source;
};

describe("animated edges", () => {
  it("finds the edges marked `animate: true` or given an `animation` speed", async () => {
    const source = await loaded(`flowchart LR
  a --> b
  b e1@--> c
  c e2@==> d
  d e3@-.-> e
  e1@{ animate: true }
  e2@{ animation: slow }
  e3@{ animation: fast }
`);

    expect(findAnimatedEdges(source)).toStrictEqual([
      { id: "e1", speed: "fast" },
      { id: "e2", speed: "slow" },
      { id: "e3", speed: "fast" },
    ]);
  });

  it("finds none in a diagram without edges to animate", async () => {
    const source = await loaded("sequenceDiagram\n  a->>b: hi\n");

    expect(findAnimatedEdges(source)).toStrictEqual([]);
  });

  it("finds none in Mermaid syntax Pele cannot parse", () => {
    expect(findAnimatedEdges("flowchart LR\n  a -->> [x")).toStrictEqual([]);
  });
});
