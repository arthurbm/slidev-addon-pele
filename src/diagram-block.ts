import { readFenceSteps } from "./fence-steps";

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
  /** The block's steps, one entry per step, e.g. `["user", "agent,llm", "*"]`. */
  steps?: string[];
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

export const readDiagramBlock = (input: DiagramBlockInput): DiagramBlock => {
  const [language = ""] = input.fence.trim().match(LANGUAGE) ?? [];
  if (!DIAGRAM_LANGUAGES.has(language)) {
    return { renderer: "slidev" };
  }
  return {
    renderer: "pele",
    source: input.body.trim(),
    ...readFenceSteps(input.fence),
  };
};
