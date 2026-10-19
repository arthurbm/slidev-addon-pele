import { render } from "pele/lazy";
import type { RenderOptions } from "pele/lazy";

// The versions of a magic-move diagram: what happens to each part when the
// diagram moves from one to the next, and which way they all run. Parts are
// matched by Pele's `data-id`, which names the same node, edge or subgraph in
// every version.

/** The parts of two versions, by `data-id`, in drawing order. */
export interface VersionChange {
  /** In both versions: they move and resize to their new place. */
  glide: string[];
  /** Only in the new version: they fade in. */
  enter: string[];
  /** Only in the old version: they fade out. */
  leave: string[];
}

export const changeBetween = (
  before: Iterable<string>,
  after: Iterable<string>
): VersionChange => {
  const old = new Set(before);
  const next = new Set(after);
  return {
    enter: [...next].filter((id) => !old.has(id)),
    glide: [...next].filter((id) => old.has(id)),
    leave: [...old].filter((id) => !next.has(id)),
  };
};

/** How the versions are drawn: the width they may take and the font. */
export type DrawOptions = Pick<RenderOptions, "maxWidth" | "fontFamily">;

// A flowchart's header, when it runs across.
const ACROSS =
  /^(?<header>[ \t]*(?:flowchart|graph)(?:-elk)?[ \t]+)(?:LR|RL)\b/mu;

/** Whether Pele would turn this version top-to-bottom to fit the width. */
const turnsTopToBottom = (source: string, options: DrawOptions): boolean => {
  try {
    return (
      render(source, options).width !==
      render(source, { ...options, autoDirection: false }).width
    );
  } catch {
    // A version that cannot be drawn shows its own error.
    return false;
  }
};

/**
 * The versions as they are drawn (with Pele's `autoDirection` off), all in
 * one direction: when one flowchart version would turn top-to-bottom to fit
 * the width, they all run top-to-bottom, so no version flips on its own and
 * sends every node across the slide. Other types stay as written, and the
 * slide shrinks them to fit. The diagram types must be loaded.
 */
export const inOneDirection = (
  versions: string[],
  options: DrawOptions
): string[] => {
  if (!versions.some((source) => turnsTopToBottom(source, options))) {
    return versions;
  }
  if (!versions.every((source) => ACROSS.test(source))) {
    return versions;
  }
  return versions.map((source) => source.replace(ACROSS, "$<header>TB"));
};
