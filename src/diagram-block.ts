import { readFence } from "./fence";
import type { Fence } from "./fence";
import { readOptions } from "./options";
import { readPreset } from "./preset";
import type { Preset } from "./preset";
import { SCALE_FIX, isScale } from "./scale";

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

/** A fenced block left to Slidev, which draws ```mermaid with mermaid.js and anything else as code. */
export interface SlidevBlock {
  renderer: "slidev";
  /** The opening line Slidev must read instead, when it differs. */
  fence?: string;
  warnings: string[];
}

/**
 * How the slide shows a fenced block: drawn by Pele, or handed back to
 * Slidev. Warnings are for the terminal, each with the `[pele]` prefix.
 */
export type DiagramBlock = PeleBlock | SlidevBlock;

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

/** Every setting under `pele` in the deck's headmatter. */
export const DECK_SETTINGS = ["theme", "mermaid"] as const;
const KNOWN_SETTINGS = new Set<string>(DECK_SETTINGS);

/** Options that only mean something for a block's steps. */
const STEP_OPTIONS = ["reveal", "at"] as const;

const checkOptions = (
  values: Record<string, unknown>,
  fence: Fence
): string[] => {
  const warnings = Object.keys(values)
    .filter((key) => !KNOWN_OPTIONS.has(key))
    .map(
      (key) =>
        `[pele] Pele ignores the option ${key}: its options are ${BLOCK_OPTIONS.join(", ")}. Add renderer: 'mermaid' to draw this diagram with mermaid.js.`
    );
  if (values.scale !== undefined && !isScale(values.scale)) {
    warnings.push(`[pele] ${SCALE_FIX}`);
  }
  if (fence.steps === undefined) {
    for (const key of STEP_OPTIONS.filter((option) => option in values)) {
      warnings.push(
        `[pele] ${key} does nothing on a diagram block without steps: add steps before the options, as in \`\`\`${fence.language} {a|b|*}{${key}: ${JSON.stringify(values[key]).replaceAll('"', "'")}}, or remove ${key}.`
      );
    }
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
): SlidevBlock => {
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

/** The deck's settings under `pele` in the headmatter, and what is wrong with them. */
export interface Deck {
  theme?: unknown;
  mermaid?: unknown;
  warnings: string[];
}

export const readDeck = (headmatter: Record<string, unknown> = {}): Deck => {
  const { pele } = headmatter;
  const settings =
    typeof pele === "object" && pele !== null
      ? (pele as Record<string, unknown>)
      : {};
  const warnings = Object.keys(settings)
    .filter((key) => !KNOWN_SETTINGS.has(key))
    .map(
      (key) =>
        `[pele] Unknown setting pele.${key} in the headmatter: the settings are ${DECK_SETTINGS.map((name) => `pele.${name}`).join(", ")}.`
    );
  const { mermaid, theme } = settings;
  if (mermaid !== undefined && typeof mermaid !== "boolean") {
    warnings.push(
      `[pele] pele.mermaid in the headmatter must be true or false, got ${JSON.stringify(mermaid)}: write \`pele: { mermaid: false }\` to draw \`\`\`mermaid blocks with mermaid.js.`
    );
  }
  return { mermaid, theme, warnings };
};

export const readDiagramBlock = (input: DiagramBlockInput): DiagramBlock => {
  const fence = readFence(input.fence);
  if (!DIAGRAM_LANGUAGES.has(fence.language)) {
    return { renderer: "slidev", warnings: [] };
  }
  const source = input.body.trim();
  const deck = readDeck(input.headmatter);
  const warnings: string[] = [];
  if (fence.ignored) {
    warnings.push(
      `[pele] Ignored "${fence.ignored}" in "\`\`\`${input.fence.trim()}": write steps then options, as in \`\`\`${fence.language} {a|b|*}{scale: 0.8}.`
    );
  }
  if (fence.joined) {
    warnings.push(
      `[pele] Steps and options share one pair of braces in "\`\`\`${input.fence.trim()}": give each its own, as in \`\`\`${fence.language} {${fence.steps}}${fence.options}.`
    );
  }
  warnings.push(...deck.warnings);

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

  warnings.push(...checkOptions(values, fence));
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
