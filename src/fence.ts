/**
 * A fence's opening line, read with the grammar of Slidev's code blocks:
 * ```` ```mermaid {steps}{options} ````, either part optional.
 */
export interface Fence {
  language: string;
  /** The steps as written between the braces, e.g. `user|agent,llm|*`. */
  steps?: string;
  /** The options with their braces: a JavaScript object expression. */
  options?: string;
  /** Text after the braces that the grammar has no place for. */
  ignored?: string;
  /** Steps and options written in one pair of braces, e.g. `{a|b, reveal: true}`, read as if they were in two. */
  joined?: string;
}

const LANGUAGE = /^[\w'-]*/u;
// The characters Slidev allows in a code block's line ranges, plus spaces.
const STEPS = /^\{(?<steps>[\s\w,|*-]*[\w*][\s\w,|*-]*)\}$/u;
const QUOTES = new Set(["'", '"', "`"]);
// Steps, a comma, then the options' first key: `{a|b, reveal: true}`.
const JOINED =
  /^\{(?<steps>[\s\w,|*-]*?)\s*,\s*(?<options>[$A-Z_a-z][\w$]*\s*:[\s\S]*)\}$/u;
// What steps hold and a JavaScript object cannot: `a|b`, `*`, `2-3`, `1`.
const NOT_JAVASCRIPT = /[|*-]|(?:^|,)\s*\d/u;

/** Steps and options in one pair of braces, split as the author meant them. */
const splitJoined = (group: string) => {
  const { steps = "", options = "" } = group.match(JOINED)?.groups ?? {};
  if (!STEPS.test(`{${steps}}`) || !NOT_JAVASCRIPT.test(steps)) {
    return;
  }
  return { options: `{${options}}`, steps: steps.trim() };
};

/** Reads `{…}` at the start of `text`, skipping braces inside strings. */
const readGroup = (text: string): string | undefined => {
  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char && QUOTES.has(char)) {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, index + 1);
      }
    }
  }
  return undefined;
};

const withIgnored = (fence: Fence, rest: string): Fence =>
  rest ? { ...fence, ignored: rest } : fence;

export const readFence = (info: string): Fence => {
  const line = info.trim();
  const [language = ""] = line.match(LANGUAGE) ?? [];
  let rest = line.slice(language.length).trim();
  const fence: Fence = { language };

  const first = rest.startsWith("{") ? readGroup(rest) : undefined;
  if (!first) {
    return withIgnored(fence, rest);
  }
  rest = rest.slice(first.length).trim();

  const steps = first.match(STEPS)?.groups?.steps;
  const joined = steps === undefined ? splitJoined(first) : undefined;
  if (joined) {
    // Vue cannot compile `{a|b, …}` as an object, so it is split here.
    return withIgnored({ ...fence, ...joined, joined: first }, rest);
  }
  if (steps === undefined) {
    // A lone `{…}` that is not steps is options, so `{scale: 0.8}` keeps
    // the meaning Slidev gives it.
    return withIgnored({ ...fence, options: first }, rest);
  }
  fence.steps = steps.trim();

  const second = rest.startsWith("{") ? readGroup(rest) : undefined;
  if (!second) {
    return withIgnored(fence, rest);
  }
  return withIgnored(
    { ...fence, options: second },
    rest.slice(second.length).trim()
  );
};
