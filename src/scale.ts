// The `scale` option, checked the same at build time (a literal in the fence)
// and in the browser (a value Vue computed in the slide).

/** Whether a `scale` value sizes the diagram: a number greater than 0. */
export const isScale = (value: unknown): value is number =>
  typeof value === "number" && value > 0;

/** What to tell the presenter about a `scale` that is not one. */
export const SCALE_FIX =
  "scale must be a number greater than 0, as in {scale: 0.8}.";
