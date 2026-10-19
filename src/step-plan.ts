// The step plan: which parts of a diagram are active, receding or hidden at
// each step. Pure: it reads Pele's parsed model and never touches the DOM, so
// it runs the same in Node (tests, the transformer) and in the browser.
//
// Parts are named by the `data-id` Pele puts on their SVG elements.

import { parse } from "pele/lazy";

import { diagramParts } from "./diagram-parts";
import type { DiagramContainer, DiagramEdge } from "./diagram-parts";

/** Focus mode emphasises each step's parts; reveal mode builds the diagram up. */
export type StepMode = "focus" | "reveal";

export interface StepPlanInput {
  /** The diagram block's Mermaid source. Its diagram type must be loaded. */
  source: string;
  /** The steps as written in the fence, e.g. `user|agent,llm|*`. */
  steps: string;
  mode: StepMode;
}

/** A plan for a diagram block's steps, ready to be read at any step. */
export interface Plan {
  kind: "plan";
  mode: StepMode;
  stepCount: number;
  /** Every part the plan classifies, in the diagram's order. */
  parts: string[];
  /** The parts each step names, edges not included (`*` names every part). */
  named: Set<string>[];
  /** Edges that no step names, so they are active once both ends are. */
  automaticEdges: DiagramEdge[];
  /** Parts drawn around others, active while any part inside them is. */
  containers: DiagramContainer[];
}

/** Why a diagram block's steps cannot be applied. */
export type StepError =
  | { kind: "unknown-ids"; unknown: string[]; known: string[] }
  | { kind: "no-steps"; type: string }
  /** Pele cannot read the diagram; Pele itself shows why on the slide. */
  | { kind: "unreadable" };

export type StepPlan = Plan | StepError;

/** The state of every part at one step. */
export interface PartStates {
  active: string[];
  receding: string[];
  hidden: string[];
}

const EVERYTHING = "*";

/**
 * Splits steps with the grammar of code line highlighting: `|` separates
 * steps, `,` joins ids. `user|agent,llm|*` is three steps.
 */
export const splitSteps = (steps: string): string[][] =>
  steps.split("|").map((step) =>
    step
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "")
  );

const readModel = (source: string) => {
  try {
    return parse(source);
  } catch {
    return null;
  }
};

export const planSteps = (input: StepPlanInput): StepPlan => {
  const model = readModel(input.source);
  if (!model) {
    return { kind: "unreadable" };
  }
  const parts = diagramParts(model);
  if (!parts) {
    return { kind: "no-steps", type: model.type };
  }

  const steps = splitSteps(input.steps);
  const unknown: string[] = [];
  const named = steps.map((ids) => {
    if (ids.includes(EVERYTHING)) {
      return new Set(parts.all);
    }
    return new Set(
      ids.flatMap((id) => {
        const resolved = parts.resolve(id);
        if (!resolved && !unknown.includes(id)) {
          unknown.push(id);
        }
        return resolved ?? [];
      })
    );
  });
  if (unknown.length > 0) {
    return { kind: "unknown-ids", known: parts.known, unknown };
  }

  // A step that names an edge takes it out of the automatic rule; `*` does not.
  const namedEdges = new Set(
    steps.flatMap((ids, index) =>
      ids.includes(EVERYTHING) ? [] : [...(named[index] ?? [])]
    )
  );
  return {
    automaticEdges: parts.edges.filter((edge) => !namedEdges.has(edge.id)),
    containers: parts.containers,
    kind: "plan",
    mode: input.mode,
    named,
    parts: parts.all,
    stepCount: steps.length,
  };
};

/** The state of every part at step `index` (0 is the step shown first). */
export const partsAt = (plan: Plan, index: number): PartStates => {
  const last = Math.max(0, Math.min(index, plan.stepCount - 1));
  const steps =
    plan.mode === "reveal" ? plan.named.slice(0, last + 1) : [plan.named[last]];
  const active = new Set(steps.flatMap((step) => [...(step ?? [])]));
  // A container stays in view while a part inside it is active.
  for (const container of plan.containers) {
    if (container.parts.some((part) => active.has(part))) {
      active.add(container.id);
    }
  }
  for (const edge of plan.automaticEdges) {
    if (edge.ends.every((end) => active.has(end))) {
      active.add(edge.id);
    }
  }
  const inactive = plan.parts.filter((part) => !active.has(part));
  return {
    active: plan.parts.filter((part) => active.has(part)),
    hidden: plan.mode === "reveal" ? inactive : [],
    receding: plan.mode === "focus" ? inactive : [],
  };
};

const quoted = (ids: string[]) => ids.map((id) => `"${id}"`).join(", ");

/** What to tell the presenter, naming the fix. */
export const describeStepError = (error: StepError): string => {
  switch (error.kind) {
    case "unknown-ids": {
      const label =
        error.unknown.length === 1 ? "Unknown step id" : "Unknown step ids";
      return `${label} ${quoted(error.unknown)}. Use the ids of the diagram: ${error.known.join(", ")}.`;
    }
    case "no-steps": {
      return error.type === "xychart"
        ? 'Steps are not available for xychart diagrams whose series have no title. Give each series a title (bar "Sales" [10, 50]) and use the titles as step ids, or remove the {…} steps from the fence.'
        : `Steps are not available for ${error.type} diagrams: Pele gives their parts no ids. Remove the {…} steps from the fence.`;
    }
    case "unreadable": {
      return "The diagram cannot be read, so its steps cannot be applied. Fix the diagram first.";
    }
    default: {
      return "";
    }
  }
};
