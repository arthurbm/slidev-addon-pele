import { describe, expect, it } from "vitest";

import { readFencedBlock } from "../src/fenced-block";
import { diagram, walk } from "./blocks";

// The tool-call loop from the Showcase deck.
const loop = `flowchart LR
  user[User] --> agent[Agent]
  agent --> llm[LLM]
  llm --> agent
  agent --> tools[Tools]
  tools --> agent
`;

describe("steps in the fence", () => {
  it("reads the steps of a diagram block like code line highlighting", async () => {
    const block = await diagram("mermaid {user|agent,llm|tools|*}", loop);

    expect(block).toMatchObject({
      clicks: 3,
      renderer: "pele",
      steps: "user|agent,llm|tools|*",
    });
  });

  it("reads steps followed by options", async () => {
    const block = await diagram(
      "mermaid {user | agent}{reveal: true, at: 1}",
      loop
    );

    expect(block).toMatchObject({
      options: "{reveal: true, at: 1}",
      steps: "user | agent",
    });
  });

  it("keeps a lone options object as options, not steps", async () => {
    const block = await diagram("mermaid {scale: 0.8}", loop);

    expect(block).toMatchObject({ clicks: 0, options: "{scale: 0.8}" });
    expect(block).not.toHaveProperty("steps");
    expect(block.partsAt(0)).toBeUndefined();
  });
});

describe("focus mode", () => {
  it("emphasises the step's nodes and lets the rest recede", async () => {
    const [first] = await walk("mermaid {user|agent}", loop);

    expect(first?.active).toStrictEqual(["user"]);
    expect(first?.receding).toStrictEqual(
      expect.arrayContaining(["agent", "llm", "tools"])
    );
    expect(first?.receding).not.toContain("user");
    expect(first?.hidden).toStrictEqual([]);
  });

  it("joins ids with a comma and gives each later step its own click", async () => {
    const states = await walk("mermaid {user|agent,llm|tools}", loop);

    expect(states).toHaveLength(3);
    expect(states[1]?.active).toStrictEqual(
      expect.arrayContaining(["agent", "llm"])
    );
    expect(states[1]?.active).not.toContain("user");
    expect(states[2]?.active).toContain("tools");
  });

  it("activates the whole diagram with *", async () => {
    const [, last] = await walk("mermaid {user|*}", loop);

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

  it("activates an edge once both of its ends are active", async () => {
    const [user, userAndAgent, agentAndLlm] = await walk(
      "mermaid {user|user,agent|agent,llm}",
      loop
    );

    expect(user?.receding).toContain("L_user_agent_0");
    expect(userAndAgent?.active).toContain("L_user_agent_0");
    expect(userAndAgent?.receding).toContain("L_agent_llm_0");
    expect(agentAndLlm?.active).toStrictEqual(
      expect.arrayContaining(["L_agent_llm_0", "L_llm_agent_0"])
    );
    expect(agentAndLlm?.receding).toContain("L_user_agent_0");
  });

  it("lets a named edge in the steps follow its own step", async () => {
    const named = `flowchart LR
  user[User] e1@--> agent[Agent]
  agent e2@--> tools[Tools]
`;
    const [ends, edge] = await walk("mermaid {user,agent,tools|e1}", named);

    // e1 waits for its step; e2 is not in the steps, so it follows its ends.
    expect(ends?.receding).toContain("e1");
    expect(ends?.active).toContain("e2");
    expect(edge?.active).toStrictEqual(["e1"]);
  });

  it("stays on the last step past the end", async () => {
    const block = await diagram("mermaid {user|tools}", loop);

    expect(block.partsAt(5)?.active).toStrictEqual(["tools"]);
  });
});

describe("the clicks a block's steps land on", () => {
  it("lands its second step on the click `at` names", async () => {
    const block = await diagram("mermaid {user|agent|tools}{at: 3}", loop);
    const active = [0, 2, 3, 4].map((click) => block.partsAt(click)?.active);

    expect(active).toStrictEqual([["user"], ["user"], ["agent"], ["tools"]]);
  });

  it("shows the last step and takes no clicks with `at: false`", async () => {
    const block = await diagram("mermaid {user|tools}{at: false}", loop);

    expect(block.clicks).toBe(0);
    expect(block.partsAt(0)?.active).toStrictEqual(["tools"]);
  });
});

describe("reveal mode", () => {
  it("hides parts until their step and keeps earlier steps visible", async () => {
    const [first, second, last] = await walk(
      "mermaid {user|agent|*}{reveal: true}",
      loop
    );

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

  it("keeps a named edge hidden until its own step", async () => {
    const named = `flowchart LR
  query[Query] q@--> retrieve[Retrieve]
`;
    const [ends, edge] = await walk(
      "mermaid {query,retrieve|q}{reveal: true}",
      named
    );

    expect(ends?.hidden).toStrictEqual(["q"]);
    expect(edge?.hidden).toStrictEqual([]);
  });
});

describe("unknown step ids", () => {
  it("is an error that lists the known ids", async () => {
    const named = `flowchart LR
  user[User] e1@--> agent[Agent]
  agent --> tools[Tools]
`;
    const block = await diagram("mermaid {usr|agent,tool|*}", named);

    expect(block.errors).toStrictEqual([
      '[pele] Unknown step ids "usr", "tool". Use the ids of the diagram: user, agent, tools, e1.',
    ]);
    expect(block.partsAt(0)).toBeUndefined();
  });

  it("names the file and slide when it knows them", async () => {
    const block = await readFencedBlock({
      body: "flowchart LR\n  a --> b\n",
      fence: "mermaid {a|x}",
      where: "slides.md, slide 3",
    });

    expect(block).toMatchObject({
      errors: [
        '[pele] slides.md, slide 3: Unknown step id "x". Use the ids of the diagram: a, b.',
      ],
    });
  });

  it("is left to Pele's own message when the diagram cannot be read", async () => {
    const block = await diagram(
      "mermaid {a|b}",
      "flowchart LR\n  a --> b\n  b -->> [x\n"
    );

    expect(block.errors).toStrictEqual([]);
    expect(block.partsAt(0)).toBeUndefined();
  });
});
