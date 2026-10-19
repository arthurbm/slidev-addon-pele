// The part of `@slidev/client` the addon uses. The package ships its client as
// TypeScript source that only type-checks inside a Slidev build, so the
// typecheck reads this declaration instead (see `paths` in tsconfig.json).
// At runtime Vite resolves the real package.

import type { ClicksContext } from "@slidev/types";

export declare const useSlideContext: () => {
  $clicksContext: ClicksContext;
};
