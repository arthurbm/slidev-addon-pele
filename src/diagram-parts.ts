// What steps can name in a diagram, per diagram type, read from Pele's parsed
// model. Each type lists its parts by the `data-id` Pele renders on them, the
// ids an author can write in a step, and the edges that follow the automatic
// rule. Flowcharts and sequence diagrams have their own reader; every other
// type steps by the `data-id`s Pele draws.

import { render } from "pele/lazy";
import type {
  AgentflowModel,
  DiagramModel,
  FlowchartModel,
  SequenceModel,
} from "pele/lazy";

import { readDataIds } from "./data-ids";

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
  /** Parts drawn around others, which stay in view while any part inside is active. */
  containers: DiagramContainer[];
}

/** A part drawn around other parts, such as a kanban column around its cards. */
export interface DiagramContainer {
  /** The container's `data-id`. */
  id: string;
  /** The `data-id`s drawn inside it, at any depth. */
  parts: string[];
}

/**
 * What a diagram offers steps: its parts, or why there are none. A sequence
 * diagram without messages has nothing to number; some types draw parts
 * without ids; and a diagram Pele parses may still fail to draw.
 */
export type PartsReading =
  | { kind: "parts"; parts: DiagramParts }
  | { kind: "no-messages" }
  | { kind: "no-ids" }
  | { kind: "undrawable"; message: string };

const byId = (known: string[]): DiagramParts["resolve"] => {
  const ids = new Set(known);
  return (id) => (ids.has(id) ? [id] : undefined);
};

const flowchartParts = (
  model: FlowchartModel | AgentflowModel
): PartsReading => {
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
  return {
    kind: "parts",
    parts: { all, containers: [], edges, known, resolve: byId(known) },
  };
};

// Pele's sequence statement type for notes (`LINETYPE.NOTE`).
const NOTE = 2;
const RANGE = /^(?<first>\d+)(?:\s*-\s*(?<last>\d+))?$/u;

// Steps name messages by number, 1 for the first in the source, and ranges
// like `2-3`. Pele counts every statement (notes, loops, activations…), so
// message n is drawn as `i<id>` of the n-th statement that is a message. A
// note follows the message before it (the first message if none is), and
// participants stay in view.
const sequenceParts = (model: SequenceModel): PartsReading => {
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
    return { kind: "no-messages" };
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
    kind: "parts",
    parts: {
      all: statements.map((statement) => statement.id),
      containers: [],
      edges,
      known: messages.map((_, index) => String(index + 1)),
      resolve,
    },
  };
};

// Every other type: each `data-id` Pele draws can be named, edges included,
// and naming a part drawn around others names them too. Pele's model ids
// differ from the drawn ones for some types, so the ids come from a drawing.
const drawnParts = (model: DiagramModel): PartsReading => {
  let svg = "";
  try {
    ({ svg } = render(model));
  } catch (error) {
    return {
      kind: "undrawable",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const around = readDataIds(svg);
  const all = [...around.keys()];
  if (all.length === 0) {
    return { kind: "no-ids" };
  }
  const containers = all.flatMap((id) => {
    const parts = all.filter((part) => around.get(part)?.has(id));
    return parts.length > 0 ? [{ id, parts }] : [];
  });
  const contents = new Map(containers.map(({ id, parts }) => [id, parts]));
  const known = new Set(all);
  return {
    kind: "parts",
    parts: {
      all,
      containers,
      edges: [],
      known: all,
      resolve: (id) =>
        known.has(id) ? [id, ...(contents.get(id) ?? [])] : undefined,
    },
  };
};

/** The parts steps can name in a diagram, or why it has none. */
export const diagramParts = (model: DiagramModel): PartsReading => {
  switch (model.type) {
    case "agentflow":
    case "flowchart": {
      return flowchartParts(model);
    }
    case "sequence": {
      return sequenceParts(model);
    }
    default: {
      return drawnParts(model);
    }
  }
};
