// Browser suite: checks the Showcase deck running in a real Slidev, driven by
// agent-browser. Run with `pnpm test:browser`.
//
// Starts the deck's dev server on PELE_DECK_PORT (default 3040) unless
// PELE_DECK_URL points at one already running. Chrome is launched with
// `--no-sandbox` (needed in CI containers); override with AGENT_BROWSER_ARGS.

import { execFileSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const showcase = fileURLToPath(new URL("../../showcase/", import.meta.url));
const port = process.env.PELE_DECK_PORT ?? "3040";
const deckUrl = process.env.PELE_DECK_URL ?? `http://localhost:${port}`;
const browserEnv = {
  ...process.env,
  AGENT_BROWSER_ARGS: process.env.AGENT_BROWSER_ARGS ?? "--no-sandbox",
  AGENT_BROWSER_SESSION: `pele-showcase-${process.pid}`,
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const browser = (...args) =>
  execFileSync("agent-browser", args, {
    encoding: "utf-8",
    env: browserEnv,
  }).trim();

/** Runs a function in the page and returns its JSON result. */
const inPage = (fn, argument) => {
  const call = `(${fn})(${JSON.stringify(argument)})`;
  const output = browser(
    "eval",
    `Promise.resolve(${call}).then((r) => JSON.stringify(r))`
  );
  return JSON.parse(JSON.parse(output));
};

const isDeckUp = async () => {
  try {
    const response = await fetch(deckUrl);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForDeck = async (attemptsLeft = 120) => {
  if (await isDeckUp()) {
    return;
  }
  if (attemptsLeft === 0) {
    throw new Error(`The Showcase deck did not start at ${deckUrl}`);
  }
  await sleep(500);
  await waitForDeck(attemptsLeft - 1);
};

/** Opens a slide and waits until its diagrams are drawn with web fonts loaded. */
const openSlide = (slide) => {
  browser("open", `${deckUrl}/${slide}`);
  browser("wait", `.slidev-page-${slide} .pele-diagram svg`);
  inPage(async () => {
    await document.fonts.ready;
    return true;
  });
  // Let Pele finish its re-draw after the fonts load.
  browser("wait", "300");
};

/**
 * Opens a slide by its `routeAlias` (slide numbers shift as the deck grows)
 * and waits until its diagrams are drawn. The slide's `class` scopes queries.
 */
const openAliasedSlide = (path) => {
  // The alias may carry a click, as in `magic-move?clicks=2`.
  const [alias] = path.split("?");
  browser("open", `${deckUrl}/${path}`);
  browser("wait", `.${alias} .pele-diagram svg`);
  inPage(async () => {
    await document.fonts.ready;
    return true;
  });
  browser("wait", "300");
};

/** Sets Slidev's colour mode, which persists in localStorage, and reloads. */
const useColorSchema = (schema) => {
  inPage((value) => {
    localStorage.setItem("slidev-color-schema", value);
    return true;
  }, schema);
  browser("reload");
};

/** Reads each diagram's background colour, keeping its SVG for later. */
const readColors = (alias) =>
  [...document.querySelectorAll(`.${alias} .pele-diagram svg.pele`)].map(
    (svg, index) => {
      window.peleSvgs ??= [];
      const sameSvg = window.peleSvgs[index] === svg;
      window.peleSvgs[index] = svg;
      return {
        background: getComputedStyle(svg).getPropertyValue("--_bg").trim(),
        dark: document.documentElement.classList.contains("dark"),
        sameSvg,
      };
    }
  );

/** Reads how an edge's line is drawn right now. */
const readEdgeLine = ({ alias, id }) => {
  const edge = [
    ...document.querySelectorAll(`.${alias} .pele-diagram .pele-edge`),
  ].find((element) => element.dataset.id === id);
  const line = edge?.querySelector("path:not(.pele-marker)");
  if (!line) {
    return null;
  }
  const style = getComputedStyle(line);
  return {
    dashes: style.strokeDasharray,
    offset: style.strokeDashoffset,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};

/** Reads an edge's line twice, 150 ms apart, to see whether it moves. */
const readEdgeMotion = (edge) => {
  const before = inPage(readEdgeLine, edge);
  browser("wait", "150");
  const after = inPage(readEdgeLine, edge);
  if (!before || !after) {
    return null;
  }
  return { ...after, moved: after.offset !== before.offset };
};

/** Reads the diagram blocks on a slide, as the audience sees them. */
const readDiagrams = (slide) =>
  [
    ...(document
      .querySelector(`.slidev-page-${slide}`)
      ?.querySelectorAll(".pele-diagram") ?? []),
  ].map((diagram) => {
    const box = diagram.querySelector("svg")?.getBoundingClientRect();
    const parts = [...diagram.querySelectorAll("[data-id]")];
    return {
      height: box?.height ?? 0,
      ids: parts.map((part) => part.dataset.id),
      labels: parts
        .filter(
          (part) => part.querySelector("rect") && part.querySelector("text")
        )
        .map((part) => ({
          box: part.querySelector("rect").getBBox().width,
          id: part.dataset.id,
          text: part.querySelector("text").getBBox().width,
        })),
      shadowRoot: diagram.shadowRoot !== null,
      width: box?.width ?? 0,
    };
  });

/**
 * Reads the step state of the current slide's diagram blocks: the parts with
 * each step class, and the code lines Slidev highlights beside them. Slides
 * with steps carry a `routeAlias`, so the slide number comes from Slidev.
 */
const readSteps = (scope) => {
  const no = window.__slidev__.nav.currentSlideNo;
  const pages = [
    ...document.querySelectorAll(`${scope ?? ""} .slidev-page-${no}`),
  ];
  return pages.map((page) => ({
    code: [...page.querySelectorAll(".slidev-code .line.highlighted")].map(
      (line) => line.textContent.trim()
    ),
    diagrams: [...page.querySelectorAll(".pele-diagram")].map((diagram) => {
      const parts = (state) =>
        [
          ...new Set(
            [
              ...diagram.querySelectorAll(`svg [data-id].pele-step-${state}`),
            ].map((part) => part.dataset.id)
          ),
        ].toSorted();
      return {
        active: parts("active"),
        hidden: parts("hidden"),
        receding: parts("receding"),
      };
    }),
    url: location.pathname + location.search,
  }));
};

/** The nodes (not edges) in a list of parts. */
const nodes = (parts) => parts.filter((id) => !id.startsWith("L_"));

const assertParts = (actual, expected, what) =>
  assert(
    JSON.stringify([...actual].toSorted()) ===
      JSON.stringify([...expected].toSorted()),
    `${what}: expected ${expected}, got ${actual}`
  );

// Neighbouring slides are mounted too: wait on the current one.
const currentStepActive = () =>
  document.querySelector(
    `.slidev-page-${window.__slidev__?.nav.currentSlideNo} .pele-step-active`
  ) !== null;

const openStepsSlide = (path) => {
  browser("open", `${deckUrl}/${path}`);
  browser("wait", "--fn", `(${currentStepActive})()`);
  browser("wait", "300");
};

const press = (key) => {
  browser("press", key);
  // Let the click and the step transition settle.
  browser("wait", "500");
};

/** The step state of the current slide, as the audience sees it. */
const currentSlide = () => {
  const [state] = inPage(readSteps);
  return state;
};

const toolLoopSteps = [
  {
    code: ["def run(question):", "messages = [user(question)]"],
    nodes: ["agent", "user"],
  },
  { code: ["while True:", "reply = llm(messages)"], nodes: ["agent", "llm"] },
  {
    code: [
      "if not reply.tool_calls:",
      "return reply.text",
      "messages += call_tools(reply.tool_calls)",
    ],
    nodes: ["agent", "tools"],
  },
  { code: [], nodes: ["agent", "llm", "tools", "user"] },
];

const assertToolLoopStep = (state, index) => {
  const expected = toolLoopSteps[index];
  const [diagram] = state.diagrams;
  assert(diagram, `no diagram block at ${state.url}`);
  assertParts(
    nodes(diagram.active),
    expected.nodes,
    `active nodes at ${state.url}`
  );
  assert(diagram.hidden.length === 0, `focus mode hid ${diagram.hidden}`);
  if (index < toolLoopSteps.length - 1) {
    assert(diagram.receding.length > 0, `nothing recedes at ${state.url}`);
  }
  // `*` on a code block highlights every line.
  if (expected.code.length > 0) {
    assertParts(state.code, expected.code, `highlighted code at ${state.url}`);
  }
};

// The active messages and notes at each step of the sequence-steps slide,
// by label: `{1|2-3|4-5|6-7|8|*}`, the note showing with message 5.
const sequenceSteps = [
  ["What's the weather in Lisbon?"],
  ["Messages + tool list", 'Call get_weather("Lisbon")'],
  ['get_weather("Lisbon")', "21 °C, sunny", "The result goes back to the LLM"],
  ["Messages + tool result", '"It\'s 21 °C and sunny."'],
  ["It's 21 °C and sunny."],
];
sequenceSteps.push(sequenceSteps.flat());

/** Reads the labels of the active messages and notes on the current slide. */
const readSequenceStep = () => {
  const no = window.__slidev__.nav.currentSlideNo;
  const svg = document.querySelector(`.slidev-page-${no} .pele-diagram svg`);
  return {
    active: [
      ...svg.querySelectorAll(
        ".pele-edge-label.pele-step-active, .pele-note.pele-step-active"
      ),
    ].map((part) => part.textContent.trim()),
    participants: svg.querySelectorAll(
      ".pele-actor:is(.pele-step-active, .pele-step-receding, .pele-step-hidden)"
    ).length,
  };
};

const stepChecks = [
  [
    "→ and ← move code steps and diagram steps together",
    () => {
      openStepsSlide("tool-loop");
      const forward = [currentSlide()];
      for (let click = 1; click < toolLoopSteps.length; click += 1) {
        press("ArrowRight");
        forward.push(currentSlide());
      }
      for (const [index, state] of forward.entries()) {
        assertToolLoopStep(state, index);
      }
      const [first, second] = forward.map(({ diagrams: [diagram] }) => diagram);
      // An edge is active once both of its ends are.
      assert(
        first.active.includes("L_user_agent_0"),
        "user → agent is not active with both ends"
      );
      assert(
        !second.active.includes("L_user_agent_0"),
        "user → agent stays active without user"
      );

      const backward = [];
      for (let click = toolLoopSteps.length - 1; click > 0; click -= 1) {
        press("ArrowLeft");
        backward.push(currentSlide());
      }
      for (const [offset, state] of backward.entries()) {
        assertToolLoopStep(state, toolLoopSteps.length - 2 - offset);
      }
    },
  ],
  [
    "reveal mode builds the RAG flow up and takes it down again",
    () => {
      openStepsSlide("rag-reveal");
      const revealed = [
        ["question"],
        ["embed", "question", "search", "store"],
        ["chunks", "embed", "question", "search", "store"],
        ["answer", "chunks", "embed", "llm", "question", "search", "store"],
      ];
      const states = [currentSlide()];
      for (let click = 1; click < revealed.length; click += 1) {
        press("ArrowRight");
        states.push(currentSlide());
      }
      for (const [
        index,
        {
          diagrams: [diagram],
          url,
        },
      ] of states.entries()) {
        assertParts(
          nodes(diagram.active),
          revealed[index],
          `visible nodes at ${url}`
        );
        assert(
          diagram.receding.length === 0,
          `reveal mode dimmed ${diagram.receding}`
        );
        const last = index === revealed.length - 1;
        assert(
          last === (diagram.hidden.length === 0),
          `hidden parts at ${url}: ${diagram.hidden}`
        );
      }
      press("ArrowLeft");
      const [back] = inPage(readSteps);
      assertParts(
        nodes(back.diagrams[0].active),
        revealed[2],
        `visible nodes after ← at ${back.url}`
      );
    },
  ],
  [
    "steps stay in place when the diagram re-renders at a new width",
    () => {
      openStepsSlide("tool-loop?clicks=1");
      const {
        diagrams: [before],
      } = currentSlide();
      inPage(() => {
        const no = window.__slidev__.nav.currentSlideNo;
        const diagram = document.querySelector(
          `.slidev-page-${no} .pele-diagram`
        );
        window.peleSvgBefore = diagram.querySelector("svg");
        diagram.style.width = "200px";
        return true;
      });
      browser(
        "wait",
        "--fn",
        "window.peleSvgBefore && !window.peleSvgBefore.isConnected"
      );
      browser("wait", "300");
      const {
        diagrams: [after],
      } = currentSlide();
      assertParts(
        after.active,
        before.active,
        "active parts after the re-render"
      );
      assertParts(
        after.receding,
        before.receding,
        "receding parts after the re-render"
      );
    },
  ],
  [
    "presenter view shows the current step and the next click's step",
    () => {
      browser("open", `${deckUrl}/presenter/tool-loop?clicks=1`);
      browser("wait", ".slidev-presenter .pele-step-active");
      browser("wait", "500");
      const [current, next] = inPage(readSteps, ".slidev-presenter");
      assert(
        current && next,
        "expected the current slide and its next-click preview"
      );
      assertParts(
        nodes(current.diagrams[0].active),
        toolLoopSteps[1].nodes,
        "presenter current step"
      );
      assertParts(
        nodes(next.diagrams[0].active),
        toolLoopSteps[2].nodes,
        "presenter next step"
      );
    },
  ],
  [
    "a sequence diagram steps message by message, notes with their message",
    () => {
      openStepsSlide("sequence-steps");
      const states = [inPage(readSequenceStep)];
      for (let click = 1; click < sequenceSteps.length; click += 1) {
        press("ArrowRight");
        states.push(inPage(readSequenceStep));
      }
      press("ArrowLeft");
      const back = inPage(readSequenceStep);
      for (const [index, state] of states.entries()) {
        assertParts(
          state.active,
          sequenceSteps[index],
          `active messages at step ${index + 1}`
        );
        assert(
          state.participants === 0,
          `participants took a step class at step ${index + 1}`
        );
      }
      assertParts(back.active, sequenceSteps.at(-2), "active messages after ←");
    },
  ],
];

const checks = [
  [
    "a ```mermaid flowchart is drawn by Pele, in the slide's DOM, left to right",
    () => {
      openSlide(2);
      const [diagram] = inPage(readDiagrams, 2);
      assert(diagram, "no diagram block on slide 2");
      for (const id of ["user", "agent", "llm", "tools"]) {
        assert(
          diagram.ids.includes(id),
          `node "${id}" missing: ${diagram.ids}`
        );
      }
      assert(!diagram.shadowRoot, "the diagram is inside a ShadowRoot");
      assert(
        diagram.width > diagram.height,
        `expected left to right, got ${diagram.width}x${diagram.height}`
      );
    },
  ],
  [
    "mermaid.js is not loaded",
    () => {
      openSlide(2);
      const loaded = inPage(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => /mermaid/iu.test(name))
      );
      assert(loaded.length === 0, `mermaid.js was loaded: ${loaded}`);
    },
  ],
  [
    "a ```pele flowchart in a narrow column turns top to bottom",
    () => {
      openSlide(3);
      const [diagram] = inPage(readDiagrams, 3);
      assert(diagram, "no diagram block on slide 3");
      assert(
        diagram.ids.includes("question"),
        `node "question" missing: ${diagram.ids}`
      );
      assert(
        diagram.height > diagram.width,
        `expected top to bottom, got ${diagram.width}x${diagram.height}`
      );
    },
  ],
  [
    "labels fit their boxes once the slide's web fonts load",
    () => {
      openSlide(3);
      const [diagram] = inPage(readDiagrams, 3);
      assert(diagram, "no diagram block on slide 3");
      assert(diagram.labels.length > 0, "no labelled nodes found");
      for (const label of diagram.labels) {
        assert(
          label.text > 0 && label.text < label.box,
          `label of "${label.id}" (${label.text}px) does not fit its box (${label.box}px)`
        );
      }
    },
  ],
  [
    "a block preset applies: flexoki beside auto",
    () => {
      openAliasedSlide("dark-mode");
      useColorSchema("light");
      openAliasedSlide("dark-mode");
      const [auto, flexoki] = inPage(readColors, "dark-mode");
      assert(auto && flexoki, "expected two diagrams on the dark-mode slide");
      assert(
        auto.background === "#fff",
        `auto should draw on #fff in light mode, got ${auto.background}`
      );
      assert(
        flexoki.background === "#fffcf0",
        `flexoki should draw on #fffcf0 in light mode, got ${flexoki.background}`
      );
    },
  ],
  [
    "toggling dark mode recolours diagrams without re-rendering them",
    () => {
      openAliasedSlide("dark-mode");
      useColorSchema("light");
      openAliasedSlide("dark-mode");
      const light = inPage(readColors, "dark-mode");
      browser("press", "d");
      browser(
        "wait",
        "--fn",
        "document.documentElement.classList.contains('dark')"
      );
      browser("wait", "300");
      const dark = inPage(readColors, "dark-mode");
      useColorSchema("auto");
      assert(dark.length === 2, `expected two diagrams, got ${dark.length}`);
      for (const [index, diagram] of dark.entries()) {
        assert(diagram.dark, "the deck did not switch to dark mode");
        assert(diagram.sameSvg, `diagram ${index + 1} was re-rendered`);
        assert(
          diagram.background !== light[index]?.background,
          `diagram ${index + 1} kept its colours: ${diagram.background}`
        );
      }
      assert(
        dark[1]?.background === "#100f0f",
        `flexoki should draw on #100f0f in dark mode, got ${dark[1]?.background}`
      );
    },
  ],
  [
    "animated edges move, and plain edges stand still",
    () => {
      openAliasedSlide("animated-edges");
      const animated = readEdgeMotion({
        alias: "animated-edges",
        id: "e1",
      });
      assert(animated, "edge e1 missing on the animated-edges slide");
      assert(animated.moved, "edge e1 does not move");
      const plain = readEdgeMotion({
        alias: "animated-edges",
        id: "L_agent_tools_0",
      });
      assert(plain, "edge agent --> tools missing");
      assert(!plain.moved, "a plain edge moves");
    },
  ],
  [
    "animated edges stand still under reduced motion",
    () => {
      browser("set", "media", "light", "reduced-motion");
      try {
        openAliasedSlide("animated-edges");
        const edge = readEdgeMotion({
          alias: "animated-edges",
          id: "e1",
        });
        assert(edge?.reducedMotion, "reduced motion is not emulated");
        assert(!edge.moved, "edge e1 moves under reduced motion");
        assert(
          edge.dashes !== "none",
          "edge e1 lost its dashes under reduced motion"
        );
      } finally {
        browser("set", "media", "light");
      }
    },
  ],
  [
    "the gallery draws every diagram type Pele supports",
    () => {
      openAliasedSlide("gallery");
      browser(
        "wait",
        "--fn",
        "document.querySelectorAll('.gallery .pele-diagram svg.pele').length === document.querySelectorAll('.gallery .pele-diagram').length"
      );
      const gallery = inPage(() => {
        const diagrams = [
          ...document.querySelectorAll(".gallery .pele-diagram"),
        ];
        return {
          blocks: diagrams.length,
          errors: document.querySelectorAll(".gallery .pele-error").length,
          types: [
            ...new Set(
              diagrams.map((diagram) =>
                diagram
                  .querySelector("svg.pele")
                  ?.getAttribute("aria-roledescription")
              )
            ),
          ],
        };
      });
      // Pele 1.6.0 draws 33 diagram types (`DiagramType`).
      assert(gallery.blocks === 33, `${gallery.blocks} diagram blocks, not 33`);
      assert(gallery.errors === 0, `${gallery.errors} diagrams show an error`);
      assert(
        gallery.types.length === 33,
        `${gallery.types.length} distinct types drawn: ${gallery.types}`
      );
    },
  ],
  [
    "the same source is drawn by mermaid.js and by Pele side by side, both scaled as Slidev scales Mermaid",
    () => {
      openAliasedSlide("two-renderers");
      browser(
        "wait",
        "--fn",
        "!!document.querySelector('.two-renderers .mermaid')?.shadowRoot?.querySelector('svg')"
      );
      const sizes = inPage(() => {
        // The two-cols-header layout puts the slide's class on each column.
        const slide = document
          .querySelector(".two-renderers")
          .closest(".slidev-page");
        // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which has only this function
        const measure = (svg) => ({
          natural: svg.viewBox.baseVal.height,
          shown: svg.getBoundingClientRect().height,
        });
        const slideScale = Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--slidev-slide-scale"
          ) || 1
        );
        return {
          mermaid: measure(
            slide.querySelector(".mermaid").shadowRoot.querySelector("svg")
          ),
          pele: measure(slide.querySelector(".pele-diagram svg.pele")),
          slideScale,
        };
      });
      for (const renderer of ["mermaid", "pele"]) {
        const size = sizes[renderer];
        const scale = size.shown / sizes.slideScale / size.natural;
        assert(
          Math.abs(scale - 0.8) < 0.01,
          `${renderer} drew at ${scale.toFixed(3)} of its natural height, expected 0.8`
        );
      }
    },
  ],
];

// The bot on the magic-move slide: its nodes in each version.
const botVersions = [
  ["bot", "user"],
  ["bot", "llm", "user"],
  ["bot", "llm", "tools", "user"],
  ["bot", "llm", "memory", "tools", "user"],
];

/** The nodes each magic-move diagram on the current slide draws. */
const readVersions = (scope) => {
  const no = window.__slidev__.nav.currentSlideNo;
  return [
    ...document.querySelectorAll(`${scope ?? ""} .slidev-page-${no}`),
  ].flatMap((page) =>
    [...page.querySelectorAll(".pele-diagram")].map((diagram) => ({
      nodes: [
        ...new Set(
          [...diagram.querySelectorAll("svg .pele-node[data-id]")].map(
            (node) => node.dataset.id
          )
        ),
      ].toSorted(),
      url: location.pathname + location.search,
    }))
  );
};

const assertVersion = (diagram, index) =>
  assertParts(
    diagram?.nodes ?? [],
    botVersions[index],
    `version ${index + 1} at ${diagram?.url}`
  );

/** Records the bot node's `transform` on every frame for a while. */
const recordBot = (milliseconds) => {
  window.peleBotFrames = [];
  const started = performance.now();
  const frame = () => {
    const no = window.__slidev__.nav.currentSlideNo;
    const bot = [
      ...document.querySelectorAll(
        `.slidev-page-${no} .pele-diagram .pele-node`
      ),
    ].find((node) => node.dataset.id === "bot");
    window.peleBotFrames.push(bot?.getAttribute("transform"));
    if (performance.now() - started < milliseconds) {
      requestAnimationFrame(frame);
    }
  };
  requestAnimationFrame(frame);
  return true;
};

/** The bot's distinct positions while moving from version 3 to version 4. */
const botPositionsToLastVersion = () => {
  openAliasedSlide("magic-move?clicks=2");
  inPage(recordBot, 1500);
  browser("press", "ArrowRight");
  browser("wait", "1700");
  return inPage(() => [...new Set(window.peleBotFrames)]);
};

const magicMoveChecks = [
  [
    "→ and ← move a magic-move through its versions",
    () => {
      openAliasedSlide("magic-move");
      const forward = [inPage(readVersions)[0]];
      for (let click = 1; click < botVersions.length; click += 1) {
        browser("press", "ArrowRight");
        browser("wait", "1000");
        forward.push(inPage(readVersions)[0]);
      }
      for (const [index, diagram] of forward.entries()) {
        assertVersion(diagram, index);
      }
      browser("press", "ArrowLeft");
      browser("wait", "1000");
      assertVersion(inPage(readVersions)[0], botVersions.length - 2);
    },
  ],
  [
    "nodes glide between versions",
    () => {
      const positions = botPositionsToLastVersion();
      // From version 3's place to version 4's, through places in between.
      assert(
        positions.length > 4,
        `the bot jumped instead of gliding: ${positions.join(" → ")}`
      );
    },
  ],
  [
    "reduced motion swaps versions without a glide",
    () => {
      browser("set", "media", "light", "reduced-motion");
      try {
        const positions = botPositionsToLastVersion();
        assert(
          positions.length === 2,
          `expected the bot at two places only, got ${positions.join(" → ")}`
        );
      } finally {
        browser("set", "media", "light");
      }
    },
  ],
  [
    "going back to a magic-move and the overview show its last version",
    () => {
      openAliasedSlide("magic-move");
      browser("press", "ArrowRight");
      browser("press", "ArrowRight");
      browser("press", "ArrowRight");
      // On to the next slide, then back.
      browser("press", "ArrowRight");
      browser("wait", "1000");
      browser("press", "ArrowLeft");
      browser("wait", "1000");
      assertVersion(inPage(readVersions)[0], botVersions.length - 1);

      browser("open", `${deckUrl}/overview`);
      browser(
        "wait",
        "--fn",
        "!!document.querySelector('.magic-move svg.pele')"
      );
      browser("wait", "500");
      const overview = inPage(() =>
        [...document.querySelectorAll(".magic-move .pele-node[data-id]")].map(
          (node) => node.dataset.id
        )
      );
      assertParts(
        [...new Set(overview)],
        botVersions.at(-1),
        "version in the overview"
      );
    },
  ],
  [
    "presenter view shows the current version and the next click's",
    () => {
      browser("open", `${deckUrl}/presenter/magic-move?clicks=1`);
      browser("wait", ".slidev-presenter .magic-move svg.pele");
      browser("wait", "1000");
      const [current, next] = inPage(readVersions, ".slidev-presenter");
      assertVersion(current, 1);
      assertVersion(next, 2);
    },
  ],
];

const server = process.env.PELE_DECK_URL
  ? undefined
  : spawn("pnpm", ["exec", "slidev", "--port", port, "--open", "false"], {
      cwd: showcase,
      detached: true,
      stdio: "ignore",
    });

let failures = 0;
try {
  await waitForDeck();
  for (const [name, check] of [...checks, ...stepChecks, ...magicMoveChecks]) {
    try {
      check();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures += 1;
      console.log(`✗ ${name}\n  ${error.message}`);
    }
  }
} finally {
  try {
    browser("close");
  } catch {
    // Already closed.
  }
  if (server) {
    process.kill(-server.pid);
  }
}

console.log(
  failures === 0
    ? "\nAll browser checks passed."
    : `\n${failures} browser check(s) failed.`
);
process.exitCode = failures === 0 ? 0 : 1;
