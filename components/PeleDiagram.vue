<script setup lang="ts">
import { configs, useDarkMode } from "@slidev/client";
import { mountAsync } from "pele/lazy";
import type { Mounted } from "pele/lazy";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";

import { findAnimatedEdges } from "../src/animated-edges";
import type { AnimatedEdge } from "../src/animated-edges";
import { describeDrawError, describeLoadError } from "../src/draw-errors";
import type { Preset } from "../src/preset";
import { SCALE_FIX, isScale } from "../src/scale";
import { backgroundBehind } from "../src/slide-background";
import { decodeSource } from "../src/source-prop";
import {
  describeStepError,
  partsAt,
  planSteps,
  splitSteps,
} from "../src/step-plan";
import type { PartStates, StepPlan } from "../src/step-plan";
import { useClickIndex } from "../src/use-click-index";
import { useMagicMove } from "../src/use-magic-move";

// Fence options Pele has no use for (Slidev binds them all) are not put on
// the element as attributes.
defineOptions({ inheritAttrs: false });

const {
  source = "",
  versions = "",
  duration = configs.magicMoveDuration,
  preset = "auto",
  tone = "none",
  steps = "",
  reveal = false,
  at = "+1",
  scale,
} = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source?: string;
  /** A magic-move's versions, a JSON array of sources encoded like `source`. */
  versions?: string;
  /** How long moving to the next version takes, as Slidev's magic-move. */
  duration?: number;
  /** The preset's CSS variables apply through `data-pele-preset`. */
  preset?: Preset["name"];
  tone?: NonNullable<Preset["tone"]> | "none";
  /** The block's steps as written in the fence, e.g. `user|agent,llm|*`. */
  steps?: string;
  /** Reveal mode: parts stay hidden until their step. Focus mode otherwise. */
  reveal?: boolean;
  /** The click the second step (or version) lands on, as `at` in Slidev. */
  at?: string | number;
  /** The diagram's height is its natural height times this, as in Slidev. */
  // oxlint-disable-next-line vue/require-default-prop -- no scale means the natural size, as in Slidev
  scale?: number;
}>();

const STATE_CLASSES: Record<keyof PartStates, string> = {
  active: "pele-step-active",
  hidden: "pele-step-hidden",
  receding: "pele-step-receding",
};

const container = useTemplateRef<HTMLDivElement>("container");
const root = useTemplateRef<HTMLDivElement>("root");
const mounted = shallowRef<Mounted>();
const plan = shallowRef<StepPlan>();
let unmounted = false;

// A magic-move draws one version at a time; a block of its own, its source.
const versionSources: string[] = versions
  ? JSON.parse(decodeSource(versions))
  : [];
const text = versionSources.length > 0 ? "" : decodeSource(source);
const stepCount = steps.trim() === "" ? 0 : splitSteps(steps).length;

// Clicks first: Slidev counts a slide's clicks once its blocks are mounted.
const clickIndex = useClickIndex(
  at,
  versionSources.length > 0 ? versionSources.length : stepCount
);
const magicMove =
  versionSources.length > 0
    ? useMagicMove({ duration, index: clickIndex, versions: versionSources })
    : undefined;
/** The text Pele draws now. */
const drawnText = () => magicMove?.current() ?? text;

// Pele draws `animate: true` edges still; the classes let the addon's CSS
// move their dashes. Re-applied after every draw, since each draw replaces
// the SVG.
const animatedEdgesBySource = new Map<
  string,
  Map<string, AnimatedEdge["speed"]>
>();
const markAnimatedEdges = (element: HTMLElement) => {
  const drawn = drawnText();
  let animatedEdges = animatedEdgesBySource.get(drawn);
  if (!animatedEdges) {
    animatedEdges = new Map(
      findAnimatedEdges(drawn).map(({ id, speed }) => [id, speed])
    );
    animatedEdgesBySource.set(drawn, animatedEdges);
  }
  if (animatedEdges.size === 0) {
    return;
  }
  for (const edge of element.querySelectorAll<SVGElement>(".pele-edge")) {
    const speed = animatedEdges.get(edge.dataset.id ?? "");
    if (speed) {
      edge.classList.add("pele-animated", `pele-animated-${speed}`);
    }
  }
};

// A scale Vue computed in the slide is only known here; a literal one was
// checked when the deck was built.
if (scale !== undefined && !isScale(scale)) {
  console.warn(`[pele] ${SCALE_FIX} Got ${String(scale)}.`);
}

/** Sizes the drawing like Slidev's Mermaid component does with `scale`. */
const applyScale = (element: HTMLElement) => {
  const svg = element.querySelector<SVGSVGElement>(":scope > svg");
  if (!svg || !isScale(scale)) {
    return;
  }
  // Pele's own inline style carries its CSS variables, so only the size
  // changes; `max-width: 100%` keeps a large scale inside the slide.
  svg.removeAttribute("width");
  svg.style.width = "auto";
  svg.style.height = `${svg.viewBox.baseVal.height * scale}px`;
};

