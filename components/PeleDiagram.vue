<script setup lang="ts">
import { mountAsync } from "pele/lazy";
import type { Mounted } from "pele/lazy";
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";

import { decodeSource } from "../src/source-prop";

const { source } = defineProps<{
  /** The diagram block's Mermaid source, encoded by the transformer. */
  source: string;
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const mounted = shallowRef<Mounted>();
let unmounted = false;

onMounted(async () => {
  const element = container.value;
  if (!element) {
    return;
  }
  // Pele's lazy entry loads only the code for this block's diagram type.
  // `mountAsync` draws at the container's width, re-draws when that width
  // changes or web fonts finish loading, and measures text with the
  // container's computed font, which is the slide's.
  const instance = await mountAsync(element, decodeSource(source), {
    onError: (error) => console.error("[pele]", error),
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
  <div ref="container" class="pele-diagram" />
</template>

<style>
.pele-diagram {
  width: 100%;
}
</style>
