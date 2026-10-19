// What to tell the presenter when Pele cannot draw a diagram block in the
// browser, naming the fix after Pele's own message.

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Pele's `PeleError.code`.
const FIXES: Record<string, string> = {
  limit: "Make the diagram smaller, or split it across slides.",
  semantic: "Fix the diagram's Mermaid syntax.",
  syntax: "Fix the Mermaid syntax there.",
  "unsupported-diagram":
    "Start the block with a diagram type Pele draws (flowchart LR, sequenceDiagram, classDiagram, …), or add {renderer: 'mermaid'} to the fence to draw it with mermaid.js.",
};

/** Pele drew nothing for the block's text. */
export const describeDrawError = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const fix = FIXES[code] ?? "Fix the diagram's Mermaid syntax.";
  return `${messageOf(error)}\n${fix}`;
};

/** The code that draws the block's diagram type did not load. */
export const describeLoadError = (error: unknown): string =>
  `Pele's code for this diagram type did not load (${messageOf(error)}). Reload the page; if it still fails, restart the dev server, or build the deck again.`;
