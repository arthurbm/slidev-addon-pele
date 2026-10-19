import { load } from "pele/lazy";
import { describe, expect, it } from "vitest";

import { readDiagramBlock } from "../src/diagram-block";
import { describeStepError, partsAt, planSteps } from "../src/step-plan";
import type { PartStates, StepMode } from "../src/step-plan";

// Messages 1 to 4 are drawn as i0, i2, i4 and i6: Pele counts the note and
// the loop as statements too. The note is i1.
const chat = `sequenceDiagram
  participant U as User
  participant A as Agent
  participant L as LLM
  U->>A: Ask
  Note over U,A: thinking
  A->>L: Prompt
  loop until done
    L-->>A: Reply
  end
  A-->>U: Answer
`;

await load("sequence");

const plan = (fence: string, mode: StepMode = "focus") => {
  const block = readDiagramBlock({ body: chat, fence });
  if (block.renderer !== "pele" || !block.steps) {
    throw new Error(`no steps in "${fence}"`);
  }
  return planSteps({ mode, source: block.source, steps: block.steps });
};

/** The state of every part at each step, as the audience sees it. */
const walk = (fence: string, mode: StepMode = "focus"): PartStates[] => {
  const steps = plan(fence, mode);
  if (steps.kind !== "plan") {
    throw new Error(describeStepError(steps));
  }
  return Array.from({ length: steps.stepCount }, (_, index) =>
    partsAt(steps, index)
  );
};

describe("sequence diagram steps", () => {
  it("steps by message number in source order, starting at 1", () => {
    const [first, second] = walk("mermaid {1|2|4}");

    expect(first?.active).toStrictEqual(["i0", "i1"]);
    expect(second?.active).toStrictEqual(["i2"]);
    expect(second?.receding).toStrictEqual(["i0", "i1", "i4", "i6"]);
  });

  it("names consecutive messages with a range", () => {
    const [, range] = walk("mermaid {1|2-3|*}");

    expect(range?.active).toStrictEqual(["i2", "i4"]);
    expect(range?.receding).toStrictEqual(["i0", "i1", "i6"]);
  });

  it("activates every message and note with *", () => {
    const everything = walk("mermaid {1|2-3|*}").at(-1);

    expect(everything?.active).toStrictEqual(["i0", "i1", "i2", "i4", "i6"]);
    expect(everything?.receding).toStrictEqual([]);
  });

  it("shows a note with the message before it", () => {
    const [first, second] = walk("mermaid {1|2|3-4}", "reveal");

    expect(first?.active).toStrictEqual(["i0", "i1"]);
    expect(first?.hidden).toStrictEqual(["i2", "i4", "i6"]);
    expect(second?.active).toStrictEqual(["i0", "i1", "i2"]);
  });

  it("keeps the participants in view at every step", () => {
    for (const mode of ["focus", "reveal"] as const) {
      for (const states of walk("mermaid {1|2-3|4}", mode)) {
        const outOfView = [...states.receding, ...states.hidden];
        for (const participant of ["U", "A", "L"]) {
          expect(outOfView).not.toContain(participant);
        }
      }
    }
  });

  it("lists the message numbers for a number or range that is not a message", () => {
    const steps = plan("mermaid {0|2-5|3-2|U|1}");

    expect(steps).toStrictEqual({
      kind: "unknown-ids",
      known: ["1", "2", "3", "4"],
      unknown: ["0", "2-5", "3-2", "U"],
    });
    if (steps.kind !== "unknown-ids") {
      return;
    }
    expect(describeStepError(steps)).toBe(
      'Unknown step ids "0", "2-5", "3-2", "U". Use the ids of the diagram: 1, 2, 3, 4.'
    );
  });
});
