import { useSlideContext } from "@slidev/client";
import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import type { ShallowRef } from "vue";

import { indexAtClick } from "./clicks";

/**
 * Registers a diagram's clicks with the slide, the way Slidev's code blocks
 * and magic-move register theirs (one click per step or version after the
 * first, from `at`), and follows the index shown at the slide's click.
 * Call it in `setup`, before any other `onMounted`: Slidev counts a slide's
 * clicks once they are all mounted.
 */
export const useClickIndex = (
  at: string | number,
  count: number
): Readonly<ShallowRef<number>> => {
  const { $clicksContext: clicks } = useSlideContext();
  const id = `pele-${Math.random().toString(36).slice(2)}`;
  const index = shallowRef(Math.max(0, count - 1));
  if (count === 0) {
    return index;
  }
  onMounted(() => {
    const info = clicks.calculateSince(at, count - 1);
    clicks.register(id, info);
    watch(
      () => indexAtClick({ click: clicks.current, count, start: info?.start }),
      (value) => {
        index.value = value;
      },
      { immediate: true }
    );
  });
  onBeforeUnmount(() => {
    clicks.unregister(id);
  });
  return index;
};
