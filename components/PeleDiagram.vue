<script setup lang="ts">
import { useSlideContext } from "@slidev/client";
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
import type { Preset } from "../src/preset";
import { decodeSource } from "../src/source-prop";
import {
  describeStepError,
  partsAt,
  planSteps,
  splitSteps,
} from "../src/step-plan";
import type { PartStates, StepPlan } from "../src/step-plan";

// Fence options Pele has no use for (Slidev binds them all) are not put on
// the element as attributes.
defineOptions({ inheritAttrs: false });

const {
  source,
  preset = "auto",
  tone = "none",
  steps = "",
  reveal = false,
  at = "+1",
  scale,
} = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source: string;
  /** The preset's CSS variables apply through `data-pele-preset`. */
  preset?: Preset["name"];
  tone?: NonNullable<Preset["tone"]> | "none";
  /** The block's steps as written in the fence, e.g. `user|agent,llm|*`. */
  steps?: string;
  /** Reveal mode: parts stay hidden until their step. Focus mode otherwise. */
  reveal?: boolean;
  /** The click the second step lands on, as `at` on Slidev code blocks. */
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
const mounted = shallowRef<Mounted>();
const plan = shallowRef<StepPlan>();
let unmounted = false;

const text = decodeSource(source);
let animatedEdges: Map<string, AnimatedEdge["speed"]> | undefined;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Pele draws `animate: true` edges still; the classes let the addon's CSS
// move their dashes. Re-applied after every draw, since each draw replaces
// the SVG.
const markAnimatedEdges = (element: HTMLElement) => {
  animatedEdges ??= new Map(
    findAnimatedEdges(text).map(({ id, speed }) => [id, speed])
  );
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

/** Sizes the drawing like Slidev's Mermaid component does with `scale`. */
const applyScale = (element: HTMLElement) => {
  const svg = element.querySelector<SVGSVGElement>(":scope > svg");
  if (!svg || typeof scale !== "number" || scale <= 0) {
    return;
  }
  // Pele's own inline style carries its CSS variables, so only the size
  // changes; `max-width: 100%` keeps a large scale inside the slide.
  svg.removeAttribute("width");
  svg.style.width = "auto";
  svg.style.height = `${svg.viewBox.baseVal.height * scale}px`;
};

/** Shows a problem where the diagram would be, as Pele does for bad syntax. */
const showError = (element: HTMLElement, error: unknown) => {
  const message = element.ownerDocument.createElement("div");
  message.className = "pele pele-error";
  message.textContent = messageOf(error);
  element.replaceChildren(message);
};

// Clicks, registered the way Slidev's code blocks register theirs: one click
// per step after the first, the first step showing before any click.
const { $clicksContext: clicks } = useSlideContext();
const clicksId = `pele-${Math.random().toString(36).slice(2)}`;
const stepCount = steps.trim() === "" ? 0 : splitSteps(steps).length;
const stepIndex = shallowRef(0);

// Toggles the step classes on every element carrying a part's `data-id`.
const applySteps = () => {
  const element = container.value;
  const current = plan.value;
  if (!element || current?.kind !== "plan") {
    return;
  }
  const states = partsAt(current, stepIndex.value);
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

const stepError = computed(() =>
  plan.value && plan.value.kind !== "plan" && plan.value.kind !== "unreadable"
    ? describeStepError(plan.value)
    : undefined
);

onMounted(async () => {
  if (stepCount > 0) {
    // Must happen before the slide's clicks are mounted, so before any await.
    const clicksInfo = clicks.calculateSince(at, stepCount - 1);
    clicks.register(clicksId, clicksInfo);
    const index = computed(() =>
      clicksInfo
        ? Math.max(0, clicks.current - clicksInfo.start + 1)
        : stepCount - 1
    );
    watch(
      index,
      (value) => {
        stepIndex.value = value;
        applySteps();
      },
      { flush: "post", immediate: true }
    );
  }

  const element = container.value;
  if (!element) {
    return;
  }
  // Pele's lazy entry loads only the code for this block's diagram type.
  // `mountAsync` draws at the container's width, re-draws when that width
  // changes or web fonts finish loading, measures text with the container's
  // computed font (the slide's), and shows syntax errors in the element.
  try {
    const instance = await mountAsync(element, text, {
      onError: (error) => console.error(`[pele] ${messageOf(error)}`),
      // Every draw replaces the SVG, so classes and size are applied again
      // after each.
      onRender: () => {
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
  } catch (error) {
    // The diagram type's code failed to load: say so on the slide, which also
    // lets an export waiting for this diagram move on.
    console.error(`[pele] ${messageOf(error)}`);
    showError(element, error);
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  clicks.unregister(clicksId);
  mounted.value?.destroy();
});
</script>

<template>
  <!-- Slidev's exporter waits until a drawing or an error is shown. -->
  <div
    class="pele-diagram"
    data-waitfor="svg.pele, .pele-error"
    :class="{ 'pele-steps': stepCount > 0 }"
    :data-pele-preset="preset"
    :data-pele-tone="tone"
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
