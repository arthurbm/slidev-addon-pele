import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BLOCK_OPTIONS } from "../src/diagram-block";

const root = path.resolve(import.meta.dirname, "..");
const skillDir = path.join(root, "skills", "slidev-addon-pele");
const read = (file: string) => readFileSync(file, "utf-8");

// Headings that name an option in code, e.g. "## `scale`".
const HEADING_OPTION = /^#{2,4} `(?<name>\w+)`/gmu;
// Table rows that start with an option in code, e.g. "| `scale` | …".
const ROW_OPTION = /^\| `(?<name>\w+)`/gmu;
const LINK = /\]\((?<target>[^)#\s]+)\)/gu;

const namesIn = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match.groups?.name);

describe("documentation", () => {
  it("gives every option a diagram block accepts a section in the skill's options reference", () => {
    const reference = read(path.join(skillDir, "references", "options.md"));

    expect(namesIn(reference, HEADING_OPTION)).toStrictEqual(
      expect.arrayContaining([...BLOCK_OPTIONS])
    );
  });

  it("lists every option a diagram block accepts in the README's options table", () => {
    const readme = read(path.join(root, "README.md"));

    expect(namesIn(readme, ROW_OPTION)).toStrictEqual(
      expect.arrayContaining([...BLOCK_OPTIONS])
    );
  });

  it("names the skill as its folder and says when to use it", () => {
    const skill = read(path.join(skillDir, "SKILL.md"));
    const frontmatter = skill.match(/^---\n(?<yaml>[\s\S]*?)\n---\n/u)?.groups
      ?.yaml;

    expect(frontmatter).toMatch(/^name: slidev-addon-pele$/mu);
    expect(frontmatter).toMatch(/^description: \S.{40,}/mu);
  });

  it("links only to files the skill ships", () => {
    const skill = read(path.join(skillDir, "SKILL.md"));
    const targets = [...skill.matchAll(LINK)]
      .map((match) => match.groups?.target ?? "")
      .filter((target) => !target.includes("://"));

    expect(targets.length).toBeGreaterThan(0);
    expect(
      targets.filter((target) => !existsSync(path.join(skillDir, target)))
    ).toStrictEqual([]);
  });
});
