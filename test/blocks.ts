// Helpers for the Node seam: read a fenced block as the slide shows it.

import { readFencedBlock } from "../src/fenced-block";
import type {
  DiagramView,
  FencedBlockInput,
  MagicMoveView,
} from "../src/fenced-block";
import type { PartStates } from "../src/step-plan";

export const read = (
  fence: string,
  body: string,
  headmatter?: Record<string, unknown>
) => readFencedBlock({ body, fence, headmatter });

/** A block Pele must draw as a diagram of its own. */
export const diagram = async (
  fence: string,
  body: string,
  headmatter?: Record<string, unknown>
): Promise<DiagramView> => {
  const block = await read(fence, body, headmatter);
  if (block.renderer !== "pele" || block.kind !== "diagram") {
    throw new Error(`"${fence}" is not drawn by Pele as a diagram`);
  }
  return block;
};

/** The state of every part at each click, from 0 to the block's last. */
export const clicksOf = (view: DiagramView): PartStates[] =>
  Array.from({ length: view.clicks + 1 }, (_, click) => {
    const states = view.partsAt(click);
    if (!states) {
      throw new Error(view.errors.join("\n") || "the block has no steps");
    }
    return states;
  });

/** Every part's state at each click of a diagram block. */
export const walk = async (fence: string, body: string) =>
  clicksOf(await diagram(fence, body));

/** A ````md magic-move fence Pele must draw. */
export const magicMove = async (
  input: Omit<FencedBlockInput, "backticks">
): Promise<MagicMoveView> => {
  const block = await readFencedBlock({ ...input, backticks: 4 });
  if (block.renderer !== "pele" || block.kind !== "magic-move") {
    throw new Error(`"${input.fence}" is not drawn by Pele as a magic-move`);
  }
  return block;
};

/** The body of a ````md magic-move fence holding these fences. */
export const fences = (...blocks: [fence: string, body: string][]) =>
  blocks.map(([fence, body]) => `\`\`\`${fence}\n${body}\n\`\`\`\n`).join("");
