/**
 * MATCHING ENGINE
 * ----------------
 * Given a source Opportunity (a NEED looking for OFFER, or vice versa),
 * finds and scores candidate counterpart Opportunities.
 *
 * 1) HARD FILTER (must pass, otherwise excluded entirely):
 *    - opposite type (NEED <-> OFFER)
 *    - same category (if source has one)
 *    - visibility must allow discovery (PUBLIC, or VERIFIED_ONLY when both verified)
 *    - status must be ACTIVE
 *
 * 2) SCORING (0..1 per criterion, then weighted sum -> matchScore 0..100):
 *    - capabilityMatch : overlap of required/offered capabilities
 *    - location         : same location string = full score, partial/word overlap = partial
 *    - budget            : how well the ranges overlap
 *    - tags              : Jaccard similarity of tag sets
 *    - textSimilarity   : Jaccard similarity of title+description tokens
 *    - priority          : normalized priority level of the candidate
 */

const WEIGHTS = {
  capabilityMatch: 0.3,
  location: 0.15,
  budget: 0.2,
  tags: 0.15,
  textSimilarity: 0.15,
  priority: 0.05,
};

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

function scoreCapability(sourceCapIds, candidateCapIds) {
  const a = new Set(sourceCapIds);
  const b = new Set(candidateCapIds);
  if (a.size === 0 || b.size === 0) return 0.3; // neutral-low when undeclared
  return jaccard(a, b);
}

function scoreLocation(sourceLocation, candidateLocation) {
  if (!sourceLocation || !candidateLocation) return 0.4; // unknown -> neutral
  const a = sourceLocation.trim().toLowerCase();
  const b = candidateLocation.trim().toLowerCase();
  if (a === b) return 1;
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  return jaccard(aTokens, bTokens) > 0 ? 0.6 : 0;
}

function scoreBudget(source, candidate) {
  const sMin = source.budgetMin ?? null;
  const sMax = source.budgetMax ?? null;
  const cMin = candidate.budgetMin ?? null;
  const cMax = candidate.budgetMax ?? null;

  if (sMin === null && sMax === null) return 0.5; // no constraint declared
  if (cMin === null && cMax === null) return 0.5;

  const loA = sMin ?? 0;
  const hiA = sMax ?? Infinity;
  const loB = cMin ?? 0;
  const hiB = cMax ?? Infinity;

  const overlapLo = Math.max(loA, loB);
  const overlapHi = Math.min(hiA, hiB);
  if (overlapHi < overlapLo) return 0; // no overlap at all

  if (!Number.isFinite(hiA) && !Number.isFinite(hiB)) return 1;
  const spanA = Number.isFinite(hiA) ? hiA - loA : overlapHi - overlapLo;
  const spanB = Number.isFinite(hiB) ? hiB - loB : overlapHi - overlapLo;
  const overlapSpan = overlapHi - overlapLo;
  const avgSpan = ((spanA || 1) + (spanB || 1)) / 2;
  return Math.max(0, Math.min(1, overlapSpan / avgSpan || 1));
}

function scoreTags(sourceTags, candidateTags) {
  return jaccard(new Set(sourceTags || []), new Set(candidateTags || []));
}

function scoreText(source, candidate) {
  const a = tokenize(`${source.title} ${source.description}`);
  const b = tokenize(`${candidate.title} ${candidate.description}`);
  return jaccard(a, b);
}

const PRIORITY_VALUE = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, URGENT: 1 };
function scorePriority(candidate) {
  return PRIORITY_VALUE[candidate.priority] ?? 0.5;
}

/**
 * @param {object} source - Opportunity with capabilities included (array of {capabilityId})
 * @param {object} candidate - Opportunity with capabilities included
 * @returns {{ score: number, breakdown: object }} score is 0..100
 */
function round(n) {
  return Math.round(n * 1000) / 1000;
}

function computeMatchScore(source, candidate) {
  const sourceCapIds = (source.capabilities || []).map((c) => c.capabilityId);
  const candidateCapIds = (candidate.capabilities || []).map((c) => c.capabilityId);

  const breakdown = {
    capabilityMatch: round(scoreCapability(sourceCapIds, candidateCapIds)),
    location: round(scoreLocation(source.location, candidate.location)),
    budget: round(scoreBudget(source, candidate)),
    tags: round(scoreTags(source.tags, candidate.tags)),
    textSimilarity: round(scoreText(source, candidate)),
    priority: round(scorePriority(candidate)),
  };

  const weightedSum = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + breakdown[key] * weight,
    0
  );

  return { score: round(weightedSum * 100), breakdown };
}

/**
 * Hard filter check between a source and a candidate Opportunity.
 */
function passesHardFilter(
  source,
  candidate,
  { candidateVerified = false, sourceVerified = false } = {}
) {
  if (source.type === candidate.type) return false; // must be opposite (NEED<->OFFER)
  if (candidate.status !== 'ACTIVE') return false;
  if (source.categoryId && candidate.categoryId && source.categoryId !== candidate.categoryId)
    return false;

  if (candidate.visibility === 'PRIVATE') return false;
  if (candidate.visibility === 'VERIFIED_ONLY' && !(candidateVerified && sourceVerified))
    return false;

  return true;
}

module.exports = { computeMatchScore, passesHardFilter, WEIGHTS };
