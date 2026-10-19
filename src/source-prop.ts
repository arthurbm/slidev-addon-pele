// A diagram block's source travels from the transformer (Node) to the diagram
// component (browser) as a Vue prop. Base64 keeps quotes, `<` and `{{ }}` in
// Mermaid syntax from being read as template syntax.

export const encodeSource = (source: string): string => {
  let binary = "";
  for (const byte of new TextEncoder().encode(source)) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

export const decodeSource = (encoded: string): string => {
  const bytes = Uint8Array.from(
    atob(encoded),
    (char) => char.codePointAt(0) ?? 0
  );
  return new TextDecoder().decode(bytes);
};
