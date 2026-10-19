// What steps can name in a diagram, per diagram type, read from Pele's parsed
// model. Each type lists its parts by the `data-id` Pele renders on them, the
// ids an author can write in a step, and the edges that follow the automatic
// rule. Adding steps to a diagram type means adding a reader here.

import type { DiagramModel, FlowchartModel } from "pele/lazy";

/** An edge between two parts. */
export interface DiagramEdge {
  /** The edge's `data-id`. */
  id: string;
  ends: [string, string];
}

/** The parts of one diagram, as steps see them. */
export interface DiagramParts {
  /** Every part's `data-id`, in the diagram's order. */
  all: string[];
  /** The ids an author can write in a step, in the diagram's order. */
  known: string[];
  /** Turns an id written in a step into the parts it names; `undefined` if unknown. */
  resolve: (id: string) => string[] | undefined;
  /** Edges, active on their own once both ends are, unless a step names them. */
  edges: DiagramEdge[];
}

const byId = (known: string[]): DiagramParts["resolve"] => {
  const ids = new Set(known);
  return (id) => (ids.has(id) ? [id] : undefined);
};

const flowchartParts = (model: FlowchartModel): DiagramParts => {
  // Subgraphs are in `nodes` too, under their own id.
  const nodes = [...model.nodes.keys()];
  const edges = model.edges.flatMap((edge) =>
    edge.id === undefined
      ? []
      : [{ ends: [edge.start, edge.end] as [string, string], id: edge.id }]
  );
  const named = model.edges.flatMap((edge) =>
    edge.isUserDefinedId && edge.id !== undefined ? [edge.id] : []
  );
  const all = [...nodes, ...edges.map((edge) => edge.id)];
  const known = [...nodes, ...named];
  return { all, edges, known, resolve: byId(known) };
};

/** The parts steps can name in a diagram, or `undefined` for a type without steps. */
export const diagramParts = (model: DiagramModel): DiagramParts | undefined => {
  switch (model.type) {
    case "flowchart": {
      return flowchartParts(model);
    }
    default: {
      return undefined;
    }
  }
};
