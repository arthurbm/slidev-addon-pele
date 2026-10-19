import { renderAsync } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";

const flowchart = `flowchart LR
  user[User] --> agent[Agent]
  agent --> tools[Tools]
`;

describe("diagram block", () => {
  it("draws a ```mermaid flowchart with Pele", async () => {
    const block = readDiagramBlock({ body: flowchart, fence: "mermaid" });

    expect(block.renderer).toBe("pele");
    if (block.renderer !== "pele") {
      return;
    }
    const { svg, type } = await renderAsync(block.source);
    expect(type).toBe("flowchart");
    for (const id of ["user", "agent", "tools"]) {
      expect(svg).toContain(`data-id="${id}"`);
    }
  });

  it("draws a ```pele flowchart with Pele", () => {
    const block = readDiagramBlock({ body: flowchart, fence: "pele" });

    expect(block).toStrictEqual({ renderer: "pele", source: flowchart.trim() });
  });

  it("hands a code block in another language back to Slidev", () => {
    const block = readDiagramBlock({
      body: "const x = 1",
      fence: "ts {1|2}",
    });

    expect(block).toStrictEqual({ renderer: "slidev" });
  });
});
