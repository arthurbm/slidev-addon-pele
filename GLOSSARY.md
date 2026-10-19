# slidev-addon-pele

A Slidev addon that renders diagrams written in Mermaid syntax with Pele instead of mermaid.js, and lets slides reveal or highlight parts of a diagram click by click.

## Language

**Mermaid syntax**:
The text language used to describe a diagram (`flowchart LR`, `sequenceDiagram`, …), independent of which program draws it.
_Avoid_: Mermaid (when the language is meant)

**mermaid.js**:
The original renderer of Mermaid syntax, and the one Slidev ships by default.
_Avoid_: Mermaid (when the renderer is meant)

**Pele**:
The renderer from Obsidian that draws Mermaid syntax as self-contained, themeable SVG.
_Avoid_: Pele syntax, Pele diagram language

**Diagram block**:
A fenced block inside a slide whose body is Mermaid syntax and which this addon turns into a rendered diagram.
_Avoid_: Mermaid block, chart, figure

**Preset**:
A named set of colours and fonts for diagrams, chosen per deck or per diagram block; `auto` follows the Slidev theme.
_Avoid_: Theme (that is the Slidev or Mermaid theme), skin, palette

**Showcase deck**:
The single narrative deck shipped with the repo that demonstrates the addon and doubles as the storyboard for the launch thread.
_Avoid_: Demo, example, playground

### Click steps

**Step**:
One stage of a diagram block's click sequence, naming the nodes or edges that become active at that click.
_Avoid_: Frame, stage, phase

**Focus mode**:
The default behavior of steps: the whole diagram is visible from the start and each step emphasizes its parts while the rest recedes.
_Avoid_: Highlight mode, dim mode

**Reveal mode**:
The behavior where parts of the diagram stay hidden until their step arrives, so the diagram builds up click by click.
_Avoid_: Build mode, progressive mode

**Version**:
One diagram block inside a ` ````md magic-move ` fence; each click moves the diagram to the next version, its parts gliding from where they were to where they are now.
_Avoid_: Step (a step is inside one diagram), frame, stage, slide
