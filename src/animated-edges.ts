import { parse } from "pele/lazy";

/** An edge the addon animates; its id is the edge's `data-id` in the SVG. */
export interface AnimatedEdge {
  id: string;
  speed: "fast" | "slow";
}

interface ModelEdge {
  id?: unknown;
  animate?: unknown;
  animation?: unknown;
}

/**
 * The edges marked `animate: true` or given an `animation` speed, as in
 * Mermaid. Pele parses these flags but draws the edges still, so the addon
 * animates them. Expects the diagram type to be loaded already (the diagram
 * component calls this after Pele has drawn the block).
 */
export const findAnimatedEdges = (source: string): AnimatedEdge[] => {
  let edges: unknown;
  try {
    ({ edges } = parse(source) as { edges?: unknown });
  } catch {
    // Pele shows the syntax error itself; there is nothing to animate.
    return [];
  }
  if (!Array.isArray(edges)) {
    return [];
  }
  return (edges as ModelEdge[]).flatMap(({ id, animate, animation }) => {
    const animated =
      animate === true || animation === "fast" || animation === "slow";
    if (!animated || typeof id !== "string") {
      return [];
    }
    return [{ id, speed: animation === "slow" ? "slow" : "fast" }];
  });
};
