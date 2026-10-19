// Runtime-dependency check: Pele is the only package a deck installs along
// with the addon. Run with `pnpm test:deps` (part of `pnpm check`).

import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf-8")
);

const runtimeFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundleDependencies",
  "bundledDependencies",
];

const found = runtimeFields.flatMap((field) => {
  const entries = manifest[field] ?? {};
  const names = Array.isArray(entries) ? entries : Object.keys(entries);
  return names.map((name) => ({ field, name }));
});

const extra = found.filter(({ name }) => name !== "pele");
const hasPele = found.some(
  ({ field, name }) => field === "dependencies" && name === "pele"
);

if (extra.length > 0 || !hasPele) {
  const problems = [
    ...extra.map(({ field, name }) => `"${name}" in ${field}`),
    ...(hasPele ? [] : ['"pele" missing from dependencies']),
  ];
  console.error(
    `[pele] Pele must be the addon's only runtime dependency: ${problems.join(", ")}.\n` +
      "  Move build and test tools to devDependencies; anything a deck needs at runtime must come from Pele or Slidev."
  );
  process.exitCode = 1;
} else {
  console.log("Pele is the only runtime dependency.");
}
