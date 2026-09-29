// ========================================
// ARKHAM — Competition Core
// ========================================
//
// V1 competition-domain boundary.
//
// Match execution now lives here incrementally. Tournament Pro remains
// responsible for tournament state, participant management and bracket
// generation, while this module owns the domain operations that change
// a match and route its result through the existing bracket structure.
//
// No second bracket engine is introduced. The existing bracket structure
// and deterministic routes remain the source of truth.
// ========================================

export const MATCH_STATUS = {
  PENDING: "pending",
  LIVE: "live",
  COMPLETED: "completed",
  BYE: "bye"
};

export const BRACKET_TYPES = {
  SINGLE_ELIMINATION: "single_elimination",
  DOUBLE_ELIMINATION: "double_elimination"
};

export function startMatch(bracket, matchId, now = new Date().toISOString()) {
  const nextBracket = clone(bracket);
  const match = findMatch(nextBracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  if (match.status === MATCH_STATUS.COMPLETED) throw new Error("El match ya fue completado.");
  if (match.status === MATCH_STATUS.BYE) throw new Error("Un BYE no puede iniciarse como match.");
  if (!match.participantAId || !match.participantBId) {
    throw new Error("El match todavía no tiene dos participantes.");
  }

  match.status = MATCH_STATUS.LIVE;
  match.startedAt = match.startedAt || now;
  return nextBracket;
}

export function applyMatchResult(
  bracket,
  matchId,
  winnerId,
  score = null,
  now = new Date().toISOString()
) {
  const nextBracket = clone(bracket);
  const match = findMatch(nextBracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  if (match.status === MATCH_STATUS.COMPLETED) throw new Error("El match ya fue completado.");
  if (match.status !== MATCH_STATUS.LIVE) throw new Error("El match debe estar en vivo antes de registrar el resultado.");
  if (![match.participantAId, match.participantBId].includes(winnerId)) {
    throw new Error("El ganador no pertenece al match.");
  }

  match.winnerId = winnerId;
  match.loserId = match.participantAId === winnerId
    ? match.participantBId
    : match.participantAId;
  match.score = normalizeScore(score);
  match.status = MATCH_STATUS.COMPLETED;
  match.completedAt = now;

  routeWinner(nextBracket, match);

  if (nextBracket.type === BRACKET_TYPES.DOUBLE_ELIMINATION && match.bracket === "winners" && match.loserId) {
    routeLoser(nextBracket, match);
  }

  const final = findMatch(nextBracket, "GF-M1");
  if (final && final.status !== MATCH_STATUS.COMPLETED && final.participantAId && final.participantBId) {
    final.status = MATCH_STATUS.PENDING;
  }

  if (match.bracket === "grand_final") {
    nextBracket.championId = winnerId;
    nextBracket.completedAt = now;
  } else if (nextBracket.type === BRACKET_TYPES.SINGLE_ELIMINATION && !hasOpenMatches(nextBracket)) {
    nextBracket.championId = winnerId;
    nextBracket.completedAt = now;
  }

  return nextBracket;
}

function routeLoser(bracket, match) {
  const route = match.loserRoute;
  if (!route) return;
  const target = findMatch(bracket, route.matchId);
  if (!target || target.status === MATCH_STATUS.COMPLETED) return;

  if (route.slot === "A") target.participantAId = match.loserId;
  else target.participantBId = match.loserId;
  refreshPendingStatus(target);
}

function routeWinner(bracket, match) {
  if (!match.nextMatchId || !match.winnerId) return;
  const next = findMatch(bracket, match.nextMatchId);
  if (!next || next.status === MATCH_STATUS.COMPLETED) return;

  if (match.nextSlot === "A") next.participantAId = match.winnerId;
  else if (match.nextSlot === "B") next.participantBId = match.winnerId;
  else if (!next.participantAId) next.participantAId = match.winnerId;
  else if (!next.participantBId) next.participantBId = match.winnerId;
  refreshPendingStatus(next);
}

function refreshPendingStatus(match) {
  if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.LIVE) return;

  // Tener un solo participante no significa BYE por sí mismo.
  // En rondas futuras, el segundo participante puede llegar desde un
  // match predecesor todavía pendiente. Los BYE se resuelven únicamente
  // cuando la estructura del bracket confirma que el otro lado no llegará.
  match.status = match.participantAId && match.participantBId
    ? MATCH_STATUS.PENDING
    : MATCH_STATUS.PENDING;
}

function normalizeScore(score) {
  if (score === null || score === undefined || score === "") return null;
  if (typeof score === "number") return score;
  if (typeof score === "string") return score.trim() || null;
  if (typeof score === "object") return { ...score };
  return null;
}

function findMatch(bracket, matchId) {
  for (const stage of bracket?.stages || []) {
    const match = stage.matches?.find((item) => item.id === matchId);
    if (match) return match;
  }
  return null;
}

function hasOpenMatches(bracket) {
  return (bracket?.stages || []).some((stage) =>
    stage.matches?.some((match) =>
      [MATCH_STATUS.PENDING, MATCH_STATUS.LIVE].includes(match.status)
    )
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
