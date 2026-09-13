import {
  createEntity,
  updateEntity,
  getEntity,
  getEntities
} from "./firestore.js";

const CALENDAR_COLLECTION = "calendar";

function getCalendarEventId(tournamentId, eventId) {
  if (!tournamentId || !eventId) {
    throw new Error("Calendar requiere tournamentId y eventId.");
  }

  return `${tournamentId}_${eventId}`;
}

function getEventDate(event) {
  return event?.dateTime?.startDate || null;
}

export async function syncCalendarEvent({
  tournamentId,
  eventId,
  event
}) {
  if (!tournamentId) {
    throw new Error("Calendar requiere tournamentId.");
  }

  if (!eventId) {
    throw new Error("Calendar requiere eventId.");
  }

  if (!event) {
    throw new Error("Calendar requiere la información del evento.");
  }

  const date = getEventDate(event);

  if (!date) {
    console.log(
      "NEXUS — Evento sin fecha. No se sincroniza con Calendar.",
      { tournamentId, eventId }
    );

    return null;
  }

  const calendarEventId = getCalendarEventId(
    tournamentId,
    eventId
  );

  const calendarData = {
    tournamentId,
    eventId,
    date
  };

  const existing = await getEntity(
    CALENDAR_COLLECTION,
    calendarEventId
  );

  if (existing) {
    await updateEntity(
      CALENDAR_COLLECTION,
      calendarEventId,
      calendarData
    );

    return calendarEventId;
  }

  await createEntity(
    CALENDAR_COLLECTION,
    calendarData,
    calendarEventId
  );

  return calendarEventId;
}

export async function getCalendarEvents() {
  const entries = await getEntities(CALENDAR_COLLECTION);

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => ({
      id: entry.id,
      tournamentId: entry.tournamentId || null,
      eventId: entry.eventId || null,
      date: entry.date || null
    }))
    .filter(
      (entry) =>
        entry.tournamentId &&
        entry.eventId &&
        entry.date
    );
}

export { getCalendarEventId };
