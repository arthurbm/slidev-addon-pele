import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";
import vue from "ultracite/oxlint/vue";

export default defineConfig({
  env: core.env,
  extends: [core, vue, vitest],
  ignorePatterns: [...(core.ignorePatterns ?? []), ".agents/**", ".claude/**"],
  overrides: [
    {
      // Slidev registers addon components by file name: `PeleDiagram.vue`
      // is `<PeleDiagram>`.
      files: ["components/*.vue"],
      rules: { "unicorn/filename-case": "off" },
    },
  ],
});
