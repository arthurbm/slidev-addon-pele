import { renderAsync } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";
import { samples } from "./diagram-samples";

describe("every diagram type Pele supports", () => {
  it.each(Object.entries(samples))(
    "draws a ```mermaid %s block with Pele",
    async (type, body) => {
      const block = readDiagramBlock({ body, fence: "mermaid" });
      if (block.renderer !== "pele") {
        throw new Error(`${type} was handed back to Slidev`);
      }

      const result = await renderAsync(block.source);

      expect(result.type).toBe(type);
      expect(result.svg).toMatch(/^<svg [^>]*class="pele pele-/u);
      expect(result.width).toBeGreaterThan(0);
    }
  );
});
