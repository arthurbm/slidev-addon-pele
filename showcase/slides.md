---
title: slidev-addon-pele
addons:
  - slidev-addon-pele
fonts:
  sans: Inter
---

# Mermaid syntax. Pele rendering. Slidev clicks.

---

# A ` ```mermaid ` block, drawn by Pele

```mermaid
flowchart LR
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  agent --> tools[Tools]
  tools --> agent
```

---

# A ` ```pele ` block in a narrow column

<div class="grid grid-cols-[1fr_320px] gap-8">
<div>

The same left-to-right flowchart turns top-to-bottom when its column is too narrow.

</div>
<div>

```pele
flowchart LR
  question[Question] --> retrieve[Retrieve documents]
  retrieve --> rerank[Rerank]
  rerank --> answer[Answer]
```

</div>
</div>

---
layout: two-cols-header
---

# Same source, two renderers

::left::

mermaid.js

```mermaid {renderer: 'mermaid', scale: 0.8}
flowchart TB
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  llm --> agent
  agent --> tools[Tools]
  tools --> agent
  agent --> answer[Answer]
```

::right::

Pele

```mermaid {scale: 0.8}
flowchart TB
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  llm --> agent
  agent --> tools[Tools]
  tools --> agent
  agent --> answer[Answer]
```
