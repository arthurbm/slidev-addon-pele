<script setup lang="ts">
import { configs, useNav, useSlideContext } from "@slidev/client";
import { detectType, load, mountAsync } from "pele/lazy";
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
import { glide } from "../src/glide";
import type { Glide } from "../src/glide";
import type { Preset } from "../src/preset";
import { decodeSource } from "../src/source-prop";
import {
  describeStepError,
  partsAt,
  planSteps,
  splitSteps,
} from "../src/step-plan";
import type { PartStates, StepPlan } from "../src/step-plan";
import { inOneDirection, versionAt } from "../src/versions";

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
const mounted = shallowRef<Mounted>();
const plan = shallowRef<StepPlan>();
let unmounted = false;

// A magic-move draws one version at a time; a block of its own, its source.
const versionSources: string[] = versions
  ? JSON.parse(decodeSource(versions))
  : [];
const isMagicMove = versionSources.length > 0;
const text = isMagicMove ? "" : decodeSource(source);
/** The text Pele was last given to draw. */
let drawnText = text;
const animatedEdgesBySource = new Map<
  string,
  Map<string, AnimatedEdge["speed"]>
>();

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Pele draws `animate: true` edges still; the classes let the addon's CSS
// move their dashes. Re-applied after every draw, since each draw replaces
// the SVG.
const markAnimatedEdges = (element: HTMLElement) => {
  let animatedEdges = animatedEdgesBySource.get(drawnText);
  if (!animatedEdges) {
    animatedEdges = new Map(
      findAnimatedEdges(drawnText).map(({ id, speed }) => [id, speed])
    );
    animatedEdgesBySource.set(drawnText, animatedEdges);
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
const { $clicksContext: clicks, $renderContext: renderContext } =
  useSlideContext();
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

// Magic-move: one version at a time, drawn with Pele's mount like a block of
// its own, so width, fonts and errors work the same. A click gives Pele the
// next version's text and, once it is drawn, glides from the old drawing.
const { isPrintMode } = useNav();
const versionIndex = shallowRef(versionSources.length - 1);
/** The versions as drawn: all in one direction for the room there is. */
let drawnVersions = versionSources;
let orientedFor = "";
let gliding: Glide | undefined;
/** The drawing to glide from when Pele next draws. */
let glideFrom: SVGSVGElement | undefined;
/** Like Slidev's magic-move, the first version shown does not glide in. */
let settled = false;

const drawingIn = (element: HTMLElement) =>
  element.querySelector<SVGSVGElement>(":scope > svg.pele") ?? undefined;

/** Decides again which way the versions run, when the room or fonts change. */
const orientVersions = (element: HTMLElement): boolean => {
  const room = {
    fontFamily: getComputedStyle(element).fontFamily,
    maxWidth: element.clientWidth,
  };
  const key = `${room.maxWidth}|${room.fontFamily}|${document.fonts.status}`;
  if (key === orientedFor) {
    return false;
  }
  orientedFor = key;
  const next = inOneDirection(versionSources, room);
  const changed = next.some(
    (version, index) => version !== drawnVersions[index]
  );
  drawnVersions = next;
  return changed;
};

// The live slide and the presenter's glide; the next-click preview, the
// overview, print and export, and viewers who prefer reduced motion swap.
const glides = (element: HTMLElement) =>
  settled &&
  ["slide", "presenter"].includes(renderContext.value) &&
  !isPrintMode.value &&
  element.clientWidth > 0 &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

const drawVersion = (index: number, animate: boolean) => {
  const instance = mounted.value;
  const element = container.value;
  if (!instance || !element) {
    return;
  }
  drawnText = drawnVersions[index] ?? "";
  glideFrom = animate && glides(element) ? drawingIn(element) : undefined;
  // Pele draws at once, calling onRender, unless the slide is hidden.
  instance.update(drawnText);
  glideFrom = undefined;
};

/** After each draw of a version: glide to it, or settle where it is. */
const onVersionDrawn = (element: HTMLElement) => {
  // A glide still under way stops where its parts are, and the next one
  // starts from there.
  gliding?.stop();
  gliding = undefined;
  const drawing = drawingIn(element);
  if (glideFrom && drawing && glideFrom !== drawing) {
    gliding = glide(glideFrom, drawing, duration);
  }
  if (orientVersions(element)) {
    queueMicrotask(() => drawVersion(versionIndex.value, false));
  }
};

/** Loads every version's diagram type before the first is drawn. */
const loadVersions = async (element: HTMLElement) => {
  await Promise.all(
    versionSources.map(async (version) => {
      try {
        return await load(detectType(version));
      } catch {
        // The version shows Pele's error when it is drawn.
        return false;
      }
    })
  );
  orientVersions(element);
  drawnText = drawnVersions[versionIndex.value] ?? "";
};

const registerClicks = () => {
  if (isMagicMove) {
    const count = versionSources.length;
    const clicksInfo = clicks.calculateSince(at, count - 1);
    clicks.register(clicksId, clicksInfo);
    const index = computed(() =>
      versionAt({ click: clicks.current, count, start: clicksInfo?.start })
    );
    watch(
      index,
      (value) => {
        const moved = value !== versionIndex.value;
        versionIndex.value = value;
        if (moved) {
          drawVersion(value, true);
        }
      },
      { immediate: true }
    );
    return;
  }
  if (stepCount > 0) {
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
};

onMounted(async () => {
  // Must happen before the slide's clicks are mounted, so before any await.
  registerClicks();

  const element = container.value;
  if (!element) {
    return;
  }
  // Pele's lazy entry loads only the code for this block's diagram type.
  // `mountAsync` draws at the container's width, re-draws when that width
  // changes or web fonts finish loading, measures text with the container's
  // computed font (the slide's), and shows syntax errors in the element.
  try {
    if (isMagicMove) {
      await loadVersions(element);
    }
    const instance = await mountAsync(element, drawnText, {
      // The versions run the way `inOneDirection` decided, every one alike.
      autoDirection: !isMagicMove,
      onError: (error) => console.error(`[pele] ${messageOf(error)}`),
      // Every draw replaces the SVG, so classes and size are applied again
      // after each.
      onRender: () => {
        if (isMagicMove) {
          onVersionDrawn(element);
        }
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
    if (isMagicMove) {
      // The click may have moved while the diagram type loaded.
      if (drawnText !== drawnVersions[versionIndex.value]) {
        drawVersion(versionIndex.value, false);
      }
      requestAnimationFrame(() => {
        settled = true;
      });
    }
  } catch (error) {
    // The diagram type's code failed to load: say so on the slide, which also
    // lets an export waiting for this diagram move on.
    console.error(`[pele] ${messageOf(error)}`);
    showError(element, error);
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  gliding?.stop();
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
