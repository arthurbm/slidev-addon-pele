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
const openAliasedSlide = (alias) => {
  browser("open", `${deckUrl}/${alias}`);
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
  for (const [name, check] of checks) {
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
