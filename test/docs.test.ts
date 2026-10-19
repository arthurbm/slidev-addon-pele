import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BLOCK_OPTIONS, DECK_SETTINGS } from "../src/diagram-block";
import { MAGIC_MOVE_OPTIONS } from "../src/magic-move";

const root = path.resolve(import.meta.dirname, "..");
const skillDir = path.join(root, "skills", "slidev-addon-pele");
const read = (file: string) => readFileSync(file, "utf-8");
const reference = read(path.join(skillDir, "references", "options.md"));
const readme = read(path.join(root, "README.md"));

// Headings that name an option in code, e.g. "## `scale`".
const HEADING_OPTION = /^#{2,4} `(?<name>[\w.]+)`/gmu;
// Table rows that start with an option in code, e.g. "| `scale` | …".
const ROW_OPTION = /^\| `(?<name>[\w.]+)`/gmu;
const LINK = /\]\((?<target>[^)#\s]+)\)/gu;
const HEADING = /^(?<level>#+) (?<title>.*)$/gmu;

const namesIn = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match.groups?.name);

/** The text under a heading, up to the next heading of the same level or above. */
const section = (text: string, title: string) => {
  const headings = [...text.matchAll(HEADING)];
  const start = headings.findIndex((match) => match.groups?.title === title);
  const heading = headings[start];
  if (!heading) {
    throw new Error(`no "${title}" heading`);
  }
  const level = heading.groups?.level?.length ?? 0;
  const end = headings
    .slice(start + 1)
    .find((match) => (match.groups?.level?.length ?? 0) <= level);
  return text.slice(heading.index, end?.index);
};

const deckSettings = DECK_SETTINGS.map((name) => `pele.${name}`);

describe("documentation", () => {
  it.each([
    ["Options", [...BLOCK_OPTIONS]],
    ["Deck settings", deckSettings],
    ["Magic-move options", [...MAGIC_MOVE_OPTIONS]],
  ])(
    "gives every option a section under %s in the skill's options reference",
    (title, names) => {
      expect(namesIn(section(reference, title), HEADING_OPTION)).toStrictEqual(
        expect.arrayContaining(names)
      );
    }
  );

  it.each([
    ["Options", [...BLOCK_OPTIONS, ...deckSettings]],
    ["Magic-move between versions", [...MAGIC_MOVE_OPTIONS]],
  ])("lists every option in the README's %s tables", (title, names) => {
    expect(namesIn(section(readme, title), ROW_OPTION)).toStrictEqual(
      expect.arrayContaining(names)
    );
  });

  it("names the skill as its folder and says when to use it", () => {
    const skill = read(path.join(skillDir, "SKILL.md"));
    const frontmatter = skill.match(/^---\n(?<yaml>[\s\S]*?)\n---\n/u)?.groups
      ?.yaml;

    expect(frontmatter).toMatch(/^name: slidev-addon-pele$/mu);
    expect(frontmatter).toMatch(/^description: \S.{40,}/mu);
  });

  it("links only to files the skill and the README ship", () => {
    const linked = [
      [skillDir, read(path.join(skillDir, "SKILL.md"))],
      [root, readme],
    ] as const;
    const targets = linked.flatMap(([dir, text]) =>
      [...text.matchAll(LINK)]
        .map((match) => match.groups?.target ?? "")
        .filter((target) => !target.includes("://"))
        .map((target) => path.join(dir, target))
    );

    expect(targets.length).toBeGreaterThan(1);
    expect(targets.filter((target) => !existsSync(target))).toStrictEqual([]);
  });
});
