const namedEntities: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&(amp|quot|apos|nbsp);|&#39;|&#x27;/gi, (entity) => namedEntities[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}