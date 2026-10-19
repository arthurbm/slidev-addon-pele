# Options

A diagram block's options go in the braces after its steps (or alone): ` ```mermaid {a|b}{reveal: true, scale: 0.8} `. As in Slidev, the braces are a JavaScript object; write literal values, since the addon checks only those (a `theme` computed in the slide is not read, so the deck's applies). Any other key gives a `[pele]` warning listing these.

## `scale`

A number greater than 0. The diagram's height is its natural height times `scale`, as in Slidev's Mermaid blocks; it never grows wider than its column. Without it, the diagram draws at its natural size, shrunk to fit the column.

## `theme`

The preset for this block, overriding the deck's `pele.theme`: `'auto'` (the default) or `'flexoki'`, or one of Mermaid's theme names, mapped to a preset:

| `theme`               | draws with                                        |
| --------------------- | ------------------------------------------------- |
| `'default'`, `'base'` | `auto`                                            |
| `'neutral'`           | `auto` in greys                                   |
| `'dark'`              | `auto` forced dark, whatever Slidev's colour mode |
| `'forest'`            | `auto`, with a warning: Pele has no forest preset |

See [theming.md](theming.md) for what each preset looks like and how to restyle it.

## `reveal`

`true` switches the block's steps to reveal mode: parts stay hidden until their step arrives. Without it, steps use focus mode. It has no effect on a block without steps.

## `renderer`

`'mermaid'` hands one ` ```mermaid ` block to mermaid.js. `'pele'` draws a ` ```mermaid ` block with Pele even when the deck sets `pele: { mermaid: false }`. A ` ```pele ` block always draws with Pele and only warns on `renderer: 'mermaid'`. A handed-back block cannot step: its steps are dropped with a warning.

## `at`

The click the block's second step lands on, exactly as `at` on Slidev's code blocks. A number is absolute (`{at: 1}`: step 2 at click 1); a string with a sign is relative to what comes before on the slide (`'+2'`); the default is `'+1'`. Give a code block and a diagram the same `{at: 1}` to step them together.

# Deck settings

Under `pele` in the deck's headmatter (the first slide's frontmatter):

````yaml
---
addons:
  - pele
pele:
  theme: flexoki # preset for every diagram block; any `theme` value above
  mermaid: false # draw ```mermaid blocks with mermaid.js; ```pele blocks still use Pele
---
````

A block's own `theme` wins over `pele.theme`.
