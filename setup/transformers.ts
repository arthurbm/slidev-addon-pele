import path from "node:path";

import type {
  CodeblockTransformer,
  CodeblockTransformContext,
  TransformersSetupReturn,
} from "@slidev/types";
import { detectType, load } from "pele/lazy";

import { readDiagramBlock } from "../src/diagram-block";
import type { PeleBlock } from "../src/diagram-block";
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
    // Step ids are made of `[\w,*-]`, so they never contain a quote.
    attributes.push(`:steps='${JSON.stringify(block.steps)}'`);
  }
  if (block.options) {
    // Like Slidev's Mermaid blocks: the options are a JavaScript expression.
    attributes.push(`v-bind="${block.options}"`);
  }
  return `<PeleDiagram ${attributes.join(" ")} />`;
};

// Runs before Slidev's own Mermaid transformer (ADR 0001): returning null
// hands the block back to Slidev.
const diagramBlock: CodeblockTransformer = async ({
  info,
  code,
  options,
  slide,
}) => {
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
  await checkSteps(block, slide);
  return component(block);
};

// A plain function instead of `defineTransformersSetup`, so the addon needs no
// runtime import from `@slidev/types`.
const setupTransformers = (): Partial<TransformersSetupReturn> => ({
  codeblocks: [diagramBlock],
});

export default setupTransformers;
