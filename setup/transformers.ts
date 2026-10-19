import path from "node:path";

import type {
  CodeblockTransformer,
  CodeblockTransformContext,
  TransformersSetupReturn,
} from "@slidev/types";
import { detectType, load } from "pele/lazy";

import { readDiagramBlock } from "../src/diagram-block";
import type { PeleBlock } from "../src/diagram-block";
import { readMagicMove } from "../src/magic-move";
import type { MagicMoveBlock } from "../src/magic-move";
import { encodeSource } from "../src/source-prop";
import { describeStepError, planSteps } from "../src/step-plan";

const where = (slide: CodeblockTransformContext["slide"]) =>
  slide
    ? `${path.relative(process.cwd(), slide.source.filepath)}, slide ${slide.index + 1}: `
    : "";

/** Prints a block's step error in the terminal; the slide shows it too. */
const checkSteps = async (
  block: PeleBlock,
  slide: CodeblockTransformContext["slide"]
) => {
  if (!block.steps) {
    return;
  }
  try {
    await load(detectType(block.source));
  } catch {
    // Pele shows the diagram's own error on the slide.
    return;
  }
  // The mode does not change which ids are valid.
  const plan = planSteps({
    mode: "focus",
    source: block.source,
    steps: block.steps,
  });
  if (plan.kind !== "plan" && plan.kind !== "unreadable") {
    console.error(`[pele] ${where(slide)}${describeStepError(plan)}`);
  }
};

const component = (block: PeleBlock) => {
  const attributes = [
    `source="${encodeSource(block.source)}"`,
    `preset="${block.preset.name}"`,
  ];
  if (block.preset.tone) {
    attributes.push(`tone="${block.preset.tone}"`);
  }
  if (block.steps) {
    // Steps are made of `[\w,|*-]` and spaces, so they never contain a quote.
    attributes.push(`steps="${block.steps}"`);
  }
  if (block.options) {
    // Like Slidev's Mermaid blocks: the options are a JavaScript expression.
    attributes.push(`v-bind="${block.options}"`);
  }
  return `<PeleDiagram ${attributes.join(" ")} />`;
};

/** One diagram that moves between its versions, a click each. */
const magicMoveComponent = (block: MagicMoveBlock) => {
  const attributes = [
    `versions="${encodeSource(JSON.stringify(block.versions))}"`,
    `preset="${block.preset.name}"`,
  ];
  if (block.preset.tone) {
    attributes.push(`tone="${block.preset.tone}"`);
  }
  if (block.options) {
    // Like Slidev's magic-move: `{at}` and the rest bound as an expression.
    attributes.push(`v-bind="${block.options}"`);
  }
  return `<PeleDiagram ${attributes.join(" ")} />`;
};

const printWarnings = (
  warnings: string[],
  slide: CodeblockTransformContext["slide"]
) => {
  for (const warning of warnings) {
    console.warn(warning.replace("[pele] ", `[pele] ${where(slide)}`));
  }
};

// Runs before Slidev's own Mermaid and magic-move transformers (ADR 0001):
// returning null hands the block back to Slidev.
const diagramBlock: CodeblockTransformer = async (context) => {
  const { info, code, fence, options, slide } = context;
  // Slidev reads a magic-move only from a four-backtick fence.
  if (fence === 4) {
    const magicMove = readMagicMove({
      body: code,
      fence: info,
      headmatter: options.data.headmatter,
    });
    if (magicMove.renderer === "pele") {
      printWarnings(magicMove.warnings, slide);
      return magicMoveComponent(magicMove);
    }
  }
  const block = readDiagramBlock({
    body: code,
    fence: info,
    headmatter: options.data.headmatter,
  });
  printWarnings(block.warnings, slide);

  if (block.renderer !== "pele") {
    // Slidev's transformers share this context, so its Mermaid transformer
    // reads the opening line written here.
    if (block.fence !== undefined) {
      context.info = block.fence;
    }
    return null;
  }

  await checkSteps(block, slide);
  return component(block);
};

// A plain function instead of `defineTransformersSetup`, so the addon needs no
// runtime import from `@slidev/types`.
const setupTransformers = (): Partial<TransformersSetupReturn> => ({
  codeblocks: [diagramBlock],
});

export default setupTransformers;
