/**
 * Small deterministic text-similarity helpers (no ML/embeddings, no external
 * calls) — same technique already used in matching.service.js, extracted here
 * so Decision Engine can reuse it without duplicating logic.
 */

function tokenize(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Convenience: Jaccard similarity directly between two raw strings. */
function textSimilarity(textA, textB) {
  return jaccard(tokenize(textA), tokenize(textB));
}

module.exports = { tokenize, jaccard, textSimilarity };
