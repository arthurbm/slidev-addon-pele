import { load } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";
import { describeStepError, partsAt, planSteps } from "../src/step-plan";
import type { PartStates, StepMode } from "../src/step-plan";

// The tool-call loop from the Showcase deck.
const loop = `flowchart LR
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  llm --> agent
  agent --> tools[Tools]
  tools --> agent
`;

// Pele parses only the diagram types loaded, as in a deck.
await load("flowchart");

describe("steps in the fence", () => {
  it("reads the steps of a diagram block like code line highlighting", () => {
    const block = readDiagramBlock({
      body: loop,
      fence: "mermaid {user|agent,llm|tools|*}",
    });

    expect(block).toMatchObject({
      renderer: "pele",
      steps: "user|agent,llm|tools|*",
    });
  });

  it("reads steps followed by options", () => {
    const block = readDiagramBlock({
      body: loop,
      fence: "mermaid {user | agent}{reveal: true, at: 1}",
    });

    expect(block).toMatchObject({
      options: "{reveal: true, at: 1}",
      steps: "user | agent",
    });
  });

  it("keeps a lone options object as options, not steps", () => {
    const block = readDiagramBlock({
      body: loop,
      fence: "mermaid {scale: 0.8}",
    });

    expect(block).toMatchObject({ options: "{scale: 0.8}" });
    expect(block).not.toHaveProperty("steps");
  });
});

/** The state of every part at each step, as the audience sees it. */
const walk = (fence: string, body: string, mode: StepMode = "focus") => {
  const block = readDiagramBlock({ body, fence });
  if (block.renderer !== "pele" || !block.steps) {
    throw new Error(`no steps in "${fence}"`);
  }
  const plan = planSteps({ mode, source: block.source, steps: block.steps });
  if (plan.kind !== "plan") {
    return plan;
  }
  return Array.from({ length: plan.stepCount }, (_, index) =>
    partsAt(plan, index)
  );
};

describe("focus mode", () => {
  it("emphasises the step's nodes and lets the rest recede", () => {
    const [first] = walk("mermaid {user|agent}", loop) as PartStates[];

    expect(first?.active).toStrictEqual(["user"]);
    expect(first?.receding).toStrictEqual(
      expect.arrayContaining(["agent", "llm", "tools"])
    );
    expect(first?.receding).not.toContain("user");
    expect(first?.hidden).toStrictEqual([]);
  });

  it("joins ids with a comma and gives each later step its own click", () => {
    const states = walk("mermaid {user|agent,llm|tools}", loop) as PartStates[];

    expect(states).toHaveLength(3);
    expect(states[1]?.active).toStrictEqual(
      expect.arrayContaining(["agent", "llm"])
    );
    expect(states[1]?.active).not.toContain("user");
    expect(states[2]?.active).toContain("tools");
  });

  it("activates the whole diagram with *", () => {
    const [, last] = walk("mermaid {user|*}", loop) as PartStates[];

    expect(last?.active).toStrictEqual(
      expect.arrayContaining([
        "user",
        "agent",
        "llm",
        "tools",
        "L_user_agent_0",
      ])
    );
    expect(last?.receding).toStrictEqual([]);
  });

  it("activates an edge once both of its ends are active", () => {
    const [user, userAndAgent, agentAndLlm] = walk(
      "mermaid {user|user,agent|agent,llm}",
      loop
    ) as PartStates[];

    expect(user?.receding).toContain("L_user_agent_0");
    expect(userAndAgent?.active).toContain("L_user_agent_0");
    expect(userAndAgent?.receding).toContain("L_agent_llm_0");
    expect(agentAndLlm?.active).toStrictEqual(
      expect.arrayContaining(["L_agent_llm_0", "L_llm_agent_0"])
    );
    expect(agentAndLlm?.receding).toContain("L_user_agent_0");
  });

  it("lets a named edge in the steps follow its own step", () => {
    const named = `flowchart LR
  user[User] e1@--> agent[Agent]
  agent e2@--> tools[Tools]
`;
    const [ends, edge] = walk(
      "mermaid {user,agent,tools|e1}",
      named
    ) as PartStates[];

    // e1 waits for its step; e2 is not in the steps, so it follows its ends.
    expect(ends?.receding).toContain("e1");
    expect(ends?.active).toContain("e2");
    expect(edge?.active).toStrictEqual(["e1"]);
  });

  it("stays on the last step past the end", () => {
    const plan = planSteps({
      mode: "focus",
      source: loop,
      steps: "user|tools",
    });
    if (plan.kind !== "plan") {
      throw new Error(plan.kind);
    }

    expect(partsAt(plan, 5).active).toStrictEqual(["tools"]);
  });
});

describe("reveal mode", () => {
  it("hides parts until their step and keeps earlier steps visible", () => {
    const [first, second, last] = walk(
      "mermaid {user|agent|*}",
      loop,
      "reveal"
    ) as PartStates[];

    expect(first?.active).toStrictEqual(["user"]);
    expect(first?.hidden).toStrictEqual(
      expect.arrayContaining(["agent", "llm", "tools", "L_user_agent_0"])
    );
    expect(second?.active).toStrictEqual(
      expect.arrayContaining(["user", "agent", "L_user_agent_0"])
    );
    expect(second?.hidden).toStrictEqual(
      expect.arrayContaining(["llm", "tools", "L_agent_llm_0"])
    );
    expect(last?.hidden).toStrictEqual([]);
  });

  it("keeps a named edge hidden until its own step", () => {
    const named = `flowchart LR
  query[Query] q@--> retrieve[Retrieve]
`;
    const [ends, edge] = walk(
      "mermaid {query,retrieve|q}",
      named,
      "reveal"
    ) as PartStates[];

    expect(ends?.hidden).toStrictEqual(["q"]);
    expect(edge?.hidden).toStrictEqual([]);
  });
});

describe("unknown step ids", () => {
  it("is an error that lists the known ids", () => {
    const named = `flowchart LR
  user[User] e1@--> agent[Agent]
  agent --> tools[Tools]
`;
    const plan = walk("mermaid {usr|agent,tool|*}", named);

    expect(plan).toStrictEqual({
      kind: "unknown-ids",
      known: ["user", "agent", "tools", "e1"],
      unknown: ["usr", "tool"],
    });
    if (Array.isArray(plan)) {
      return;
    }
    expect(describeStepError(plan)).toBe(
      'Unknown step ids "usr", "tool". Use the ids of the diagram: user, agent, tools, e1.'
    );
  });
});

describe("diagram types without steps", () => {
  it("says steps are not available for that type, by name", async () => {
    await load("pie");
    const plan = planSteps({
      mode: "focus",
      source: 'pie\n  "Dogs" : 3\n  "Cats" : 2',
      steps: "Dogs|*",
    });

    expect(plan).toStrictEqual({ kind: "no-steps", type: "pie" });
  });
});
