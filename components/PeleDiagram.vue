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
import { describeStepError, partsAt, planSteps } from "../src/step-plan";
import type { PartStates, StepPlan } from "../src/step-plan";

const {
  source,
  preset = "auto",
  tone = "none",
  steps = [],
  reveal = false,
  at = "+1",
} = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source: string;
  /** The preset's CSS variables apply through `data-pele-preset`. */
  preset?: Preset["name"];
  tone?: NonNullable<Preset["tone"]> | "none";
  /** The block's steps as written in the fence, one entry per step. */
  steps?: string[];
  /** Reveal mode: parts stay hidden until their step. Focus mode otherwise. */
  reveal?: boolean;
  /** The click the second step lands on, as `at` on Slidev code blocks. */
  at?: string | number;
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

// Clicks, registered the way Slidev's code blocks register theirs: one click
// per step after the first, the first step showing before any click.
const { $clicksContext: clicks } = useSlideContext();
const clicksId = `pele-${Math.random().toString(36).slice(2)}`;
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
  if (steps.length > 0) {
    // Must happen before the slide's clicks are mounted, so before any await.
    const clicksInfo = clicks.calculateSince(at, steps.length - 1);
    clicks.register(clicksId, clicksInfo);
    const index = computed(() =>
      clicksInfo
        ? Math.max(0, clicks.current - clicksInfo.start + 1)
        : steps.length - 1
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
  // changes or web fonts finish loading, and measures text with the
  // container's computed font, which is the slide's.
  const instance = await mountAsync(element, text, {
    onError: (error) => console.error("[pele]", error),
    // Every draw replaces the SVG, so classes are applied again after each.
    onRender: () => {
      markAnimatedEdges(element);
      if (steps.length > 0 && !plan.value) {
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
});

onBeforeUnmount(() => {
  unmounted = true;
  clicks.unregister(clicksId);
  mounted.value?.destroy();
});
</script>

<template>
  <div
    class="pele-diagram"
    :class="{ 'pele-steps': steps.length > 0 }"
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
