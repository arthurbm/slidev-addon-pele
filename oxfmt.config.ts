import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // Slide decks: a Prettier-style pass can break Slidev syntax.
    "showcase/**/*.md",
    // Vendored agent skills, owned by `npx skills`.
    ".agents/**",
    ".claude/**",
    "skills-lock.json",
  ],
  // Keep authored line breaks in docs (the glossary puts each part of an entry on its own line).
  proseWrap: "preserve",
});
