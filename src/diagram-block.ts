import { readFenceSteps } from "./fence-steps";
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
 */
export type DiagramBlock = PeleBlock | { renderer: "slidev" };

const DIAGRAM_LANGUAGES = new Set(["mermaid", "pele"]);
const LANGUAGE = /^[\w'-]*/u;

// Stand-in for the fence reader (ticket #3): finds a string `theme` in the
// block's options, e.g. `mermaid {theme: 'neutral', scale: 0.8}`.
const THEME_OPTION = /\btheme\s*:\s*(?<quote>['"`])(?<theme>.*?)\k<quote>/u;
const readThemeOption = (fence: string): string | undefined =>
  fence.match(THEME_OPTION)?.groups?.theme;

/** The deck settings under `pele` in the headmatter. */
const readDeckSettings = (headmatter: Record<string, unknown> = {}) => {
  const { pele } = headmatter;
  return typeof pele === "object" && pele !== null
    ? (pele as Record<string, unknown>)
    : {};
};

export const readDiagramBlock = (input: DiagramBlockInput): DiagramBlock => {
  const [language = ""] = input.fence.trim().match(LANGUAGE) ?? [];
  if (!DIAGRAM_LANGUAGES.has(language)) {
    return { renderer: "slidev" };
  }
  const { preset, warnings } = readPreset(
    readThemeOption(input.fence) ?? readDeckSettings(input.headmatter).theme
  );
  return {
    preset,
    renderer: "pele",
    source: input.body.trim(),
    warnings,
    ...readFenceSteps(input.fence),
  };
};
