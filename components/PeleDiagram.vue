<script setup lang="ts">
import { mountAsync } from "pele/lazy";
import type { Mounted } from "pele/lazy";
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";

import { findAnimatedEdges } from "../src/animated-edges";
import type { AnimatedEdge } from "../src/animated-edges";
import type { Preset } from "../src/preset";
import { decodeSource } from "../src/source-prop";

// Fence options Pele has no use for (Slidev binds them all) are not put on
// the element as attributes.
defineOptions({ inheritAttrs: false });

const {
  source,
  preset = "auto",
  tone = "none",
  scale,
} = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source: string;
  /** The preset's CSS variables apply through `data-pele-preset`. */
  preset?: Preset["name"];
  tone?: NonNullable<Preset["tone"]> | "none";
  /** The diagram's height is its natural height times this, as in Slidev. */
  // oxlint-disable-next-line vue/require-default-prop -- no scale means the natural size, as in Slidev
  scale?: number;
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const mounted = shallowRef<Mounted>();
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

onMounted(async () => {
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
      onRender: () => {
        markAnimatedEdges(element);
        applyScale(element);
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
  mounted.value?.destroy();
});
</script>

<template>
  <!-- Slidev's exporter waits until a drawing or an error is shown. -->
  <div
    ref="container"
    class="pele-diagram"
    data-waitfor="svg.pele, .pele-error"
    :data-pele-preset="preset"
    :data-pele-tone="tone"
  />
</template>

<style>
.pele-diagram {
  width: 100%;
}

.pele-diagram > .pele-error {
  color: var(--pele-error, #e45756);
  font-family: var(--slidev-code-font-family, monospace);
  white-space: pre-wrap;
}
</style>
