import { load, render } from "pele/lazy";
import { describe, expect, it } from "vitest";

import {
  changeBetween,
  dataIds,
  inOneDirection,
  versionAt,
} from "../src/versions";

await load("flowchart");

// The bot of the Showcase deck: an LLM joins, then tools inside an agent.
const withLlm = `flowchart LR
  user[User] --> bot[Bot]
  bot --> llm[LLM]`;
const withTools = `${withLlm}
  bot --> tools[Tools]
  tools --> bot
  subgraph agent[Agent]
    bot
    tools
  end`;

/** What happens to each part when the diagram moves between two versions. */
const change = (from: string, to: string) =>
  changeBetween(dataIds(render(from).svg), dataIds(render(to).svg));

/** Whether a drawing runs down rather than across. */
const runsDown = (source: string, maxWidth: number, autoDirection = false) => {
  const { width, height } = render(source, { autoDirection, maxWidth });
  return height > width;
};

describe("one direction for every version", () => {
  const small = "flowchart LR\n  user[User] --> bot[Bot]";
  // Room for the small version across, not for the one with tools.
  const room = render(small).width + 10;

  it("turns every version top-to-bottom when one of them must turn", () => {
    // Left to itself, Pele turns only the version that does not fit.
    expect(runsDown(small, room, true)).toBeFalsy();
    expect(runsDown(withTools, room, true)).toBeTruthy();

    const drawn = inOneDirection([small, withTools], { maxWidth: room });

    expect(drawn.map((source) => runsDown(source, room))).toStrictEqual([
      true,
      true,
    ]);
  });

  it("leaves every version as written when they all fit", () => {
    expect(
      inOneDirection([small, withTools], { maxWidth: 2000 })
    ).toStrictEqual([small, withTools]);
  });

  it("leaves a type other than flowchart across, for the slide to shrink", async () => {
    await load("class");
    const classes = [
      "classDiagram\n  direction LR\n  A --> B",
      "classDiagram\n  direction LR\n  A --> B\n  B --> C\n  C --> D\n  D --> E",
    ];
    const narrow = render(classes[0] ?? "").width + 10;
    expect(runsDown(classes[1] ?? "", narrow, true)).toBeTruthy();

    expect(inOneDirection(classes, { maxWidth: narrow })).toStrictEqual(
      classes
    );
  });
});

describe("moving between two versions", () => {
  it("glides the parts both versions have and fades in the new ones", () => {
    expect(change(withLlm, withTools)).toStrictEqual({
      enter: ["agent", "L_bot_tools_0", "L_tools_bot_0", "tools"],
      glide: ["L_user_bot_0", "L_bot_llm_0", "user", "bot", "llm"],
      leave: [],
    });
  });

  it("fades out the parts only the old version has", () => {
    expect(change(withTools, withLlm)).toStrictEqual({
      enter: [],
      glide: ["L_user_bot_0", "L_bot_llm_0", "user", "bot", "llm"],
      leave: ["agent", "L_bot_tools_0", "L_tools_bot_0", "tools"],
    });
  });

  it("reads ids with quotes and brackets as Pele wrote them", () => {
    const ids = dataIds(
      render('flowchart LR\n  a["x"] -->|"<b>"| b\n  e1@{ animate: true }').svg
    );

    expect(ids).toContain("a");
    expect(
      dataIds('<g data-id="A&amp;B &lt;&gt; &quot;q&quot; &#39;"/>')
    ).toStrictEqual(['A&B <> "q" \'']);
  });
});

// Slidev's CLICKS_MAX: the click overview, print and going back land on.
const CLICKS_MAX = 999_999;

describe("the version shown at each click", () => {
  it("shows the first version before any click and one more per click", () => {
    // Three versions, clicks from 1 (`at` left to its default, '+1').
    const shown = [0, 1, 2, 3, CLICKS_MAX].map((click) =>
      versionAt({ click, count: 3, start: 1 })
    );

    expect(shown).toStrictEqual([0, 1, 2, 2, 2]);
  });

  it("starts moving at the click `at` names", () => {
    // `{at: 3}` on the outer fence: the second version lands on click 3.
    const shown = [0, 2, 3, 4].map((click) =>
      versionAt({ click, count: 3, start: 3 })
    );

    expect(shown).toStrictEqual([0, 0, 1, 2]);
  });

  it("shows the last version when it takes no clicks", () => {
    // `{at: false}`, as for Slidev's magic-move.
    expect(versionAt({ click: 0, count: 3 })).toBe(2);
  });
});
