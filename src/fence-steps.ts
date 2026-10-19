// The minimum of the fence reader that steps need: the `{steps}` and
// `{options}` parts after the language, as in Slidev's code blocks
// (` ```ts {1|2-3}{at:1} `). The fence reader of the parity work (ticket #3)
// supersedes this.

/** The steps and options written in a fence's opening line. */
export interface FenceSteps {
  /** One entry per step, split on `|` and trimmed, e.g. `["user", "agent,llm", "*"]`. */
  steps?: string[];
  /** The options object as written, a JavaScript expression, e.g. `{reveal: true}`. */
  options?: string;
}

// Slidev's code-block grammar: steps are made of `[\w,|\-*]` only, so a lone
// `{scale: 0.8}` is options, not steps.
const FENCE =
  /^[\w'-]*[ \t]*(?:\{(?<steps>[\w,|\-* \t]+)\})?[ \t]*(?<options>\{.*\})?/u;

export const readFenceSteps = (fence: string): FenceSteps => {
  const groups = fence.trim().match(FENCE)?.groups ?? {};
  const result: FenceSteps = {};
  if (groups.steps !== undefined) {
    result.steps = groups.steps
      .trim()
      .split("|")
      .map((step) => step.trim());
  }
  if (groups.options !== undefined) {
    result.options = groups.options;
  }
  return result;
};
