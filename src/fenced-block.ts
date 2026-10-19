// What the slide shows for one fenced block, read in Node: drawn by Pele or
// handed back to Slidev, the warnings and errors for the terminal, and, for
// Pele, what the audience sees at each click. The transformer builds the slide
// from this; the Node tests drive the addon through it (docs/testing.md).

import { detectType, load, render } from "pele/lazy";

import { findAnimatedEdges } from "./animated-edges";
import type { AnimatedEdge } from "./animated-edges";
import { indexAtClick, startAlone } from "./clicks";
import { dataIds } from "./data-ids";
import { readDiagramBlock } from "./diagram-block";
import type {
  DiagramBlockInput,
  PeleBlock,
  SlidevBlock,
} from "./diagram-block";
import { readMagicMove } from "./magic-move";
import type { MagicMoveBlock } from "./magic-move";
import { readOptions } from "./options";
import { describeStepError, partsAt, planSteps } from "./step-plan";
import type { PartStates } from "./step-plan";
import { changeBetween, inOneDirection } from "./versions";
import type { DrawOptions, VersionChange } from "./versions";

export interface FencedBlockInput extends DiagramBlockInput {
  /** How many backticks open the fence: with 4, a ````md magic-move can be one diagram. */
  backticks?: number;
  /** Where the block is, e.g. `slides.md, slide 3`, named in every message. */
  where?: string;
}

/**
 * A diagram block drawn by Pele. Clicks are counted as if the block were
 * alone on its slide.
 */
export interface DiagramView extends PeleBlock {
  kind: "diagram";
  /** Why the steps cannot be applied, for the terminal and under the diagram. */
  errors: string[];
  /** How many clicks the block takes. */
  clicks: number;
  /** Every part's step state at a click, or `undefined` without steps to apply. */
  partsAt: (click: number) => PartStates | undefined;
  /** The edges whose dashes move. */
  animatedEdges: () => AnimatedEdge[];
}

/** A magic-move drawn by Pele, alone on its slide. */
export interface MagicMoveView extends MagicMoveBlock {
  kind: "magic-move";
  errors: string[];
  clicks: number;
  /** The index of the version shown at a click. */
  versionAt: (click: number) => number;
  /** What happens to each part on arriving at a click, from the version before. */
  changeAt: (click: number) => VersionChange;
  /** The versions as drawn with these options, every flowchart in one direction. */
  drawnWith: (options: DrawOptions) => string[];
}

export type FencedBlock = SlidevBlock | DiagramView | MagicMoveView;

/** Loads a diagram type, so Pele can parse and draw it in Node. */
const loadType = async (source: string) => {
  try {
    return await load(detectType(source));
  } catch {
    // Pele shows the diagram's own error on the slide.
    return false;
  }
};

const literalOption = (options: string | undefined, key: string): unknown => {
  const read = readOptions(options);
  return read.kind === "literal" ? read.values[key] : undefined;
};

const viewDiagram = async (block: PeleBlock): Promise<DiagramView> => {
  await loadType(block.source);
  const plan = block.steps
    ? planSteps({
        mode:
          literalOption(block.options, "reveal") === true ? "reveal" : "focus",
        source: block.source,
        steps: block.steps,
      })
    : undefined;
  const errors =
    // Pele shows a diagram it cannot read on the slide itself.
    plan && plan.kind !== "plan" && plan.kind !== "unreadable"
      ? [`[pele] ${describeStepError(plan)}`]
      : [];
  const start = startAlone(literalOption(block.options, "at"));
  const stepCount = plan?.kind === "plan" ? plan.stepCount : 0;
  return {
    ...block,
    animatedEdges: () => findAnimatedEdges(block.source),
    clicks: start === undefined ? 0 : Math.max(0, stepCount - 1),
    errors,
    kind: "diagram",
    partsAt: (click) =>
      plan?.kind === "plan"
        ? partsAt(plan, indexAtClick({ click, count: stepCount, start }))
        : undefined,
  };
};

const viewMagicMove = async (block: MagicMoveBlock): Promise<MagicMoveView> => {
  await Promise.all(block.versions.map(loadType));
  const count = block.versions.length;
  const start = startAlone(literalOption(block.options, "at"));
  const versionAt = (click: number) => indexAtClick({ click, count, start });
  const idsOf = (index: number) => {
    try {
      return dataIds(render(block.versions[index] ?? "").svg);
    } catch {
      return [];
    }
  };
  return {
    ...block,
    changeAt: (click) =>
      changeBetween(idsOf(versionAt(click - 1)), idsOf(versionAt(click))),
    clicks: start === undefined ? 0 : count - 1,
    drawnWith: (options) => inOneDirection(block.versions, options),
    errors: [],
    kind: "magic-move",
    versionAt,
  };
};

const placed = (messages: string[], where: string | undefined) =>
  where === undefined
    ? messages
    : messages.map((message) =>
        message.replace("[pele] ", `[pele] ${where}: `)
      );

const withPlace = <Block extends FencedBlock>(
  block: Block,
  where: string | undefined
): Block => {
  const result = { ...block, warnings: placed(block.warnings, where) };
  if ("errors" in result) {
    result.errors = placed(result.errors, where);
  }
  return result;
};

/** Reads one fenced block of a slide as the slide will show it. */
export const readFencedBlock = async (
  input: FencedBlockInput
): Promise<FencedBlock> => {
  // Slidev reads a magic-move only from a four-backtick fence.
  if (input.backticks === 4) {
    const magicMove = readMagicMove(input);
    if (magicMove.renderer === "pele") {
      return withPlace(await viewMagicMove(magicMove), input.where);
    }
  }
  const block = readDiagramBlock(input);
  if (block.renderer !== "pele") {
    return withPlace(block, input.where);
  }
  return withPlace(await viewDiagram(block), input.where);
};
