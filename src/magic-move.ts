import { readDeck, readDiagramBlock } from "./diagram-block";
import type { DiagramBlockInput, PeleBlock } from "./diagram-block";
import { readOptions } from "./options";
import { readPreset } from "./preset";
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

/** Every option of the outer fence the addon honours, as Slidev's magic-move does. */
export const MAGIC_MOVE_OPTIONS = ["at", "duration"] as const;
const KNOWN_OPTIONS = new Set<string>(MAGIC_MOVE_OPTIONS);

// Slidev's own grammar for the outer fence and its inner fences
// (`node/syntax/codeblock/magic-move.ts`).
const MAGIC_MOVE =
  /^(?:md|markdown) magic-move\s*(?:\[(?<title>[^\]]*)\])?\s*(?<options>\{[^}]*\})?/u;
const INNER_FENCE =
  /^```(?<fence>[^\r\n]*)\r?\n(?<body>(?:(?!^```)[\s\S])*?)^```$/gmu;

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

/** What the outer fence asks of Slidev's magic-move that a diagram cannot do. */
const fenceWarnings = (title: string | undefined, options?: string) => {
  const warnings: string[] = [];
  if (title !== undefined) {
    warnings.push(
      `[pele] A magic-move of diagrams shows no title, so [${title}] is ignored: remove it.`
    );
  }
  const read = readOptions(options);
  const keys = read.kind === "literal" ? Object.keys(read.values) : [];
  for (const key of keys.filter((name) => !KNOWN_OPTIONS.has(name))) {
    const why =
      key === "lines" ? "diagrams have no line numbers" : "it has no effect";
    warnings.push(
      `[pele] A magic-move of diagrams ignores the option ${key}, since ${why}: remove it. Its options are ${MAGIC_MOVE_OPTIONS.join(", ")}.`
    );
  }
  return warnings;
};

export const readMagicMove = (input: DiagramBlockInput): MagicMove => {
  const outer = input.fence.trim().match(MAGIC_MOVE);
  if (!outer) {
    return { renderer: "slidev" };
  }
  // The same rules as a block of its own decide Pele or a hand-back.
  const versions = [...input.body.matchAll(INNER_FENCE)].map(({ groups }) =>
    readDiagramBlock({
      body: groups?.body ?? "",
      fence: groups?.fence ?? "",
      headmatter: input.headmatter,
    })
  );
  const blocks = versions.flatMap((block) =>
    block.renderer === "pele" ? [block] : []
  );
  if (blocks.length === 0 || blocks.length < versions.length) {
    return { renderer: "slidev" };
  }

  // Every version is drawn with the deck's preset, and the deck's warnings
  // are printed once.
  const deck = readDeck(input.headmatter);
  const { preset, warnings: presetWarnings } = readPreset(deck.theme);
  const { options, title } = outer.groups ?? {};
  const result: MagicMoveBlock = {
    preset,
    renderer: "pele",
    versions: blocks.map(({ source }) => source),
    warnings: [
      ...deck.warnings,
      ...presetWarnings,
      ...fenceWarnings(title, options),
      ...blocks.flatMap((block, index) => versionWarnings(block, index + 1)),
    ],
  };
  if (options !== undefined) {
    result.options = options;
  }
  return result;
};
