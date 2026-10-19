// Pack check: what users install is what was tested. Packs the addon,
// installs the tarball into an empty deck the way a presenter would, builds
// the deck and checks in a browser that its diagram block is drawn by Pele.
//
// Run with `pnpm test:pack` (npm, the default of `npm init slidev`) or
// `pnpm test:pack pnpm`. Needs agent-browser, like the browser suite.

import { execFile, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../../", import.meta.url));
const packageManager = process.argv[2] ?? "npm";
if (!["npm", "pnpm"].includes(packageManager)) {
  throw new Error(
    `Unknown package manager "${packageManager}": use npm or pnpm.`
  );
}

// Folders Slidev loads from an addon root, plus the addon's own source and
// agent skill. Every tracked file in them must reach the tarball.
const addonFolders = [
  "components",
  "layouts",
  "public",
  "setup",
  "skills",
  "src",
  "styles",
];

const run = (command, args, cwd) => {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

const read = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf-8" }).trim();

/** Packs the addon as it would be published, without lifecycle scripts (`prepare` installs git hooks). */
const pack = (destination) => {
  const output = read(
    "pnpm",
    [
      "pack",
      "--config.ignore-scripts=true",
      "--json",
      "--pack-destination",
      destination,
    ],
    root
  );
  const { filename, files } = JSON.parse(output.slice(output.indexOf("{")));
  return { files: files.map((file) => file.path), tarball: filename };
};

const checkPublishedFiles = (published) => {
  const tracked = read("git", ["ls-files", "--", ...addonFolders], root)
    .split("\n")
    .filter(Boolean);
  const missing = tracked.filter((file) => !published.includes(file));
  if (missing.length > 0) {
    throw new Error(
      `Files the addon needs are not in the package: ${missing.join(", ")}.\n` +
        `  Add their folders to "files" in package.json (published: ${published.join(", ")}).`
    );
  }
};

const slides = `---
title: Pack check
addons:
  - pele
---

\`\`\`mermaid
flowchart LR
  user[User] --> agent[Agent]
  agent --> llm[LLM]
\`\`\`
`;

/** An empty deck with the tarball installed, as `npm init slidev` / `pnpm create slidev` leave it. */
const createDeck = async (deck, tarball) => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf-8")
  );
  const slidev = `^${manifest.devDependencies["@slidev/cli"]}`;
  const dependencies = {
    "@slidev/cli": slidev,
    "@slidev/theme-default": "latest",
    "slidev-addon-pele": `file:${tarball}`,
    vue: "^3.5.0",
  };
  if (packageManager === "pnpm") {
    // Slidev 53 under pnpm links @comark/markdown-it to markdown-it 15, which
    // crashes every deck, with or without this addon
    // (https://github.com/slidevjs/slidev/issues/2761). A deck-level
    // markdown-it 14 is the fix the README gives pnpm users.
    dependencies["markdown-it"] = "^14.3.3";
    // What `pnpm create slidev` writes.
    await writeFile(
      path.join(deck, "pnpm-workspace.yaml"),
      "shamefullyHoist: true\nallowBuilds:\n  playwright-chromium: true\n"
    );
  }
  await writeFile(
    path.join(deck, "package.json"),
    `${JSON.stringify({ dependencies, name: "pack-check", private: true, type: "module" }, null, 2)}\n`
  );
  await writeFile(path.join(deck, "slides.md"), slides);
};

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Serves a built deck, falling back to index.html for Slidev's history routes. */
const serve = async (dist) => {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const requested = path.join(
      dist,
      path.normalize(decodeURIComponent(pathname))
    );
    const found = await stat(requested).catch(() => null);
    const file =
      requested.startsWith(dist) && found?.isFile()
        ? requested
        : path.join(dist, "index.html");
    response.setHeader(
      "content-type",
      contentTypes[path.extname(file)] ?? "application/octet-stream"
    );
    createReadStream(file).pipe(response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
};

const browserEnv = {
  ...process.env,
  AGENT_BROWSER_ARGS: process.env.AGENT_BROWSER_ARGS ?? "--no-sandbox",
  AGENT_BROWSER_SESSION: `pele-pack-${process.pid}`,
};

// Asynchronous, so the deck server in this process keeps answering.
const browser = (...args) =>
  promisify(execFile)("agent-browser", args, {
    encoding: "utf-8",
    env: browserEnv,
  });

const checkDiagramIsDrawn = async (dist) => {
  const server = await serve(dist);
  try {
    await browser("open", `http://127.0.0.1:${server.address().port}/`);
    const nodes = ["user", "agent", "llm"]
      .map((id) => `:has([data-id="${id}"])`)
      .join("");
    await browser("wait", `.slidev-page-1 .pele-diagram svg${nodes}`);
  } catch (error) {
    throw new Error(
      "The built deck does not show the diagram block drawn by Pele " +
        `(.pele-diagram with nodes user, agent, llm):\n  ${error.message}`,
      { cause: error }
    );
  } finally {
    try {
      await browser("close");
    } catch {
      // Already closed.
    }
    server.close();
  }
};

const workspace = await mkdtemp(path.join(tmpdir(), "pele-pack-"));
const deck = path.join(workspace, "deck");
let passed = false;
try {
  const { files, tarball } = pack(workspace);
  console.log(`Packed ${tarball}:\n  ${files.join("\n  ")}`);
  checkPublishedFiles(files);
  await mkdir(deck);
  await createDeck(deck, tarball);
  run(
    packageManager,
    packageManager === "pnpm"
      ? ["install", "--no-frozen-lockfile"]
      : ["install"],
    deck
  );
  run(packageManager, ["exec", "slidev", "build"], deck);
  await checkDiagramIsDrawn(path.join(deck, "dist"));
  passed = true;
} catch (error) {
  console.error(`\n✗ ${error.message}\n  Kept for inspection: ${workspace}`);
  process.exitCode = 1;
} finally {
  if (passed) {
    await rm(workspace, { force: true, recursive: true });
    console.log(
      `\n✓ The packed addon installs with ${packageManager}, builds and draws its diagram block.`
    );
  }
}
