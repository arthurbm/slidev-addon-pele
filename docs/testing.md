# Testing

The project tests at two seams, agreed during design. They are the confirmed seams for `/tdd`; a new seam needs the maintainer's agreement.

## 1. Diagram block, in Node (Vitest)

The primary, fast suite. A test gives what an author writes (the fence's opening line, the Mermaid body, the deck headmatter) and checks what the slide will show: Pele or a hand-back to mermaid.js and, for Pele, the active, receding and hidden parts at each click, plus warnings and errors. Pele's `parse()` and `render()` run in Node, so rendering every diagram type is tested here too.

## 2. Showcase deck, in a browser (agent-browser)

A few scripted checks against the Showcase deck running in Slidev, for what Node cannot see: clicks toggling classes on the SVG, narrow widths re-laying out, dark mode, reduced motion, export. Run `agent-browser skills get core` before writing the first script.

Assert on external behaviour: classes and `data-id`s on the rendered SVG, messages shown, never component internals.

## Package checks (CI)

Not seams for `/tdd`; they guard what gets published.

- `pnpm test:deps` (in `pnpm check`): Pele is the only runtime dependency.
- `pnpm test:pack [npm|pnpm]`: packs the addon, installs the tarball into an empty deck outside the repo, builds it and checks in a browser that its diagram block is drawn by Pele. It also fails when a tracked file under an addon folder (`components`, `setup`, `src`, `styles`, `skills`, ...) is missing from the tarball, so a new folder must be added to `files` in `package.json`. Something that only shows in the browser (a preset, say) is not seen by the build check; extend `test/package/pack.mjs` if it must be.
