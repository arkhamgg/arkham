// ========================================
// ARKHAM — Competition Types
// ========================================
//
// Shared domain constants for the competition engine.
// Kept in a dependency-neutral module so the Competition Core can
// progressively absorb match/result logic without creating circular
// imports with Tournament Pro.
// ========================================

export const TOURNAMENT_EVENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  CHECK_IN: "check_in",
  LIVE: "live",
  FINISHED: "finished",
  ARCHIVED: "archived"
};

export const PARTICIPANT_STATUS = {
  REQUESTED: "requested",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CHECKED_IN: "checked_in",
  COMPETING: "competing",
  ADVANCED: "advanced",
  ELIMINATED: "eliminated",
  NO_SHOW: "no_show",
  WITHDRAWN: "withdrawn",
  FINISHED: "finished"
};

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

export const STATION_TYPES = {
  PHYSICAL: "physical",
  VIRTUAL: "virtual"
};

export const STATION_STATUS = {
  AVAILABLE: "available",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  RESULT_PENDING: "result_pending"
};

export const RECOGNITION_STATUS = {
  NOT_REQUESTED: "not_requested",
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected"
};
