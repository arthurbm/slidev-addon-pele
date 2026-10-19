import { render } from "pele/lazy";

// The versions of a magic-move diagram: which one a click shows, and what
// happens to each part when the diagram moves from one to the next. Parts are
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

const DATA_ID = /\bdata-id="(?<id>[^"]*)"/gu;
const ENTITIES: Record<string, string> = {
  "&#39;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};
const ENTITY = /&(?:amp|lt|gt|quot|#39);/gu;

/** The distinct `data-id`s in a drawing's SVG markup, decoded. */
export const dataIds = (svg: string): string[] => [
  ...new Set(
    [...svg.matchAll(DATA_ID)].map(({ groups }) =>
      (groups?.id ?? "").replaceAll(ENTITY, (entity) => ENTITIES[entity] ?? "")
    )
  ),
];

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

/** What the versions are drawn for: the room they have and the font. */
export interface VersionRoom {
  maxWidth?: number;
  fontFamily?: string;
}

// A flowchart's header, when it runs across.
const ACROSS =
  /^(?<header>[ \t]*(?:flowchart|graph)(?:-elk)?[ \t]+)(?:LR|RL)\b/mu;

/** Whether Pele would turn this version top-to-bottom to fit the room. */
const turns = (source: string, room: VersionRoom): boolean => {
  try {
    return (
      render(source, room).width !==
      render(source, { ...room, autoDirection: false }).width
    );
  } catch {
    // A version that cannot be drawn shows its own error.
    return false;
  }
};

/**
 * The versions as they are drawn (with Pele's `autoDirection` off), all in
 * one direction: when one flowchart version would turn top-to-bottom to fit
 * the room, they all run top-to-bottom, so no version flips on its own and
 * sends every node across the slide. Other types stay as written, and the
 * slide shrinks them to fit. The diagram types must be loaded.
 */
export const inOneDirection = (
  versions: string[],
  room: VersionRoom
): string[] => {
  if (!versions.some((source) => turns(source, room))) {
    return versions;
  }
  if (!versions.every((source) => ACROSS.test(source))) {
    return versions;
  }
  return versions.map((source) => source.replace(ACROSS, "$<header>TB"));
};

export interface VersionClick {
  /** The slide's current click. */
  click: number;
  /** How many versions there are. */
  count: number;
  /** The click the second version lands on (Slidev's `calculateSince`), or none when the diagram takes no clicks. */
  start?: number;
}

/**
 * The index of the version shown at a click, counted like Slidev's
 * magic-move: the first version before `start`, then one more per click, the
 * last one from then on.
 */
export const versionAt = ({ click, count, start }: VersionClick): number => {
  const last = Math.max(0, count - 1);
  if (start === undefined) {
    return last;
  }
  return Math.min(last, Math.max(0, click - start + 1));
};
