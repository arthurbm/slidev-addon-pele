import { readDiagramBlock } from "./diagram-block";
import type { DiagramBlockInput, PeleBlock } from "./diagram-block";
import { readFence } from "./fence";
import { readOptions } from "./options";
import type { Preset } from "./preset";

/**
 * A ````md magic-move fence whose versions are all diagram blocks: one
 * diagram that glides from version to version, one click each.
 */
export interface MagicMoveBlock {
  renderer: "pele";
  /** Each version's Mermaid source, in order. */
  versions: string[];
  preset: Preset;
  warnings: string[];
  /** The outer fence's options as written, e.g. `{at: 2}`. */
  options?: string;
}

/** Drawn by Pele, or left to Slidev's own magic-move. */
export type MagicMove = MagicMoveBlock | { renderer: "slidev" };

// Slidev's own grammar for the outer fence and its inner fences
// (`node/syntax/codeblock/magic-move.ts`).
const MAGIC_MOVE =
  /^(?:md|markdown) magic-move\s*(?:\[[^\]]*\])?\s*(?<options>\{[^}]*\})?/u;
const INNER_FENCE =
  /^```(?<fence>[^\r\n]*)\r?\n(?<body>(?:(?!^```)[\s\S])*?)^```$/gmu;

interface Version {
  /** How the version would be drawn as a block of its own. */
  block: ReturnType<typeof readDiagramBlock>;
  fence: string;
  body: string;
}

/** Whether a version's options hold anything but its renderer. */
const hasOptions = (options: string | undefined): boolean => {
  if (options === undefined) {
    return false;
  }
  const read = readOptions(options);
  return (
    read.kind !== "literal" ||
    Object.keys(read.values).some((key) => key !== "renderer")
  );
};

/** Steps and options belong to a block of its own, not to a version. */
const versionWarnings = (block: PeleBlock, number: number): string[] => {
  const warnings: string[] = [];
  if (block.steps !== undefined) {
    warnings.push(
      `[pele] Steps are not supported inside magic-move, so {${block.steps}} on version ${number} is ignored: remove it, or put the diagram on a slide of its own to step through it.`
    );
  }
  if (hasOptions(block.options)) {
    warnings.push(
      `[pele] Options are not supported on a version inside magic-move, so ${block.options} on version ${number} is ignored: remove it, and set the preset for the deck with pele: { theme } in the headmatter.`
    );
  }
  return warnings;
};

export const readMagicMove = (input: DiagramBlockInput): MagicMove => {
  const outer = input.fence.trim().match(MAGIC_MOVE);
  if (!outer) {
    return { renderer: "slidev" };
  }
  const versions: Version[] = [...input.body.matchAll(INNER_FENCE)].map(
    ({ groups }) => {
      const fence = groups?.fence ?? "";
      const body = groups?.body ?? "";
      // The same rules as a block of its own decide Pele or a hand-back.
      return {
        block: readDiagramBlock({ body, fence, headmatter: input.headmatter }),
        body,
        fence,
      };
    }
  );
  const blocks = versions.flatMap(({ block }) =>
    block.renderer === "pele" ? [block] : []
  );
  if (blocks.length === 0 || blocks.length < versions.length) {
    return { renderer: "slidev" };
  }

  // Every version is drawn with the deck's settings alone, so they share a
  // preset and the deck's warnings are printed once.
  const drawn = versions.map(({ fence, body }) =>
    readDiagramBlock({
      body,
      fence: readFence(fence).language,
      headmatter: input.headmatter,
    })
  );
  const [first] = drawn;
  if (first?.renderer !== "pele") {
    return { renderer: "slidev" };
  }
  const result: MagicMoveBlock = {
    preset: first.preset,
    renderer: "pele",
    versions: blocks.map(({ source }) => source),
    warnings: [
      ...first.warnings,
      ...blocks.flatMap((block, index) => versionWarnings(block, index + 1)),
    ],
  };
  const options = outer.groups?.options;
  if (options !== undefined) {
    result.options = options;
  }
  return result;
};