// Toggles the step classes on every element carrying a part's `data-id`.
const applySteps = () => {
  const element = container.value;
  const current = plan.value;
  if (!element || current?.kind !== "plan") {
    return;
  }
  const states = partsAt(current, clickIndex.value);
  const stateOf = new Map<string, string>();
  for (const [state, className] of Object.entries(STATE_CLASSES)) {
    for (const id of states[state as keyof PartStates]) {
      stateOf.set(id, className);
    }
  }
  for (const part of element.querySelectorAll<SVGElement>("svg [data-id]")) {
    const className = stateOf.get(part.dataset.id ?? "");
    for (const stateClass of Object.values(STATE_CLASSES)) {
      part.classList.toggle(stateClass, stateClass === className);
    }
  }
};
watch(clickIndex, applySteps, { flush: "post" });

// Pele shows a diagram it cannot read in its place; other step errors show
// under the diagram.
const stepError = computed(() =>
  plan.value && plan.value.kind !== "plan" && plan.value.kind !== "unreadable"
    ? describeStepError(plan.value)
    : undefined
);

// The auto preset draws on the slide's own background, which only the
// page knows. Reading it sets a CSS variable: the drawing stays as it is.
const slideBackground = shallowRef<string>();
const readBackground = () => {
  if (root.value) {
    slideBackground.value = backgroundBehind(root.value);
  }
};
const { isDark } = useDarkMode();
watch(isDark, () => {
  // Once the page has repainted in the new mode.
  requestAnimationFrame(readBackground);
});

onMounted(async () => {
  readBackground();
  const element = container.value;
  if (!element) {
    return;
  }
  // Pele's lazy entry loads only the code for this block's diagram type.
  // `mountAsync` draws at the container's width, re-draws when that width
  // changes or web fonts finish loading, measures text with the container's
  // computed font (the slide's), and shows syntax errors in the element.
  try {
    await magicMove?.prepare(element);
    const instance = await mountAsync(element, drawnText(), {
      // The versions run the way the magic-move decided, every one alike.
      autoDirection: !magicMove,
      onError: (error) => console.error(`[pele] ${describeDrawError(error)}`),
      // Every draw replaces the SVG, so classes and size are applied again
      // after each.
      onRender: () => {
        magicMove?.drawn(element);
        markAnimatedEdges(element);
        applyScale(element);
        if (stepCount > 0 && !plan.value) {
          // The diagram type is loaded once Pele has drawn it.
          plan.value = planSteps({
            mode: reveal ? "reveal" : "focus",
            source: text,
            steps,
          });
        }
        applySteps();
      },
      zoom: false,
    });
    if (unmounted) {
      instance.destroy();
      return;
    }
    mounted.value = instance;
    magicMove?.start(instance);
  } catch (error) {
    // The diagram type's code failed to load: say so on the slide, which also
    // lets an export waiting for this diagram move on.
    const message = describeLoadError(error);
    console.error(`[pele] ${message}`);
    const shown = element.ownerDocument.createElement("div");
    shown.className = "pele pele-error";
    shown.textContent = message;
    element.replaceChildren(shown);
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  mounted.value?.destroy();
});
</script>

<template>
  <!-- Slidev's exporter waits until a drawing or an error is shown. -->
  <div
    ref="root"
    class="pele-diagram"
    data-waitfor="svg.pele, .pele-error"
    :class="{ 'pele-steps': stepCount > 0 }"
    :data-pele-preset="preset"
    :data-pele-tone="tone"
    :style="{ '--pele-slide-bg': slideBackground }"
  >
    <!-- Pele owns this element's content. -->
    <div ref="container" />
    <p v-if="stepError" class="pele-step-error">[pele] {{ stepError }}</p>
  </div>
</template>

<style>
.pele-diagram {
  width: 100%;
}

.pele-diagram .pele-error {
  color: var(--pele-error, #e45756);
  font-family: var(--slidev-code-font-family, monospace);
  white-space: pre-wrap;
}

.pele-steps [data-id] {
  transition: opacity 0.35s ease;
}

.pele-steps .pele-step-receding {
  opacity: 0.2;
}

/* A receding card in a receding column recedes once, not twice. */
.pele-steps .pele-step-receding .pele-step-receding {
  opacity: 1;
}

.pele-steps .pele-step-hidden {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pele-steps [data-id] {
    transition: none;
  }
}

.pele-step-error {
  color: var(--pele-error, #e45756);
  font-family: var(--slidev-code-font-family, monospace);
  font-size: 0.8em;
  white-space: pre-wrap;
}
</style>
