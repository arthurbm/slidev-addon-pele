// Counts the bytes and tokens of one diagram written two ways, for the
// Showcase deck's tokens slide: the tool-call loop from the maintainer's Gen AI
// deck as an Excalidraw file and as Mermaid syntax. Rerun with `pnpm tokens`;
// it rewrites showcase/tokens/counts.json, which the slide reads.
//
// The Excalidraw file is the Gen AI deck's `tool-call-loop.excalidraw` with
// its labels translated to English and its free-floating note removed, so both
// files hold the same boxes, arrows and labels.
//
// Tokens are counted offline with gpt-tokenizer's o200k_base encoding (the one
// GPT-4o and later OpenAI models use). Other models' tokenizers give other
// numbers; the ratio between the two files is what the slide is about.

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { encode } from "gpt-tokenizer/encoding/o200k_base";

const folder = new URL("../showcase/tokens/", import.meta.url);
const files = {
  excalidraw: "tool-loop.excalidraw",
  mermaid: "tool-loop.mmd",
} as const;

const { version } = createRequire(import.meta.url)(
  "gpt-tokenizer/package.json"
) as { version: string };

export interface Size {
  bytes: number;
  tokens: number;
}

export const measure = (text: string): Size => ({
  bytes: Buffer.byteLength(text, "utf-8"),
  tokens: encode(text).length,
});

const measureFile = async (name: string) =>
  measure(await readFile(new URL(name, folder), "utf-8"));

export const measureShowcase = async () => ({
  excalidraw: {
    file: files.excalidraw,
    ...(await measureFile(files.excalidraw)),
  },
  mermaid: { file: files.mermaid, ...(await measureFile(files.mermaid)) },
  tokenizer: `gpt-tokenizer ${version}, o200k_base`,
});

if (import.meta.main) {
  const counts = await measureShowcase();
  await writeFile(
    new URL("counts.json", folder),
    `${JSON.stringify(counts, null, 2)}\n`
  );
  console.log(counts);
}
