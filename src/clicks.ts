// Which step or version a click shows, counted the way Slidev counts clicks
// for code blocks and magic-move. Pure: the diagram component and the Node
// tests read clicks the same way.

export interface ClickCount {
  /** The slide's current click. */
  click: number;
  /** How many steps or versions there are. */
  count: number;
  /** The click the second one lands on (Slidev's `calculateSince`), or none when the block takes no clicks. */
  start?: number;
}

/**
 * The index of the step or version shown at a click: the first before
 * `start`, then one more per click, the last one from then on. A block that
 * takes no clicks shows its last.
 */
export const indexAtClick = ({ click, count, start }: ClickCount): number => {
  const last = Math.max(0, count - 1);
  if (start === undefined) {
    return last;
  }
  return Math.min(last, Math.max(0, click - start + 1));
};

const RELATIVE = /^[+-]/u;

/**
 * The click a block's second step lands on when nothing before it on the
 * slide takes clicks, read from `at` as Slidev's `calculateSince` reads it:
 * a number is absolute, `'+n'` counts from the clicks before, `false` takes
 * no clicks.
 */
export const startAlone = (at: unknown): number | undefined => {
  if (at === false || at === "false") {
    return undefined;
  }
  if (at === undefined || at === null || at === true || at === "true") {
    return 1;
  }
  if (typeof at === "string" && RELATIVE.test(at)) {
    return Number(at);
  }
  const value = Number(at);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value <= 0 ? 1 : value;
};
