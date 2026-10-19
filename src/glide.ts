// Moves a Pele drawing from one version to the next, in the browser. The new
// drawing is already in the page; every part both versions have starts where
// it was in the old one and glides to its new place, parts only in the new one
// fade in, and parts only in the old one fade out as ghosts. Pele's drawings
// are flat (a `translate` per node, absolute rects for subgraphs, `M/L/C`
// paths for edges), so attributes are tweened directly, with no library.

import { changeBetween } from "./versions";

/** A glide under way. */
export interface Glide {
  /** Stops where every part is now, so the next glide starts from there. */
  stop: () => void;
}

/** Sets one frame of a tween, for an eased time from 0 to 1. */
type Tween = (time: number) => void;

const NEW_PARTS_DELAY = 0.4;
const OLD_PARTS_END = 0.5;

const ease = (time: number) =>
  time < 0.5 ? 4 * time ** 3 : 1 - (-2 * time + 2) ** 3 / 2;
const between = (from: number, to: number, time: number) =>
  Math.round((from + (to - from) * time) * 100) / 100;
const clamp = (time: number) => Math.min(1, Math.max(0, time));

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu;
const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map(Number);
const shapeOf = (text: string) => text.replaceAll(NUMBER, "#");

/**
 * Tweens an attribute made of numbers (a `transform`, a `d`, a `viewBox`)
 * from its value in `from` to its value in `to`, when both have the same
 * shape. The last frame writes Pele's own value back.
 */
const tweenAttribute = (
  to: Element,
  from: Element,
  name: string
): Tween | undefined => {
  const end = to.getAttribute(name);
  const start = from.getAttribute(name);
  if (end === null || start === null || start === end) {
    return undefined;
  }
  if (shapeOf(start) !== shapeOf(end)) {
    return undefined;
  }
  const starts = numbersIn(start);
  const ends = numbersIn(end);
  return (time) => {
    if (time >= 1) {
      to.setAttribute(name, end);
      return;
    }
    let index = 0;
    to.setAttribute(
      name,
      end.replaceAll(NUMBER, () => {
        const value = between(starts[index] ?? 0, ends[index] ?? 0, time);
        index += 1;
        return String(value);
      })
    );
  };
};

const tweenAttributes = (to: Element, from: Element, names: string[]) =>
  names.flatMap((name) => tweenAttribute(to, from, name) ?? []);

const fade = (
  part: SVGElement,
  from: number,
  to: number,
  [start, end]: [number, number]
): Tween => {
  part.style.opacity = String(from);
  return (time) => {
    if (time >= 1) {
      part.style.opacity = to === 1 ? "" : String(to);
      return;
    }
    const local = clamp((time - start) / (end - start));
    part.style.opacity = String(between(from, to, local));
  };
};

/** How opaque a part was in the old drawing, mid-fade or not. */
const opacityOf = (part: SVGElement) =>
  part.style.opacity === "" ? 1 : Number(part.style.opacity);

/** `data-id` and the part's kind: an edge and its label share an id. */
const keyOf = (part: SVGElement) =>
  `${part.classList.item(0) ?? ""} ${part.dataset.id ?? ""}`;

const partsOf = (svg: SVGSVGElement) => {
  const parts = new Map<string, SVGElement>();
  for (const part of svg.querySelectorAll<SVGElement>("[data-id]")) {
    parts.set(keyOf(part), part);
  }
  return parts;
};

const RECT = ["x", "y", "width", "height"];

/** A node or subgraph in both versions: it moves, and its box resizes. */
const moveBox = (to: SVGElement, from: SVGElement): Tween[] => {
  const tweens = tweenAttributes(to, from, ["transform"]);
  const toRect = to.querySelector(":scope > rect");
  const fromRect = from.querySelector(":scope > rect");
  if (toRect && fromRect) {
    tweens.push(...tweenAttributes(toRect, fromRect, RECT));
  }
  // A subgraph's title is placed on its own, not inside a `translate`.
  const toText = to.querySelector(":scope > text");
  const fromText = from.querySelector(":scope > text");
  if (toText && fromText) {
    tweens.push(...tweenAttributes(toText, fromText, ["x", "y"]));
  }
  return tweens;
};

