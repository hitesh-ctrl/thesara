/**
 * Shared subtitle text extraction utility.
 *
 * Handles multiple DOM layouts used by streaming platforms:
 *   - Simple text nodes inside a container
 *   - Word-per-span (each word in its own <span>, common on Netflix/Disney+)
 *   - Block-separated lines (block elements within a container)
 *
 * Key problem solved: adjacent inline <span> elements without whitespace text
 * nodes between them (e.g. <span>Hello</span><span>world</span>) produce
 * "Helloworld" via textContent alone. This utility detects those boundaries and
 * inserts spaces where words meet.
 */
export function extractSubtitleText(root: Element): string {
  const parts: string[] = [];
  walk(root, parts);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function walk(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    if (t) parts.push(t);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  const display = getComputedStyle(el).display;
  const isBlock =
    display === "block" ||
    display === "flex" ||
    display === "grid" ||
    display === "table" ||
    display === "table-row" ||
    display === "table-cell";

  if (isBlock && parts.length > 0 && !trailingSpace(parts)) parts.push(" ");

  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    const before = parts.length;
    walk(children[i] as Node, parts);

    // After a child adds text, check the next sibling. Insert a space between
    // adjacent text-bearing siblings when neither provides one — handles
    // word-per-span layouts where platform CSS controls spacing visually but
    // no space character exists in the DOM.
    if (parts.length > before && i + 1 < children.length && !trailingSpace(parts)) {
      const nextLeaf = firstLeafText(children[i + 1] as Node);
      if (nextLeaf && !nextLeaf.startsWith(" ")) {
        const lc = lastChar_(parts);
        const nextChar = nextLeaf.trimStart().charAt(0);
        // Add space when word or word-terminal punctuation meets a word character.
        if (/[\w,;:!?'")\]]/.test(lc) && /[\w([]/.test(nextChar)) {
          parts.push(" ");
        }
      }
    }
  }

  if (isBlock && parts.length > 0 && !trailingSpace(parts)) parts.push(" ");
}

function trailingSpace(parts: string[]): boolean {
  const last = parts[parts.length - 1] ?? "";
  return last.endsWith(" ");
}

function lastChar_(parts: string[]): string {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.length > 0) return p.charAt(p.length - 1);
  }
  return "";
}

function firstLeafText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType === Node.ELEMENT_NODE) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent ?? "";
      if (t) return t;
    }
  }
  return "";
}
