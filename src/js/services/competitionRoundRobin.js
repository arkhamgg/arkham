// ARKHAM — Round Robin / Pool domain functions.
// Pure functions only: no persistence and no Tournament Pro mutation.

const DEFAULT_SCORING = Object.freeze({ win: 3, draw: 1, loss: 0 });

function participantsOf(input) {
  if (!Array.isArray(input)) throw new Error("Los participantes deben ser una lista.");
  const result = input.map((p, i) => {
    const id = String(typeof p === "string" ? p : (p?.entryId || p?.id || "")).trim();
    if (!id) throw new Error(`El participante ${i + 1} no tiene un ID válido.`);
    return { id, participantId: typeof p === "object" ? p.participantId ?? null : null,
      displayName: typeof p === "object" ? String(p.displayName || p.name || id) : id };
  });
  const ids = new Set();
  for (const p of result) {
    if (ids.has(p.id)) throw new Error(`El participante ${p.id} está asignado más de una vez al pool.`);
    ids.add(p.id);
  }
  return result;
}

function numberAtLeastZero(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} debe ser un número válido mayor o igual a cero.`);
  return n;
}

/** Circle-method schedule; odd-sized pools receive a bye, not a fake match. */
export function generateRoundRobinSchedule({
  competitionId = null, phaseId = null, phaseGroupId, structureId = null,
  participants, rounds = 1, matchFormat = null, firstMatchNumber = 1
} = {}) {
  const groupId = String(phaseGroupId || "").trim();
  if (!groupId) throw new Error("Falta identificar el pool.");
  const entries = participantsOf(participants);
  if (entries.length < 2) throw new Error("Un pool necesita al menos 2 participantes.");
  const legs = Number(rounds);
  if (![1, 2].includes(legs)) throw new Error("Round Robin solo admite 1 o 2 vueltas.");

  const base = [...entries];
  if (base.length % 2) base.push(null);
  const size = base.length;
  const perLeg = size - 1;
  const matches = [];
  const roundRecords = [];
  let sequence = Number.isInteger(Number(firstMatchNumber)) && Number(firstMatchNumber) > 0
    ? Number(firstMatchNumber) : 1;

  for (let leg = 0; leg < legs; leg++) {
    const rotation = leg === 0 ? [...base] : [...base].reverse();
    for (let r = 0; r < perLeg; r++) {
      const roundNumber = leg * perLeg + r + 1;
      const roundId = `${groupId}-rr-${roundNumber}`;
      const matchIds = [];
      for (let pair = 0; pair < size / 2; pair++) {
        const left = rotation[pair], right = rotation[size - 1 - pair];
        if (!left || !right) continue;
        const flip = (r + pair + leg) % 2 === 1;
        const a = flip ? right : left, b = flip ? left : right;
        const match = {
          id: `${groupId}-rr-match-${sequence}`,
          competitionMatchId: [competitionId || "competition", phaseId || "phase", groupId, roundId, sequence].join(":"),
          competitionId, phaseId, phaseGroupId: groupId, structureId, roundId,
          round: roundNumber, roundOrder: roundNumber, order: sequence, matchFormat,
          status: "PENDING", entryAId: a.id, entryBId: b.id,
          participantAId: a.participantId, participantBId: b.participantId,
          participants: { A: { entryId: a.id, participantId: a.participantId, displayName: a.displayName },
            B: { entryId: b.id, participantId: b.participantId, displayName: b.displayName } },
          winnerEntryId: null, loserEntryId: null, games: [], result: null,
          roundRobin: { leg: leg + 1, fixtureKey: [left.id, right.id].sort().join("::") }
        };
        matches.push(match); matchIds.push(match.id); sequence++;
      }
      roundRecords.push({ id: roundId, phaseId, structureId, phaseGroupId: groupId,
        order: roundNumber, number: roundNumber, name: `Jornada ${roundNumber}`,
        type: "ROUND_ROBIN", bracket: "round_robin", status: "configured",
        matchCount: matchIds.length, matchIds, matches: [] });
      const fixed = rotation[0], rest = rotation.slice(1);
      rest.unshift(rest.pop());
      rotation.splice(0, rotation.length, fixed, ...rest);
    }
  }
  return { status: "READY", format: "ROUND_ROBIN", competitionId, phaseId,
    phaseGroupId: groupId, structureId, rounds: roundRecords, matches,
    participantCount: entries.length, roundsPerLeg: perLeg, legs,
    expectedMatchCount: entries.length * (entries.length - 1) / 2 * legs };
}

function resultOf(match) {
  const result = match?.result || {};
  const rawA = result.scoreA ?? result.participantAScore ?? match?.scoreA;
  const rawB = result.scoreB ?? result.participantBScore ?? match?.scoreB;
  if (rawA == null || rawB == null) return null;
  const scoreA = numberAtLeastZero(rawA, "El resultado A");
  const scoreB = numberAtLeastZero(rawB, "El resultado B");
  if (scoreA === scoreB) return { scoreA, scoreB, draw: true, winner: null };
  const a = match.entryAId || match.participants?.A?.entryId;
  const b = match.entryBId || match.participants?.B?.entryId;
  const declared = match.winnerEntryId || result.winnerEntryId || result.winnerId;
  if (declared && declared !== a && declared !== b) throw new Error(`El ganador del partido ${match.id || ""} no pertenece al enfrentamiento.`);
  return { scoreA, scoreB, draw: false, winner: declared || (scoreA > scoreB ? a : b) };
}

/** Standings from COMPLETED matches only. Tiebreakers: head_to_head,
 * match_difference, score_difference, score_for, wins. */
export function calculateRoundRobinStandings({
  participants, matches, scoring = DEFAULT_SCORING,
  tiebreakers = ["head_to_head", "match_difference", "score_difference", "wins"],
  qualification = null
} = {}) {
  const entries = participantsOf(participants);
  if (!Array.isArray(matches)) throw new Error("Los partidos deben ser una lista.");
  const points = { win: numberAtLeastZero(scoring.win ?? 3, "Puntos por victoria"),
    draw: numberAtLeastZero(scoring.draw ?? 1, "Puntos por empate"),
    loss: numberAtLeastZero(scoring.loss ?? 0, "Puntos por derrota") };
  const rows = new Map(entries.map(p => [p.id, { entryId: p.id, participantId: p.participantId,
    displayName: p.displayName, played: 0, wins: 0, draws: 0, losses: 0, points: 0,
    scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, matchDifference: 0 }]));
  const h2h = new Map();
  for (const match of matches.filter(m => m && String(m.status).toUpperCase() === "COMPLETED")) {
    const aId = match.entryAId || match.participants?.A?.entryId;
    const bId = match.entryBId || match.participants?.B?.entryId;
    const a = rows.get(aId), b = rows.get(bId);
    if (!a || !b || a === b) continue;
    const result = resultOf(match);
    if (!result) continue;
    a.played++; b.played++;
    a.scoreFor += result.scoreA; a.scoreAgainst += result.scoreB;
    b.scoreFor += result.scoreB; b.scoreAgainst += result.scoreA;
    if (result.draw) { a.draws++; b.draws++; a.points += points.draw; b.points += points.draw; }
    else {
      const winner = rows.get(result.winner), loser = winner === a ? b : a;
      if (!winner) throw new Error(`No se pudo resolver el ganador del partido ${match.id || ""}.`);
      winner.wins++; loser.losses++; winner.points += points.win; loser.points += points.loss;
    }
    const key = [aId, bId].sort().join("::");
    const record = h2h.get(key) || {};
    if (result.draw) { record[aId] = (record[aId] || 0) + points.draw; record[bId] = (record[bId] || 0) + points.draw; }
    else record[result.winner] = (record[result.winner] || 0) + points.win;
    h2h.set(key, record);
  }
  const criteria = Array.isArray(tiebreakers) ? tiebreakers : [];
  for (const row of rows.values()) {
    row.scoreDifference = row.scoreFor - row.scoreAgainst;
    row.matchDifference = row.wins - row.losses;
  }
  const compare = (a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    for (const raw of criteria) {
      let d = 0;
      switch (String(raw).toLowerCase()) {
        case "head_to_head": case "head-to-head": {
          const rec = h2h.get([a.entryId, b.entryId].sort().join("::")) || {};
          d = (rec[b.entryId] || 0) - (rec[a.entryId] || 0); break;
        }
        case "match_difference": case "match-difference": d = b.matchDifference - a.matchDifference; break;
        case "score_difference": case "score-difference": d = b.scoreDifference - a.scoreDifference; break;
        case "score_for": case "score-for": d = b.scoreFor - a.scoreFor; break;
        case "wins": d = b.wins - a.wins; break;
      }
      if (d) return d;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) || a.entryId.localeCompare(b.entryId);
  };
  const sorted = [...rows.values()].sort(compare);
  const n = Number(qualification?.qualifiers ?? qualification?.advanceCount);
  const qualifierCount = Number.isInteger(n) && n > 0 ? n : null;
  return sorted.map((row, i) => ({ ...row, rank: i + 1,
    qualified: qualifierCount == null ? null : i < qualifierCount }));
}

export function validateRoundRobinResults(matches) {
  if (!Array.isArray(matches)) throw new Error("Los partidos deben ser una lista.");
  const errors = [], ids = new Set();
  for (const match of matches) {
    if (!match || typeof match !== "object") { errors.push("Hay un partido inválido."); continue; }
    const a = match.entryAId || match.participants?.A?.entryId;
    const b = match.entryBId || match.participants?.B?.entryId;
    if (!a || !b) errors.push(`El partido ${match.id || "(sin ID)"} no tiene ambos participantes.`);
    if (a && b && a === b) errors.push(`El partido ${match.id || "(sin ID)"} enfrenta a un participante consigo mismo.`);
    if (match.id && ids.has(match.id)) errors.push(`El ID de partido ${match.id} está duplicado.`);
    if (match.id) ids.add(match.id);
  }
  return { valid: errors.length === 0, errors };
}
