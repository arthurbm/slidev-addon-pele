/**
 * The preset a diagram block is drawn with. `tone` narrows `auto` for
 * Mermaid theme names: `grey` drops the accent colours, `dark` forces the
 * dark variant whatever Slidev's colour mode.
 */
export interface Preset {
  name: "auto" | "flexoki";
  tone?: "grey" | "dark";
}

const AUTO: Preset = { name: "auto" };

// Preset names, then Mermaid's theme names mapped to the nearest preset.
const THEMES = new Map<string, Preset>([
  ["auto", AUTO],
  ["flexoki", { name: "flexoki" }],
  ["default", AUTO],
  ["base", AUTO],
  ["neutral", { name: "auto", tone: "grey" }],
  ["dark", { name: "auto", tone: "dark" }],
  ["forest", AUTO],
]);

const FOREST_WARNING =
  "[pele] Mermaid's \"forest\" theme has no Pele preset, so this diagram uses \"auto\". Set theme to 'auto' or 'flexoki', or style the diagram with --pele-* CSS variables.";

const unknownThemeWarning = (theme: unknown) =>
  `[pele] Unknown theme "${String(theme)}", so this diagram uses "auto". Use a preset (auto, flexoki) or a Mermaid theme name (default, base, neutral, dark, forest).`;

/**
 * Turns a `theme` value (the deck's `pele.theme` or a block's `theme`
 * option) into a preset. Never fails: an unusable value draws with `auto`
 * and says why.
 */
export const readPreset = (
  theme: unknown
): { preset: Preset; warnings: string[] } => {
  if (theme === undefined) {
    return { preset: AUTO, warnings: [] };
  }
  const preset = typeof theme === "string" ? THEMES.get(theme) : undefined;
  if (!preset) {
    return { preset: AUTO, warnings: [unknownThemeWarning(theme)] };
  }
  return { preset, warnings: theme === "forest" ? [FOREST_WARNING] : [] };
};
