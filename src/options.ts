// A fence's options are a JavaScript object expression that Vue evaluates in
// the slide (Slidev binds them with `v-bind`). The transformer runs in Node
// and needs some of them (`renderer`) before that, so it reads the ones that
// are plain literals. Anything else (a variable, a call) is left to Vue.

export type FenceOptions =
  | { kind: "literal"; values: Record<string, unknown> }
  | { kind: "expression" };

type Literal =
  | string
  | number
  | boolean
  | null
  | undefined
  | Literal[]
  | { [key: string]: Literal };

class NotLiteralError extends Error {
  override name = "NotLiteralError";
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iu;
const IDENTIFIER = /^[$A-Z_a-z][\w$]*/u;
const KEYWORDS: Record<string, Literal> = {
  false: false,
  null: null,
  true: true,
  undefined,
};
const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t" };

const parse = (text: string): Literal => {
  let position = 0;

  const skipSpace = () => {
    while (/\s/u.test(text[position] ?? "")) {
      position += 1;
    }
  };
  const peek = () => {
    skipSpace();
    return text[position];
  };
  const expect = (char: string) => {
    if (peek() !== char) {
      throw new NotLiteralError();
    }
    position += 1;
  };

  const readString = (): string => {
    const quote = text[position];
    position += 1;
    let value = "";
    while (position < text.length && text[position] !== quote) {
      let char = text[position] ?? "";
      if (quote === "`" && char === "$" && text[position + 1] === "{") {
        throw new NotLiteralError();
      }
      if (char === "\\") {
        position += 1;
        const escaped = text[position] ?? "";
        char = ESCAPES[escaped] ?? escaped;
      }
      value += char;
      position += 1;
    }
    expect(quote ?? "");
    return value;
  };

  const readWord = (pattern: RegExp): string => {
    const [word] = text.slice(position).match(pattern) ?? [];
    if (word === undefined) {
      throw new NotLiteralError();
    }
    position += word.length;
    return word;
  };

  const readKey = (): string => {
    const char = peek();
    if (char === "'" || char === '"' || char === "`") {
      return readString();
    }
    return readWord(IDENTIFIER);
  };

  const readList = <Item>(close: string, readItem: () => Item): Item[] => {
    const items: Item[] = [];
    position += 1;
    while (peek() !== close) {
      items.push(readItem());
      if (peek() !== ",") {
        break;
      }
      position += 1;
    }
    expect(close);
    return items;
  };

  const value = (): Literal => {
    const char = peek();
    if (char === "{") {
      return Object.fromEntries(
        readList("}", () => {
          const key = readKey();
          expect(":");
          return [key, value()];
        })
      );
    }
    if (char === "[") {
      return readList("]", value);
    }
    if (char === "'" || char === '"' || char === "`") {
      return readString();
    }
    if (char && /[\d.+-]/u.test(char)) {
      return Number(readWord(NUMBER));
    }
    const word = readWord(IDENTIFIER);
    if (!Object.hasOwn(KEYWORDS, word)) {
      throw new NotLiteralError();
    }
    return KEYWORDS[word];
  };

  const result = value();
  if (peek() !== undefined) {
    throw new NotLiteralError();
  }
  return result;
};

/** Reads `{…}` from a fence; `undefined` text means the fence has no options. */
export const readOptions = (text: string | undefined): FenceOptions => {
  if (text === undefined) {
    return { kind: "literal", values: {} };
  }
  try {
    const values = parse(text);
    if (values && typeof values === "object" && !Array.isArray(values)) {
      return { kind: "literal", values };
    }
  } catch (error) {
    if (!(error instanceof NotLiteralError)) {
      throw error;
    }
  }
  return { kind: "expression" };
};
