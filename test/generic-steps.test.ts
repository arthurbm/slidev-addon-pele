import { detectType, load } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";
import { describeStepError, partsAt, planSteps } from "../src/step-plan";
import type { PartStates, StepMode } from "../src/step-plan";

const plan = async (fence: string, body: string, mode: StepMode = "focus") => {
  const block = readDiagramBlock({ body, fence });
  if (block.renderer !== "pele" || !block.steps) {
    throw new Error(`no steps in "${fence}"`);
  }
  // Pele parses only the diagram types loaded, as in a deck.
  await load(detectType(block.source));
  return planSteps({ mode, source: block.source, steps: block.steps });
};

/** The state of every part at each step, as the audience sees it. */
const walk = async (
  fence: string,
  body: string,
  mode: StepMode = "focus"
): Promise<PartStates[]> => {
  const steps = await plan(fence, body, mode);
  if (steps.kind !== "plan") {
    throw new Error(describeStepError(steps));
  }
  return Array.from({ length: steps.stepCount }, (_, index) =>
    partsAt(steps, index)
  );
};

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
    const [dogs, cats] = await walk("mermaid {Dogs|Cats}", pets, "reveal");

    expect(dogs?.hidden).toStrictEqual(["Cats", "Birds"]);
    expect(cats?.hidden).toStrictEqual(["Birds"]);
  });

  it("lists the diagram's ids for an unknown one", async () => {
    const steps = await plan("mermaid {Idle|Bussy}", machine);

    expect(steps).toStrictEqual({
      kind: "unknown-ids",
      known: [
        "edge0",
        "edge1",
        "edge2",
        "edge3",
        "root_start",
        "Idle",
        "Busy",
        "root_end",
      ],
      unknown: ["Bussy"],
    });
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
    const [spec, ship] = await walk("mermaid {t1|t3}", board, "reveal");

    expect(spec?.active).toStrictEqual(["todo", "t1"]);
    expect(spec?.hidden).toStrictEqual(["t2", "done", "t3"]);
    expect(ship?.active).toStrictEqual(["todo", "t1", "done", "t3"]);
  });
});

describe("diagram types without ids", () => {
  it("says steps are not available for that type, by name", async () => {
    const steps = await plan("mermaid {a|*}", "info");

    expect(steps).toStrictEqual({ kind: "no-steps", type: "info" });
    if (steps.kind !== "no-steps") {
      return;
    }
    expect(describeStepError(steps)).toBe(
      "Steps are not available for info diagrams: Pele gives their parts no ids. Remove the {…} steps from the fence."
    );
  });

  it("asks for series titles in an xychart without them", async () => {
    const steps = await plan(
      "mermaid {a|*}",
      "xychart-beta\n  x-axis [jan, feb]\n  bar [10, 50]\n  line [10, 50]"
    );

    expect(steps).toStrictEqual({ kind: "no-steps", type: "xychart" });
    if (steps.kind !== "no-steps") {
      return;
    }
    expect(describeStepError(steps)).toBe(
      'Steps are not available for xychart diagrams whose series have no title. Give each series a title (bar "Sales" [10, 50]) and use the titles as step ids, or remove the {…} steps from the fence.'
    );
  });
});
