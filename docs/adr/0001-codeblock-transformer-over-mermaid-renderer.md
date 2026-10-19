# Codeblock transformer instead of the mermaid-renderer hook

Slidev offers `setup/mermaid-renderer.ts` for swapping the renderer, and it would make this addon a three-line file. We use a `setup/transformers.ts` codeblock transformer that emits our own `<PeleDiagram>` component instead, because the hook only accepts a function that returns an SVG string: the string lands in a ShadowRoot inside Slidev's `Mermaid.vue`, out of reach of `$clicks` and page CSS, so click steps are impossible; the fence options are bound with `v-bind`, so step syntax like `{user|agent|*}` fails to compile before the renderer runs; mermaid.js stays statically imported, so the bundle saving disappears; and the renderer never learns the container width or theme, so there is no responsive layout and dark mode means a re-render.

## Consequences

- We must parse the fence's opening line ourselves and keep its options in parity with Slidev's documented Mermaid options (`scale`, `theme`).
- Returning `undefined` from the transformer hands the block back to Slidev's own Mermaid path, which is how unsupported diagram types and the per-block `renderer: 'mermaid'` opt-out work.
- PDF export waits on `#mermaid-rendering-container`, not on our component, so export readiness is ours to handle.
