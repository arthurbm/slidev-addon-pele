import { describe, expect, it } from "vitest";

import { diagram, walk } from "./blocks";

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

/** The state of every part at each click, as the audience sees it. */
const steps = (fence: string) => walk(fence, chat);

describe("sequence diagram steps", () => {
  it("steps by message number in source order, starting at 1", async () => {
    const [first, second] = await steps("mermaid {1|2|4}");

    expect(first?.active).toStrictEqual(["i0", "i1"]);
    expect(second?.active).toStrictEqual(["i2"]);
    expect(second?.receding).toStrictEqual(["i0", "i1", "i4", "i6"]);
  });

  it("names consecutive messages with a range", async () => {
    const [, range] = await steps("mermaid {1|2-3|*}");

    expect(range?.active).toStrictEqual(["i2", "i4"]);
    expect(range?.receding).toStrictEqual(["i0", "i1", "i6"]);
  });

  it("activates every message and note with *", async () => {
    const states = await steps("mermaid {1|2-3|*}");
    const everything = states.at(-1);

    expect(everything?.active).toStrictEqual(["i0", "i1", "i2", "i4", "i6"]);
    expect(everything?.receding).toStrictEqual([]);
  });

  it("shows a note with the message before it", async () => {
    const [first, second] = await steps("mermaid {1|2|3-4}{reveal: true}");

    expect(first?.active).toStrictEqual(["i0", "i1"]);
    expect(first?.hidden).toStrictEqual(["i2", "i4", "i6"]);
    expect(second?.active).toStrictEqual(["i0", "i1", "i2"]);
  });

  it("keeps the participants in view at every step", async () => {
    for (const options of ["", "{reveal: true}"]) {
      // oxlint-disable-next-line no-await-in-loop -- two modes, one after the other
      for (const states of await steps(`mermaid {1|2-3|4}${options}`)) {
        const outOfView = [...states.receding, ...states.hidden];
        for (const participant of ["U", "A", "L"]) {
          expect(outOfView).not.toContain(participant);
        }
      }
    }
  });

  it("lists the message numbers for a number or range that is not a message", async () => {
    const block = await diagram("mermaid {0|2-5|3-2|U|1}", chat);

    expect(block.errors).toStrictEqual([
      '[pele] Unknown step ids "0", "2-5", "3-2", "U". Use the ids of the diagram: 1, 2, 3, 4.',
    ]);
  });

  it("says a sequence diagram without messages has nothing to step", async () => {
    const block = await diagram(
      "mermaid {1|*}",
      "sequenceDiagram\n  participant U as User\n"
    );

    expect(block.errors).toStrictEqual([
      "[pele] Steps name a sequence diagram's messages by number, and this one has no messages. Add messages, or remove the {…} steps from the fence.",
    ]);
  });
});
