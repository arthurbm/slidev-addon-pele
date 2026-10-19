// One small sample of every diagram type Pele supports. `satisfies` makes the
// type check fail when a Pele upgrade adds a type without a sample here.

import type { DiagramType } from "pele/lazy";

export const samples = {
  agentflow: `agentflow-beta TB
  check["Tests pass?"]@{ shape: decision }
  ship["Ship it"]@{ shape: action }
  check -- yes --> ship`,
  architecture: `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service server(server)[Server] in api
  db:L -- R:server`,
  block: `block-beta
  columns 3
  a["A"] b["B"] c["C"]
  a --> b`,
  c4: `C4Context
  title System Context
  Person(user, "User")
  System(app, "App")
  Rel(user, app, "Uses")`,
  class: `classDiagram
  class Animal {
    +String name
    +eat()
  }
  class Dog
  Animal <|-- Dog`,
  cynefin: `cynefin-beta
  complex
    "Probe"
  clear
    "Restart"`,
  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains`,
  eventmodeling: `eventmodeling
tf 01 ui CartUI
tf 02 cmd AddItem
tf 03 evt ItemAdded`,
  flowchart: `flowchart LR
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  agent --> tools[Tools]
  tools -->|result| agent`,
  gantt: `gantt
  title Plan
  dateFormat YYYY-MM-DD
  section Build
  Design :a1, 2024-01-01, 3d
  Code   :a2, after a1, 5d`,
  gitGraph: `gitGraph
  commit id: "init"
  branch feature
  commit id: "work"
  checkout main
  merge feature`,
  info: "info",
  ishikawa: `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
    User
        Shaky hands`,
  journey: `journey
  title My day
  section Work
    Make tea: 5: Me
    Do work: 1: Me, Cat`,
  kanban: `kanban
  todo[Todo]
    t1[Write spec]
  done[Done]
    t2[Ship]`,
  mindmap: `mindmap
  root((Pele))
    Render
      SVG
    Themes`,
  packet: `packet-beta
  0-15: "Source Port"
  16-31: "Destination Port"`,
  pie: `pie title Pets
  "Dogs" : 386
  "Cats" : 85`,
  quadrantChart: `quadrantChart
  title Reach
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Re-evaluate
  quadrant-4 Improve
  Campaign A: [0.3, 0.6]
  Campaign B: [0.7, 0.2]`,
  radar: `radar-beta
  axis a["A"], b["B"], c["C"]
  curve x["X"]{1, 2, 3}
  curve y["Y"]{3, 2, 1}`,
  railroad: `railroad-ebnf-beta
letter = "a" | "b" ;
word = letter , { letter } ;`,
  requirement: `requirementDiagram
  requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
  }
  element test_entity {
    type: simulation
  }
  test_entity - satisfies -> test_req`,
  sankey: `sankey-beta
A,B,10
A,C,5
B,D,7`,
  sequence: `sequenceDiagram
  participant U as User
  participant A as Agent
  U->>A: Ask
  Note over U,A: thinking
  A-->>U: Answer
  A->>A: Log`,
  state: `stateDiagram-v2
  [*] --> Idle
  Idle --> Busy : start
  Busy --> Idle : done
  Busy --> [*]`,
  swimlane: `swimlane-beta LR
  subgraph Buyer
    choose[Choose]
    pay[Pay]
  end
  subgraph Store
    ship[Ship]
  end
  choose --> ship
  ship --> pay`,
  timeline: `timeline
  title History
  2002 : LinkedIn
  2004 : Facebook`,
  treeView: `treeView-beta
    src/
        index.js
    package.json`,
  treemap: `treemap-beta
"Root"
    "A": 20
    "B": 10`,
  usecase: `usecase-beta
actor Customer
Reset("Reset password")
Customer --> Reset`,
  venn: `venn-beta
  set A["Alpha"]:20
  set B["Beta"]:12
  union A,B["AB"]:3`,
  wardley: `wardley-beta
title Tea
anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Water [0.38, 0.82]
Business->Cup of Tea
Cup of Tea->Water`,
  xychart: `xychart-beta
  title "Sales"
  x-axis [jan, feb, mar]
  y-axis "Revenue" 0 --> 100
  bar "Orders" [10, 50, 80]
  line "Trend" [10, 50, 80]`,
} satisfies Record<DiagramType, string>;
