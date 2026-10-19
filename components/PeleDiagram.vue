<script setup lang="ts">
import { mountAsync } from "pele/lazy";
import type { Mounted } from "pele/lazy";
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";

import { findAnimatedEdges } from "../src/animated-edges";
import type { AnimatedEdge } from "../src/animated-edges";
import type { Preset } from "../src/preset";
import { decodeSource } from "../src/source-prop";

const {
  source,
  preset = "auto",
  tone = "none",
} = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source: string;
  /** The preset's CSS variables apply through `data-pele-preset`. */
  preset?: Preset["name"];
  tone?: NonNullable<Preset["tone"]> | "none";
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const mounted = shallowRef<Mounted>();
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

onMounted(async () => {
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
    onRender: () => markAnimatedEdges(element),
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
  mounted.value?.destroy();
});
</script>

<template>
  <div
    ref="container"
    class="pele-diagram"
    :data-pele-preset="preset"
    :data-pele-tone="tone"
  />
</template>

<style>
.pele-diagram {
  width: 100%;
}
</style>