/** An edge in both versions: its paths morph when they have the same shape. */
const morphEdge = (to: SVGElement, from: SVGElement): Tween[] | undefined => {
  const toPaths = [...to.querySelectorAll("path")];
  const fromPaths = [...from.querySelectorAll("path")];
  if (toPaths.length !== fromPaths.length) {
    return undefined;
  }
  const sameShape = toPaths.every(
    (path, index) =>
      shapeOf(path.getAttribute("d") ?? "") ===
      shapeOf(fromPaths[index]?.getAttribute("d") ?? "")
  );
  if (!sameShape) {
    return undefined;
  }
  return toPaths.flatMap((path, index) => {
    const fromPath = fromPaths[index];
    return fromPath ? tweenAttributes(path, fromPath, ["d"]) : [];
  });
};

/**
 * Leaves a copy of an old part in the new drawing, in the same layer, so it
 * can fade out where it was.
 */
const leaveGhost = (
  part: SVGElement,
  svg: SVGSVGElement,
  ghosts: Element[]
): SVGElement => {
  const layerClass = part.parentElement?.classList.item(0);
  let layer = layerClass
    ? svg.querySelector(`:scope > g.${CSS.escape(layerClass)}`)
    : null;
  if (!layer && part.parentElement) {
    // A layer the new drawing lacks (subgraphs, edges) sits behind the nodes.
    layer = part.parentElement.cloneNode(false) as Element;
    svg.prepend(layer);
    ghosts.push(layer);
  }
  const ghost = part.cloneNode(true) as SVGElement;
  ghost.dataset.peleGhost = "";
  delete ghost.dataset.id;
  (layer ?? svg).append(ghost);
  ghosts.push(ghost);
  return ghost;
};

/** The tweens that take every part from the old drawing to the new one. */
const plan = (from: SVGSVGElement, to: SVGSVGElement, ghosts: Element[]) => {
  const before = partsOf(from);
  const after = partsOf(to);
  const change = changeBetween(before.keys(), after.keys());
  // The canvas grows or shrinks with the diagram, at a constant scale.
  const tweens = tweenAttributes(to, from, ["viewBox", "width", "height"]);

  for (const key of change.enter) {
    const part = after.get(key);
    if (part) {
      // Once the parts that stay have made room.
      tweens.push(fade(part, 0, 1, [NEW_PARTS_DELAY, 1]));
    }
  }
  const leaving = [...change.leave];
  for (const key of change.glide) {
    const part = after.get(key);
    const old = before.get(key);
    if (!part || !old) {
      continue;
    }
    const isEdge = part.classList.contains("pele-edge");
    const moves = isEdge ? morphEdge(part, old) : moveBox(part, old);
    if (moves) {
      tweens.push(...moves);
      if (opacityOf(old) < 1) {
        // It was still fading in when this glide began.
        tweens.push(fade(part, opacityOf(old), 1, [0, 1]));
      }
    } else {
      // The same edge on another route: cross-fade.
      tweens.push(fade(part, 0, 1, [NEW_PARTS_DELAY, 1]));
      leaving.push(key);
    }
  }
  for (const key of leaving) {
    const old = before.get(key);
    if (old) {
      const ghost = leaveGhost(old, to, ghosts);
      tweens.push(fade(ghost, opacityOf(old), 0, [0, OLD_PARTS_END]));
    }
  }
  return tweens;
};

/**
 * Glides from the drawing `from` (no longer in the page) to `to` (just put
 * in its place) over `duration` milliseconds.
 */
export const glide = (
  from: SVGSVGElement,
  to: SVGSVGElement,
  duration: number
): Glide => {
  const ghosts: Element[] = [];
  const tweens = plan(from, to, ghosts);
  const draw = (time: number) => {
    for (const tween of tweens) {
      tween(time);
    }
  };
  // Every part starts where it was, before the page paints the new drawing.
  draw(0);

  let frame = 0;
  const started = performance.now();
  const tick = (now: number) => {
    const time = clamp((now - started) / Math.max(1, duration));
    if (time >= 1) {
      draw(1);
      for (const ghost of ghosts) {
        ghost.remove();
      }
      return;
    }
    draw(ease(time));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    stop: () => cancelAnimationFrame(frame),
  };
};
