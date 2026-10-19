import { describe, expect, it } from "vitest";

import { diagram, walk } from "./blocks";

// Pele draws the transitions as edge0, edge1… in source order.
const machine = `stateDiagram-v2
  [*] --> Idle
  Idle --> Busy : start
  Busy --> Idle : done
  Busy --> [*]
`;

const pets = `pie title Pets
  "Dogs" : 386
  "Cats" : 85
  "Birds" : 15
`;

// Columns are drawn around their cards.
const board = `kanban
  todo[Todo]
    t1[Write spec]
    t2[Review]
  done[Done]
    t3[Ship]
`;

describe("steps on other diagram types, by data-id", () => {
  it("steps through a state diagram by state and transition ids", async () => {
    const [idle, busy, everything] = await walk(
      "mermaid {Idle|Busy,edge1|*}",
      machine
    );

    expect(idle?.active).toStrictEqual(["Idle"]);
    expect(idle?.receding).toStrictEqual(
      expect.arrayContaining(["Busy", "edge0", "edge1", "root_start"])
    );
    expect(busy?.active).toStrictEqual(["edge1", "Busy"]);
    expect(everything?.receding).toStrictEqual([]);
  });

  it("steps through a pie chart by slice label", async () => {
    const [dogs, cats] = await walk("mermaid {Dogs|Cats,Birds}", pets);

    expect(dogs?.active).toStrictEqual(["Dogs"]);
    expect(dogs?.receding).toStrictEqual(["Cats", "Birds"]);
    expect(cats?.active).toStrictEqual(["Cats", "Birds"]);
  });

  it("reveals a pie chart slice by slice", async () => {
    const [dogs, cats] = await walk("mermaid {Dogs|Cats}{reveal: true}", pets);

    expect(dogs?.hidden).toStrictEqual(["Cats", "Birds"]);
    expect(cats?.hidden).toStrictEqual(["Birds"]);
  });

  it("lists the diagram's ids for an unknown one", async () => {
    const block = await diagram("mermaid {Idle|Bussy}", machine);

    expect(block.errors).toStrictEqual([
      '[pele] Unknown step id "Bussy". Use the ids of the diagram: edge0, edge1, edge2, edge3, root_start, Idle, Busy, root_end.',
    ]);
  });

  it("lists ids as Pele wrote them, with quotes and ampersands", async () => {
    const block = await diagram(
      "mermaid {Dogs}",
      `pie\n  "Cats & 'Dogs'" : 3\n  "<b>" : 1\n`
    );

    expect(block.errors).toStrictEqual([
      "[pele] Unknown step id \"Dogs\". Use the ids of the diagram: Cats & 'Dogs', <b>.",
    ]);
  });
});

describe("agentflow diagrams", () => {
  it("step like flowcharts: an edge is active once both of its ends are", async () => {
    const [check, both] = await walk(
      "mermaid {check|check,ship}",
      `agentflow-beta TB
  check["Tests pass?"]@{ shape: decision }
  ship["Ship it"]@{ shape: action }
  check -- yes --> ship`
    );

    expect(check?.receding).toStrictEqual(["ship", "L_check_ship_0"]);
    expect(both?.active).toStrictEqual(["check", "ship", "L_check_ship_0"]);
  });
});

describe("parts drawn inside other parts", () => {
  it("names a part's contents with it", async () => {
    const [todo] = await walk("mermaid {todo|t3}", board);

    expect(todo?.active).toStrictEqual(["todo", "t1", "t2"]);
    expect(todo?.receding).toStrictEqual(["done", "t3"]);
  });

  it("keeps a part in view while one of its contents is active", async () => {
    const [spec, ship] = await walk("mermaid {t1|t3}{reveal: true}", board);

    expect(spec?.active).toStrictEqual(["todo", "t1"]);
    expect(spec?.hidden).toStrictEqual(["t2", "done", "t3"]);
    expect(ship?.active).toStrictEqual(["todo", "t1", "done", "t3"]);
  });
});

describe("diagram types without ids", () => {
  it("says steps are not available for that type, by name", async () => {
    const block = await diagram("mermaid {a|*}", "info");

    expect(block.errors).toStrictEqual([
      "[pele] Steps are not available for info diagrams: Pele gives their parts no ids. Remove the {…} steps from the fence.",
    ]);
  });

  it("asks for series titles in an xychart without them", async () => {
    const block = await diagram(
      "mermaid {a|*}",
      "xychart-beta\n  x-axis [jan, feb]\n  bar [10, 50]\n  line [10, 50]"
    );

    expect(block.errors).toStrictEqual([
      '[pele] Steps are not available for xychart diagrams whose series have no title. Give each series a title (bar "Sales" [10, 50]) and use the titles as step ids, or remove the {…} steps from the fence.',
    ]);
  });
});
