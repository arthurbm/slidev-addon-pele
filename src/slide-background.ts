// The background a diagram sits on, in the browser. Slidev has no CSS
// variable for it: its slide is painted `bg-main` (white, or #121212 in dark
// mode, on `.slidev-slide-content`), and a theme, a deck's style.css or a
// slide's `background` frontmatter paints `.slidev-layout` or any element in
// between. So the colour is read from the nearest element that paints one.

// A colour with no alpha left: `transparent`, `rgba(0, 0, 0, 0)`, `… / 0)`.
const INVISIBLE = /^transparent$|[,/]\s*0\)$/u;

/** The colour painted behind an element, or `undefined` if nothing paints one. */
export const backgroundBehind = (element: Element): string | undefined => {
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const color = getComputedStyle(ancestor).backgroundColor;
    if (color && !INVISIBLE.test(color)) {
      return color;
    }
  }
  return undefined;
};
