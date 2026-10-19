import { readFence } from "./fence";
import type { Fence } from "./fence";
import { readOptions } from "./options";
import { readPreset } from "./preset";
import type { Preset } from "./preset";

/** What an author writes for one fenced block in a slide. */
export interface DiagramBlockInput {
  /** The fence's opening line after the backticks, e.g. `mermaid {scale: 0.8}`. */
  fence: string;
  /** The block's body: Mermaid syntax for a diagram block. */
  body: string;
  /** The deck's headmatter. */
  headmatter?: Record<string, unknown>;
}

/** A diagram block drawn by Pele. */
export interface PeleBlock {
  renderer: "pele";
  source: string;
  preset: Preset;
  warnings: string[];
  /** The block's steps as written in the fence, e.g. `user|agent,llm|*`. */
  steps?: string;
  /** The block's options as written, a JavaScript object expression. */
  options?: string;
}

/**
 * How the slide shows a fenced block: drawn by Pele, or handed back to
 * Slidev (which draws ```mermaid with mermaid.js and anything else as code).
 * Warnings are for the terminal, each with the `[pele]` prefix.
 */
export type DiagramBlock =
  | PeleBlock
  | {
      renderer: "slidev";
      /** The opening line Slidev must read instead, when it differs. */
      fence?: string;
      warnings: string[];
    };

/** Why a ```mermaid block goes back to mermaid.js. */
type HandBack = "block" | "deck" | "zenuml";

const DIAGRAM_LANGUAGES = new Set(["mermaid", "pele"]);
const RENDERERS = new Set(["mermaid", "pele"]);
// Mermaid's own ZenUML detector, after front matter and `%%` comments.
const FRONT_MATTER = /^\s*---\n[\s\S]*?\n---\s*\n/u;
const COMMENT_LINE = /^\s*%%.*$/gmu;
const ZENUML = /^\s*zenuml/u;

/** Every option a diagram block accepts. */
export const BLOCK_OPTIONS = [
  "scale",
  "theme",
  "reveal",
  "renderer",
  "at",
] as const;
const KNOWN_OPTIONS = new Set<string>(BLOCK_OPTIONS);

const checkOptions = (values: Record<string, unknown>): string[] => {
  const warnings = Object.keys(values)
    .filter((key) => !KNOWN_OPTIONS.has(key))
    .map(
      (key) =>
        `[pele] Pele ignores the option ${key}: its options are ${BLOCK_OPTIONS.join(", ")}. Add renderer: 'mermaid' to draw this diagram with mermaid.js.`
    );
  const { scale } = values;
  if (scale !== undefined && !(typeof scale === "number" && scale > 0)) {
    warnings.push(
      "[pele] scale must be a number greater than 0, as in {scale: 0.8}."
    );
  }
  return warnings;
};

const isZenUml = (source: string): boolean =>
  ZENUML.test(source.replace(FRONT_MATTER, "").replaceAll(COMMENT_LINE, ""));

const STEPS_FIX: Record<HandBack, string> = {
  block: "remove them, or remove renderer: 'mermaid' to draw it with Pele",
  deck: "remove them, or remove `pele: { mermaid: false }` from the headmatter to draw it with Pele",
  zenuml: "remove them",
};

const handBack = (
  fence: Fence,
  reason: HandBack,
  warnings: string[]
): DiagramBlock => {
  if (reason === "zenuml") {
    warnings.push(
      "[pele] Pele cannot draw ZenUML, so this diagram is handed to mermaid.js, which needs the @mermaid-js/mermaid-zenuml plugin registered to draw it."
    );
  }
  if (fence.steps === undefined) {
    return { renderer: "slidev", warnings };
  }
  // Slidev binds whatever braces follow ```mermaid as options, so steps
  // left in would break the slide's template.
  warnings.push(
    `[pele] mermaid.js cannot step through a diagram, so the steps {${fence.steps}} are ignored: ${STEPS_FIX[reason]}.`
  );
  return {
    fence: [fence.language, fence.options].filter(Boolean).join(" "),
    renderer: "slidev",
    warnings,
  };
};

/** The deck settings under `pele` in the headmatter. */
const readDeckSettings = (headmatter: Record<string, unknown> = {}) => {
  const { pele } = headmatter;
  return typeof pele === "object" && pele !== null
    ? (pele as Record<string, unknown>)
    : {};
};

export const readDiagramBlock = (input: DiagramBlockInput): DiagramBlock => {
  const fence = readFence(input.fence);
  if (!DIAGRAM_LANGUAGES.has(fence.language)) {
    return { renderer: "slidev", warnings: [] };
  }
  const source = input.body.trim();
  const deck = readDeckSettings(input.headmatter);
  const warnings: string[] = [];
  if (fence.ignored) {
    warnings.push(
      `[pele] Ignored "${fence.ignored}" in "\`\`\`${input.fence.trim()}": write steps then options, as in \`\`\`${fence.language} {a|b|*}{scale: 0.8}.`
    );
  }

  const options = readOptions(fence.options);
  const values = options.kind === "literal" ? options.values : {};
  const { renderer } = values;
  if (renderer !== undefined && !RENDERERS.has(String(renderer))) {
    warnings.push(
      `[pele] Unknown renderer '${String(renderer)}': use renderer: 'pele' or renderer: 'mermaid'.`
    );
  }

  if (fence.language === "pele") {
    if (renderer === "mermaid") {
      warnings.push(
        "[pele] A ```pele block is always drawn with Pele: write ```mermaid {renderer: 'mermaid'} to draw it with mermaid.js."
      );
    }
    if (isZenUml(source)) {
      warnings.push(
        "[pele] Pele cannot draw ZenUML: write ```mermaid to draw it with mermaid.js."
      );
    }
  } else {
    if (deck.mermaid !== undefined && typeof deck.mermaid !== "boolean") {
      warnings.push(
        `[pele] pele.mermaid in the headmatter must be true or false, got ${JSON.stringify(deck.mermaid)}: write \`pele: { mermaid: false }\` to draw \`\`\`mermaid blocks with mermaid.js.`
      );
    }
    if (renderer === "mermaid") {
      return handBack(fence, "block", warnings);
    }
    if (deck.mermaid === false && renderer !== "pele") {
      return handBack(fence, "deck", warnings);
    }
    if (isZenUml(source)) {
      return handBack(fence, "zenuml", warnings);
    }
  }

  warnings.push(...checkOptions(values));
  // A block's theme wins over the deck's. A theme that Vue computes in the
  // slide cannot be read here, so the deck's applies to it.
  const { preset, warnings: presetWarnings } = readPreset(
    values.theme ?? deck.theme
  );
  warnings.push(...presetWarnings);
  const block: PeleBlock = { preset, renderer: "pele", source, warnings };
  if (fence.steps !== undefined) {
    block.steps = fence.steps;
  }
  if (fence.options !== undefined) {
    block.options = fence.options;
  }
  return block;
};
