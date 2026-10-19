import type {
  CodeblockTransformer,
  TransformersSetupReturn,
} from "@slidev/types";

import { readDiagramBlock } from "../src/diagram-block";
import { encodeSource } from "../src/source-prop";

// Runs before Slidev's own Mermaid transformer (ADR 0001): returning null
// hands the block back to Slidev.
const diagramBlock: CodeblockTransformer = (context) => {
  const { info, code, options, slide } = context;
  const block = readDiagramBlock({
    body: code,
    fence: info,
    headmatter: options.data.headmatter,
  });
  for (const warning of block.warnings) {
    console.warn(
      slide
        ? warning.replace("[pele] ", `[pele] Slide ${slide.index + 1}: `)
        : warning
    );
  }

  if (block.renderer !== "pele") {
    // Slidev's transformers share this context, so its Mermaid transformer
    // reads the opening line written here.
    if (block.fence !== undefined) {
      context.info = block.fence;
    }
    return null;
  }

  const attributes = [`source="${encodeSource(block.source)}"`];
  if (block.steps !== undefined) {
    attributes.push(`steps="${block.steps}"`);
  }
  // Bound as is, like Slidev's Mermaid blocks: options stay a JavaScript
  // object expression that Vue evaluates.
  if (block.options !== undefined) {
    attributes.push(`v-bind="${block.options}"`);
  }
  return `<PeleDiagram ${attributes.join(" ")} />`;
};

// A plain function instead of `defineTransformersSetup`, so the addon needs no
// runtime import from `@slidev/types`.
const setupTransformers = (): Partial<TransformersSetupReturn> => ({
  codeblocks: [diagramBlock],
});

export default setupTransformers;
