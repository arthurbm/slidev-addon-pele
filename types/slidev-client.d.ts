// The part of `@slidev/client` the addon uses. The package ships its client as
// TypeScript source that only type-checks inside a Slidev build, so the
// typecheck reads this declaration instead (see `paths` in tsconfig.json).
// At runtime Vite resolves the real package.

import type { ClicksContext, RenderContext } from "@slidev/types";
import type { ComputedRef, Ref } from "vue";

export declare const useSlideContext: () => {
  $clicksContext: ClicksContext;
  $renderContext: Ref<RenderContext>;
};

export declare const useNav: () => {
  /** Exporting or printing: every click is drawn at rest. */
  isPrintMode: ComputedRef<boolean>;
};

export declare const useDarkMode: () => {
  /** Whether Slidev shows the deck in dark mode. */
  isDark: Ref<boolean>;
};

/** The deck's resolved headmatter settings. */
export declare const configs: {
  /** How long a magic-move takes, in milliseconds (Slidev's default 800). */
  magicMoveDuration: number;
};
