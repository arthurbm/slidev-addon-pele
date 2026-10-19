// The `data-id`s in Pele's SVG markup. Pele names every node, edge and part
// it draws with one, the same in every drawing of the diagram, so steps and
// magic-move both find parts by it.

const TAG = /<(?<close>\/?)[\w:-]+(?<attributes>[^>]*?)(?<selfClosing>\/?)>/gu;
const DATA_ID = /\sdata-id="(?<id>[^"]*)"/u;
const ENTITY =
  /&(?:#x(?<hex>[\da-f]+)|#(?<decimal>\d+)|(?<name>amp|lt|gt|quot|apos));/giu;
const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["quot", '"'],
]);

/** An attribute's value as Pele wrote it, entities decoded. */
const decodeAttribute = (value: string) =>
  value.replaceAll(ENTITY, (...match) => {
    const { decimal, hex, name = "" } = match.at(-1) as Record<string, string>;
    if (hex !== undefined) {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }
    if (decimal !== undefined) {
      return String.fromCodePoint(Number(decimal));
    }
    return NAMED_ENTITIES.get(name.toLowerCase()) ?? "";
  });

/**
 * Every `data-id` in Pele's SVG, in drawing order, with the ids drawn around
 * every one of its elements. An id that also appears outside a part (a
 * railroad rule referenced inside another rule) is not that part's content.
 */
export const readDataIds = (svg: string): Map<string, Set<string>> => {
  const around = new Map<string, Set<string>>();
  const open: (string | undefined)[] = [];
  for (const tag of svg.matchAll(TAG)) {
    const { attributes = "", close, selfClosing } = tag.groups ?? {};
    if (close) {
      open.pop();
      continue;
    }
    const raw = attributes.match(DATA_ID)?.groups?.id;
    const id = raw === undefined ? undefined : decodeAttribute(raw);
    if (id !== undefined) {
      const outer = open.filter(
        (other): other is string => other !== undefined && other !== id
      );
      const previous = around.get(id);
      around.set(
        id,
        new Set(previous ? outer.filter((other) => previous.has(other)) : outer)
      );
    }
    if (!selfClosing) {
      open.push(id);
    }
  }
  return around;
};

/** The distinct `data-id`s in Pele's SVG, in drawing order. */
export const dataIds = (svg: string): string[] => [...readDataIds(svg).keys()];
