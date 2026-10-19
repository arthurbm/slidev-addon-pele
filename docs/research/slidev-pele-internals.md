# Slidev and Pele internals the addon relies on

Facts read from source, pinned to **Slidev v53.0.0** (`slidevjs/slidev@73053ab`) and **Pele 1.6.0** (`obsidianmd/pele@44da152`). Re-check the cited line when either version changes.

## Slidev

**Codeblock transformers.** Each fence goes through a list of transformers; the first to return a non-null string wins. Transformers from `setup/transformers.ts` (`codeblocks`) run before the built-in Mermaid one, so returning `undefined` hands the block back to mermaid.js. `packages/slidev/node/syntax/codeblock/index.ts:33-45`. Context type (`info`, `code`, `fence`, `slide`, `options`, `renderHighlighted`): `packages/types/src/transform.ts:25`. Deck headmatter is `options.data.headmatter`: `packages/types/src/types.ts:121`. Available since v52.15.0.

**Built-in Mermaid fence.** `/^mermaid\s*(\{[^\n]*\})?/`, the braces passed verbatim as `v-bind="{…}"`, so fence options are a JavaScript object expression: `packages/slidev/node/syntax/codeblock/mermaid.ts:4-11`. Step syntax like `{a|b}` there would fail Vue compilation.

**`scale` semantics.** Height = viewBox height × scale; width and inline style removed: `packages/client/builtin/Mermaid.vue:72`.

**Click registration (the model for steps).** Code blocks register `ranges.length - 1` clicks starting at `at`, and the active range index is `max(0, current - start + 1)`, so the first range is active before any click: `packages/client/builtin/CodeBlockWrapper.vue:72-75`. Use `useSlideContext().$clicksContext`; unregister on unmount.

**Public client API.** `useDarkMode`, `useSlideContext` and friends are exported from `@slidev/client`: `packages/client/index.ts:7,11`. Other client files are internal and may break.

**Export waiting.** The exporter waits, per slide, for every `[data-waitfor]` element to contain a visible match of the attribute's selector: `packages/slidev/node/commands/export.ts:272-285`. It also waits for `#mermaid-rendering-container` to empty (line 294), which only mermaid.js uses.

**Addon name resolution.** `addons: [pele]` tries `@slidev/addon-pele`, then `slidev-addon-pele`, and offers to install the latter: `packages/slidev/node/resolver.ts:353-366`. A scoped package name would lose the short form.

## Pele

**Lazy entry.** `pele/lazy` re-exports core plus `load(type)` and `renderAsync(text, options)`, which dynamic-import only the needed diagram type: `src/lazy.ts:47,70`. `detectType`, `parse`, `render` and `register` come from core.

**Render options that matter here.** `maxWidth` (the width available), `autoDirection` (left-to-right turns top-to-bottom under `directionBreakpoint`, default 640px), `fontFamily`/`fontFamilyMono`: `src/types.ts:11-21`.

**Text measurement.** In a browser, a canvas measurer for the given font; without a canvas, a table of Arial widths: `src/text/measurer.ts:45,137`. Widths measured before web fonts load are wrong; Pele's own `mount()` waits on `document.fonts.ready` then calls `forgetTextWidths()` and redraws: `src/mount.ts:77`. It reads `--pele-font` from CSS, falling back to the element's font family: `src/mount.ts:58`.

**`data-id` formats.**

- Flowchart edges: explicit id (`e1@-->`) or `L_<start>_<end>_<n>`: `src/diagrams/flowchart/graph.ts:249`.
- Sequence: participants carry their id; messages, notes and their labels carry `i<item id>`, where the item id counts notes too, so "message n" must be resolved through the parsed model, not by formatting `i<n>`: `src/diagrams/sequence/render.ts:638,748`.
- Edge labels and cluster titles carry the owner's id: `src/svg/edges.ts:222`, `src/svg/cluster.ts:67`.

**Animated edges.** Flowchart parses `animate` into the edge model (`src/diagrams/flowchart/db.ts:159`, `graph.ts:264`) but the renderer only draws static dashes. The addon animates them with CSS.

**SVG shape.** No `<style>` and no `<defs>`; all theming through `--pele-*` CSS variables (`--pele-bg`, `--pele-fg`, `--pele-muted`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, `--pele-critical`, `--pele-error`, `--pele-font`, `--pele-font-mono`, `--pele-radius`, `--pele-series-1..8`).
