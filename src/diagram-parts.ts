// What steps can name in a diagram, per diagram type, read from Pele's parsed
// model. Each type lists its parts by the `data-id` Pele renders on them, the
// ids an author can write in a step, and the edges that follow the automatic
// rule. Adding steps to a diagram type means adding a reader here.

import type { DiagramModel, FlowchartModel, SequenceModel } from "pele/lazy";

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

// Pele's sequence statement type for notes (`LINETYPE.NOTE`).
const NOTE = 2;
const RANGE = /^(?<first>\d+)(?:\s*-\s*(?<last>\d+))?$/u;

// Steps name messages by number, 1 for the first in the source, and ranges
// like `2-3`. Pele counts every statement (notes, loops, activations…), so
// message n is drawn as `i<id>` of the n-th statement that is a message. A
// note follows the message before it (the first message if none is), and
// participants stay in view.
const sequenceParts = (model: SequenceModel): DiagramParts | undefined => {
  const statements = model.messages.flatMap<{
    id: string;
    kind: "message" | "note";
  }>((statement) => {
    if (statement.type === NOTE) {
      return [{ id: `i${statement.id}`, kind: "note" }];
    }
    if (statement.from !== undefined && statement.to !== undefined) {
      return [{ id: `i${statement.id}`, kind: "message" }];
    }
    return [];
  });
  const messages = statements.flatMap((statement) =>
    statement.kind === "message" ? [statement.id] : []
  );
  const [firstMessage] = messages;
  if (firstMessage === undefined) {
    return undefined;
  }
  let lastMessage = firstMessage;
  const edges: DiagramEdge[] = [];
  for (const statement of statements) {
    if (statement.kind === "message") {
      lastMessage = statement.id;
    } else {
      edges.push({ ends: [lastMessage, lastMessage], id: statement.id });
    }
  }
  const resolve: DiagramParts["resolve"] = (id) => {
    const groups = id.match(RANGE)?.groups;
    if (!groups) {
      return;
    }
    const first = Number(groups.first);
    const last = groups.last === undefined ? first : Number(groups.last);
    if (first < 1 || last < first || last > messages.length) {
      return;
    }
    return messages.slice(first - 1, last);
  };
  return {
    all: statements.map((statement) => statement.id),
    edges,
    known: messages.map((_, index) => String(index + 1)),
    resolve,
  };
};

/** The parts steps can name in a diagram, or `undefined` for a type without steps. */
export const diagramParts = (model: DiagramModel): DiagramParts | undefined => {
  switch (model.type) {
    case "flowchart": {
      return flowchartParts(model);
    }
    case "sequence": {
      return sequenceParts(model);
    }
    default: {
      return undefined;
    }
  }
};
