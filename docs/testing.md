# Testing

The project tests at two seams, agreed during design. They are the confirmed seams for `/tdd`; a new seam needs the maintainer's agreement.

## 1. Diagram block, in Node (Vitest)

The primary, fast suite. A test gives what an author writes (the fence's opening line, the Mermaid body, the deck headmatter) and checks what the slide will show: Pele or a hand-back to mermaid.js and, for Pele, the active, receding and hidden parts at each click, plus warnings and errors. Pele's `parse()` and `render()` run in Node, so rendering every diagram type is tested here too.

The entry point is `readFencedBlock` in `src/fenced-block.ts`, the same call the codeblock transformer makes (helpers in `test/blocks.ts`). It takes the fence line, body, headmatter, the fence's backtick count (4 for a ` ````md magic-move `) and where the block is, and answers with the hand-back, or with the block Pele draws: its warnings and errors as the terminal prints them, `partsAt(click)` for steps, `animatedEdges()`, and for a magic-move `versionAt(click)`, `changeAt(click)` (the `data-id`s that glide, enter and leave) and `drawnWith({ maxWidth })` (the versions as drawn at that width). Clicks are counted as if the block were alone on its slide. Tests call nothing else of the addon.

## 2. Showcase deck, in a browser (agent-browser)

A few scripted checks against the Showcase deck running in Slidev, for what Node cannot see: clicks toggling classes on the SVG, narrow widths re-laying out, dark mode, reduced motion, export. Run `agent-browser skills get core` before writing the first script.

Assert on external behaviour: classes and `data-id`s on the rendered SVG, messages shown, never component internals.

## Checks the spec asks for (Vitest)

Not seams for `/tdd`; they keep the docs and the Showcase deck honest, and run with the Node suite.

- `test/docs.test.ts`: every block option, deck setting and magic-move option the code accepts (`BLOCK_OPTIONS`, `DECK_SETTINGS`, `MAGIC_MOVE_OPTIONS`) has a section in the skill's options reference and a row in the README; the skill is named for its folder; the skill's and the README's links resolve.
- `test/tokens.test.ts`: the tokens slide's counts are what `pnpm tokens` measures today, from the diagram the tool-loop slide draws.

## Package checks (CI)

Not seams for `/tdd`; they guard what gets published.

- `pnpm test:deps` (in `pnpm check`): Pele is the only runtime dependency.
- `pnpm test:pack [npm|pnpm]`: packs the addon, installs the tarball into an empty deck outside the repo, builds it and checks in a browser that its diagram block is drawn by Pele. It also fails when a tracked file under an addon folder (`components`, `setup`, `src`, `styles`, `skills`, ...) is missing from the tarball, so a new folder must be added to `files` in `package.json`. Something that only shows in the browser (a preset, say) is not seen by the build check; extend `test/package/pack.mjs` if it must be.
