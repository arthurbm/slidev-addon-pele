// A magic-move in the browser: one Pele drawing that shows one version at a
// time. A click gives Pele the next version's text and, once it is drawn,
// glides from the old drawing. Every version runs the way `inOneDirection`
// decides for the width and font there are, decided again when they change.

import { useNav, useSlideContext } from "@slidev/client";
import { detectType, load } from "pele/lazy";
import type { Mounted } from "pele/lazy";
import { onBeforeUnmount, watch } from "vue";
import type { ShallowRef } from "vue";

import { glide } from "./glide";
import type { Glide } from "./glide";
import { inOneDirection } from "./versions";

/** What the versions' direction was last decided for. */
interface DrawnFor {
  maxWidth: number;
  fontFamily: string;
  fontsLoaded: boolean;
}

const sameDrawing = (a: DrawnFor | undefined, b: DrawnFor) =>
  a?.maxWidth === b.maxWidth &&
  a.fontFamily === b.fontFamily &&
  a.fontsLoaded === b.fontsLoaded;

const drawingIn = (element: HTMLElement) =>
  element.querySelector<SVGSVGElement>(":scope > svg.pele") ?? undefined;

export interface MagicMoveOptions {
  /** Each version's Mermaid source. */
  versions: string[];
  /** The index of the version the slide's click shows. */
  index: Readonly<ShallowRef<number>>;
  /** How long a glide takes, in milliseconds. */
  duration: number;
}

export const useMagicMove = ({
  versions,
  index,
  duration,
}: MagicMoveOptions) => {
  const { $renderContext: renderContext } = useSlideContext();
  const { isPrintMode } = useNav();
  /** The versions as drawn: all in one direction for the width there is. */
  let drawnVersions = versions;
  let drawnFor: DrawnFor | undefined;
  let mounted: Mounted | undefined;
  let element: HTMLElement | undefined;
  /** The version Pele was last given to draw. */
  let shownIndex = index.value;
  let gliding: Glide | undefined;
  /** The drawing to glide from when Pele next draws. */
  let glideFrom: SVGSVGElement | undefined;
  /** Like Slidev's magic-move, the first version shown does not glide in. */
  let settled = false;

  /** Decides again which way the versions run; whether that changed them. */
  const orient = (container: HTMLElement): boolean => {
    const next: DrawnFor = {
      fontFamily: getComputedStyle(container).fontFamily,
      fontsLoaded: document.fonts.status === "loaded",
      maxWidth: container.clientWidth,
    };
    if (sameDrawing(drawnFor, next)) {
      return false;
    }
    drawnFor = next;
    const oriented = inOneDirection(versions, next);
    const changed = oriented.some(
      (version, at) => version !== drawnVersions[at]
    );
    drawnVersions = oriented;
    return changed;
  };

  // The live slide and the presenter's glide; the next-click preview, the
  // overview, print and export, and viewers who prefer reduced motion swap.
  const glides = (container: HTMLElement) =>
    settled &&
    ["slide", "presenter"].includes(renderContext.value) &&
    !isPrintMode.value &&
    container.clientWidth > 0 &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;

  const draw = (animate: boolean) => {
    if (!mounted || !element) {
      return;
    }
    shownIndex = index.value;
    glideFrom = animate && glides(element) ? drawingIn(element) : undefined;
    // Pele draws at once, calling `drawn`, unless the slide is hidden.
    mounted.update(drawnVersions[shownIndex] ?? "");
    glideFrom = undefined;
  };

  watch(index, (value) => {
    if (value !== shownIndex) {
      draw(true);
    }
  });

  onBeforeUnmount(() => {
    gliding?.stop();
  });

  return {
    /** The text Pele draws now. */
    current: () => drawnVersions[shownIndex] ?? "",

    /** After each draw: glide to it, or settle where it is. */
    drawn: (container: HTMLElement) => {
      // A glide still under way stops where its parts are, and the next one
      // starts from there.
      gliding?.stop();
      gliding = undefined;
      const drawing = drawingIn(container);
      if (glideFrom && drawing && glideFrom !== drawing) {
        gliding = glide(glideFrom, drawing, duration);
      }
      if (orient(container)) {
        queueMicrotask(() => draw(false));
      }
    },

    /** Loads every version's diagram type and decides their direction. */
    prepare: async (container: HTMLElement) => {
      element = container;
      await Promise.all(
        versions.map(async (version) => {
          try {
            return await load(detectType(version));
          } catch {
            // The version shows Pele's error when it is drawn.
            return false;
          }
        })
      );
      orient(container);
      shownIndex = index.value;
    },

    /** Once Pele has drawn the first version. */
    start: (instance: Mounted) => {
      mounted = instance;
      // The click may have moved while the diagram types loaded.
      if (shownIndex !== index.value) {
        draw(false);
      }
      requestAnimationFrame(() => {
        settled = true;
      });
    },
  };
};
