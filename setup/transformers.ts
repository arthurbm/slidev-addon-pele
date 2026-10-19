import type {
  CodeblockTransformer,
  TransformersSetupReturn,
} from "@slidev/types";

import { readDiagramBlock } from "../src/diagram-block";
import { encodeSource } from "../src/source-prop";

// Runs before Slidev's own Mermaid transformer (ADR 0001): returning null
// hands the block back to Slidev.
const diagramBlock: CodeblockTransformer = ({ info, code, options }) => {
  const block = readDiagramBlock({
    body: code,
    fence: info,
    headmatter: options.data.headmatter,
  });
  if (block.renderer !== "pele") {
    return null;
  }
  for (const warning of block.warnings) {
    console.warn(warning);
  }
  const { name, tone } = block.preset;
  const toneProp = tone ? ` tone="${tone}"` : "";
  return `<PeleDiagram source="${encodeSource(block.source)}" preset="${name}"${toneProp} />`;
};

// A plain function instead of `defineTransformersSetup`, so the addon needs no
// runtime import from `@slidev/types`.
const setupTransformers = (): Partial<TransformersSetupReturn> => ({
  codeblocks: [diagramBlock],
});

export default setupTransformers;
