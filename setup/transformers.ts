import path from "node:path";

import type {
  CodeblockTransformer,
  TransformersSetupReturn,
} from "@slidev/types";

import { readFencedBlock } from "../src/fenced-block";
import type { DiagramView, MagicMoveView } from "../src/fenced-block";
import { encodeSource } from "../src/source-prop";

/** The diagram component for a block Pele draws, with the props it needs. */
const component = (view: DiagramView | MagicMoveView) => {
  const attributes =
    view.kind === "magic-move"
      ? [`versions="${encodeSource(JSON.stringify(view.versions))}"`]
      : [`source="${encodeSource(view.source)}"`];
  attributes.push(`preset="${view.preset.name}"`);
  if (view.preset.tone) {
    attributes.push(`tone="${view.preset.tone}"`);
  }
  if (view.kind === "diagram" && view.steps) {
    // Steps are made of `[\w,|*-]` and spaces, so they never contain a quote.
    attributes.push(`steps="${view.steps}"`);
  }
  if (view.options) {
    // Like Slidev's Mermaid blocks and magic-move: the options are a
    // JavaScript expression, bound as the component's props.
    attributes.push(`v-bind="${view.options}"`);
  }
  return `<PeleDiagram ${attributes.join(" ")} />`;
};

// Runs before Slidev's own Mermaid and magic-move transformers (ADR 0001):
// returning null hands the block back to Slidev.
const diagramBlock: CodeblockTransformer = async (context) => {
  const { info, code, fence, options, slide } = context;
  const block = await readFencedBlock({
    backticks: fence,
    body: code,
    fence: info,
    headmatter: options.data.headmatter,
    where: slide
      ? `${path.relative(process.cwd(), slide.source.filepath)}, slide ${slide.index + 1}`
      : undefined,
  });
  for (const warning of block.warnings) {
    console.warn(warning);
  }
  if (block.renderer !== "pele") {
    // Slidev's transformers share this context, so its Mermaid transformer
    // reads the opening line written here.
    if (block.fence !== undefined) {
      context.info = block.fence;
    }
    return null;
  }
  // The slide shows these too, under the diagram.
  for (const error of block.errors) {
    console.error(error);
  }
  return component(block);
};

// A plain function instead of `defineTransformersSetup`, so the addon needs no
// runtime import from `@slidev/types`.
const setupTransformers = (): Partial<TransformersSetupReturn> => ({
  codeblocks: [diagramBlock],
});

export default setupTransformers;
