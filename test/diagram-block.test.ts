import { renderAsync } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { diagram, read } from "./blocks";

const flowchart = `flowchart LR
  user[User] --> agent[Agent]
  agent --> tools[Tools]
`;

describe("diagram block", () => {
  it("draws a ```mermaid flowchart with Pele", async () => {
    const block = await diagram("mermaid", flowchart);

    const { svg, type } = await renderAsync(block.source);
    expect(type).toBe("flowchart");
    for (const id of ["user", "agent", "tools"]) {
      expect(svg).toContain(`data-id="${id}"`);
    }
  });

  it("draws a ```pele flowchart with Pele", async () => {
    await expect(read("pele", flowchart)).resolves.toMatchObject({
      renderer: "pele",
      source: flowchart.trim(),
    });
  });

  it("keeps a broken diagram on Pele, whose message says where the mistake is", async () => {
    const block = await diagram(
      "mermaid",
      "flowchart LR\n  A --> B\n  B -->> [x\n"
    );

    expect(block).toMatchObject({ errors: [], warnings: [] });
    await expect(renderAsync(block.source)).rejects.toThrow(
      "Parse error on line 3"
    );
  });

  it("hands a code block in another language back to Slidev", async () => {
    await expect(read("ts {1|2}", "const x = 1")).resolves.toStrictEqual({
      renderer: "slidev",
      warnings: [],
    });
  });
});
