// ========================================
// ARKHAM — Competition Core
// ========================================
//
// V1 architecture seam.
//
// The current competition engine implementation remains in
// tournamentPro.js so existing behavior is preserved while
// Tournament Pro begins consuming the competition domain through
// a dedicated Core entry point.
//
// Future competition-domain responsibilities should move behind
// this module incrementally, without creating a second engine.
// ========================================

export {
  ensureTournamentProState,
  createParticipant,
  generateBracket,
  startMatch,
  applyMatchResult,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  RECOGNITION_STATUS,
  TOURNAMENT_EVENT_STATUS
} from "./tournamentPro.js";
