// ========================================
// NEXUS — Tournament Registration API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

function json(res, status, payload) {
  return res.status(status).json(payload);
}

async function authenticate(req) {
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new Error("Debes iniciar sesión.");
  }

  const app = getFirebaseAdminApp();
  const decoded = await getAuth(app).verifyIdToken(token);

  return {
    app,
    uid: decoded.uid
  };
}

function getEventRef(db, tournamentId, eventId) {
  return db.collection("tournaments").doc(tournamentId);
}

async function getTournamentContext(db, tournamentId, eventId) {
  if (!tournamentId || !eventId) {
    throw new Error("Faltan los datos de la competencia.");
  }

  const ref = getEventRef(
    db,
    tournamentId,
    eventId
  );

  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("No se encontró el torneo.");
  }

  const tournament = {
    id: snap.id,
    ...snap.data()
  };

  const event =
    tournament.events?.[eventId];

  if (!event) {
    throw new Error("No se encontró el evento.");
  }

  if (!event.pro) {
    throw new Error(
      "Este evento no tiene registro Pro habilitado."
    );
  }

  return {
    ref,
    tournament,
    event
  };
}

function getEntityKey(profile) {
  const entityType =
    profile?.entityType === "team"
      ? "team"
      : profile?.entityType === "player"
        ? "player"
        : null;

  const entityId =
    profile?.entityId || null;

  return {
    entityType,
    entityId
  };
}

function getRequests(event) {
  return (
    event?.pro?.registration?.requests ||
    {}
  );
}

function requestIsCurrent(request) {
  return [
    "pending",
    "approved"
  ].includes(request?.status);
}

export default async function handler(req, res) {
  try {
    // ========================================
    // AUTHENTICATION
    // ========================================

    const {
      app,
      uid
    } = await authenticate(req);

    const db =
      getFirestore(app);


    // ========================================
    // REQUEST DATA
    // ========================================

    const tournamentId =
      String(
        req.query?.tournamentId ||
        req.body?.tournamentId ||
        ""
      ).trim();

    const eventId =
      String(
        req.query?.eventId ||
        req.body?.eventId ||
        ""
      ).trim();

    const mode =
      String(
        req.query?.mode ||
        req.body?.mode ||
        "status"
      )
        .trim()
        .toLowerCase();


    // ========================================
    // PLAYER — MY REQUESTS
    // ========================================
    //
    // IMPORTANT:
    // mode=mine does NOT require tournamentId
    // or eventId.
    //
    // This mode searches the tournaments/events
    // where this Player has an active request.
    //
    // Therefore getTournamentContext() MUST NOT
    // execute before this block.
    // ========================================

    if (mode === "mine") {

      const profileSnap =
        await db
          .collection("users")
          .doc(uid)
          .get();

      const profile =
        profileSnap.exists
          ? profileSnap.data()
          : null;

      const {
        entityType,
        entityId
      } = getEntityKey(profile);


      if (!entityType || !entityId) {

        return json(
          res,
          200,
          {
            success: true,
            requests: [],
            hasProfile: false
          }
        );

      }


      // --------------------------------------
      // Search tournaments
      // --------------------------------------

      const tournamentsSnap =
        await db
          .collection("tournaments")
          .get();

      const requests = [];


      tournamentsSnap.forEach(
        (tournamentDoc) => {

          const tournament = {
            id: tournamentDoc.id,
            ...tournamentDoc.data()
          };

          const events =
            tournament.events &&
            typeof tournament.events === "object"
              ? tournament.events
              : {};


          Object.entries(events)
            .forEach(
              ([
                currentEventId,
                event
              ]) => {

                // --------------------------------
                // Ignore events without Pro
                // or already finished events.
                // --------------------------------

                if (
                  !event?.pro ||
                  event.pro.status === "finished"
                ) {
                  return;
                }


                const matching =
                  Object.entries(
                    getRequests(event)
                  )
                    .map(
                      ([
                        id,
                        request
                      ]) => ({
                        id,
                        ...request
                      })
                    )
                    .filter(
                      (request) =>
                        request.uid === uid &&
                        request.entityType ===
                          entityType &&
                        request.entityId ===
                          entityId
                    )
                    .sort(
                      (a, b) =>
                        String(
                          b.createdAt || ""
                        ).localeCompare(
                          String(
                            a.createdAt || ""
                          )
                        )
                    );


                if (!matching.length) {
                  return;
                }


                /*
                 * Prefer the current request:
                 *
                 * pending
                 * approved
                 *
                 * If there is no current request,
                 * use the latest historical state.
                 *
                 * This allows a rejected request
                 * to remain visible and expose
                 * "Volver a intentar".
                 */

                const current =
                  matching.find(
                    requestIsCurrent
                  ) ||
                  matching[0];


                if (!current) {
                  return;
                }


                requests.push({
                  id: current.id,

                  tournamentId:
                    tournament.id,

                  eventId:
                    currentEventId,

                  tournamentName:
                    tournament.name ||
                    tournament.title ||
                    "Torneo NEXUS",

                  gameId:
                    event.gameId ||
                    null,

                  status:
                    current.status ||
                    "pending",

                  rejectionReason:
                    current.rejectionReason ||
                    null,

                  createdAt:
                    current.createdAt ||
                    null,

                  reviewedAt:
                    current.reviewedAt ||
                    null,

                  hasProof:
                    Boolean(
                      current.proof?.url
                    )
                });

              }
            );

        }
      );


      // --------------------------------------
      // Newest first
      // --------------------------------------

      requests.sort(
        (a, b) =>
          String(
            b.createdAt || ""
          ).localeCompare(
            String(
              a.createdAt || ""
            )
          )
      );


      return json(
        res,
        200,
        {
          success: true,
          hasProfile: true,
          requests
        }
      );
    }


    // ========================================
    // FROM THIS POINT ON:
    // tournamentId + eventId ARE REQUIRED
    // ========================================

    const {
      ref,
      tournament,
      event
    } = await getTournamentContext(
      db,
      tournamentId,
      eventId
    );


    // ========================================
    // STATUS
    // ========================================

    if (mode === "status") {

      const profileSnap =
        await db
          .collection("users")
          .doc(uid)
          .get();

      const profile =
        profileSnap.exists
          ? profileSnap.data()
          : null;

      const {
        entityType,
        entityId
      } = getEntityKey(profile);


      if (!entityType || !entityId) {

        return json(
          res,
          200,
          {
            success: true,
            request: null,
            hasProfile: false
          }
        );

      }


      const requests =
        getRequests(event);


      const matching =
        Object.entries(requests)
          .map(
            ([
              id,
              request
            ]) => ({
              id,
              ...request
            })
          )
          .filter(
            (request) =>
              request.uid === uid &&
              request.entityType ===
                entityType &&
              request.entityId ===
                entityId
          )
          .sort(
            (a, b) =>
              String(
                b.createdAt || ""
              ).localeCompare(
                String(
                  a.createdAt || ""
                )
              )
          );


      const current =
        matching.find(
          requestIsCurrent
        ) ||
        matching[0] ||
        null;


      return json(
        res,
        200,
        {
          success: true,

          hasProfile: true,

          request:
            current
              ? {
                  id:
                    current.id,

                  status:
                    current.status ||
                    "pending",

                  rejectionReason:
                    current.rejectionReason ||
                    null,

                  createdAt:
                    current.createdAt ||
                    null,

                  reviewedAt:
                    current.reviewedAt ||
                    null,

                  proof:
                    current.proof ||
                    null
                }
              : null
        }
      );
    }


    // ========================================
    // LIST — ORGANIZER
    // ========================================

    if (mode === "list") {

      // --------------------------------------
      // Owner authorization
      // --------------------------------------

      let canManage =
        tournament.ownerId === uid;


      // --------------------------------------
      // EntityContext authorization
      // --------------------------------------

      if (!canManage) {

        const profileSnap =
          await db
            .collection("users")
            .doc(uid)
            .get();

        const profile =
          profileSnap.exists
            ? profileSnap.data()
            : null;

        canManage =
          profile?.entityType ===
            "tournament" &&
          profile?.entityId ===
            tournamentId;
      }


      if (!canManage) {

        return json(
          res,
          403,
          {
            success: false,
            error:
              "La cuenta actual no tiene acceso administrativo a este torneo."
          }
        );

      }


      const requests =
        Object.entries(
          getRequests(event)
        )
          .map(
            ([
              id,
              request
            ]) => ({
              id,
              ...request
            })
          )
          .sort(
            (a, b) =>
              String(
                b.createdAt || ""
              ).localeCompare(
                String(
                  a.createdAt || ""
                )
              )
          );


      return json(
        res,
        200,
        {
          success: true,
          requests
        }
      );
    }


    // ========================================
    // METHODS
    // ========================================

    if (req.method !== "POST") {

      return json(
        res,
        405,
        {
          success: false,
          error:
            "Método no permitido."
        }
      );

    }


    // ========================================
    // ACTION
    // ========================================

    const action =
      String(
        req.body?.action ||
        "submit"
      )
        .trim()
        .toLowerCase();


    // ========================================
    // SUBMIT
    // ========================================

    if (action === "submit") {

      const profileSnap =
        await db
          .collection("users")
          .doc(uid)
          .get();

      const profile =
        profileSnap.exists
          ? profileSnap.data()
          : null;

      const {
        entityType,
        entityId
      } = getEntityKey(profile);


      if (!entityType || !entityId) {

        return json(
          res,
          400,
          {
            success: false,
            error:
              "Tu cuenta NEXUS no tiene un perfil competitivo."
          }
        );

      }


      // --------------------------------------
      // Registration deadline
      // --------------------------------------

      const registration =
        event.pro.registration ||
        {};

      const deadline =
        event.registrationDeadline ||
        registration.deadline ||
        null;


      if (
        deadline &&
        Date.now() >=
          new Date(deadline).getTime()
      ) {

        return json(
          res,
          400,
          {
            success: false,
            error:
              "El período de inscripción ya finalizó."
          }
        );

      }


      // --------------------------------------
      // Existing active request
      // --------------------------------------

      const requests =
        getRequests(event);


      const existing =
        Object.entries(requests)
          .map(
            ([
              id,
              request
            ]) => ({
              id,
              ...request
            })
          )
          .find(
            (request) =>
              request.uid === uid &&
              request.entityType ===
                entityType &&
              request.entityId ===
                entityId &&
              requestIsCurrent(request)
          );


      if (existing) {

        return json(
          res,
          409,
          {
            success: false,

            error:
              existing.status ===
              "approved"
                ? "Tu asiento ya fue otorgado."
                : "Ya tienes una solicitud en revisión.",

            request: {
              id:
                existing.id,

              status:
                existing.status
            }
          }
        );

      }


      // --------------------------------------
      // Capacity
      // --------------------------------------

      const activeParticipants =
        Object.values(
          event.pro.participants ||
            {}
        )
          .filter(
            (participant) =>
              ![
                "rejected",
                "withdrawn",
                "no_show"
              ].includes(
                participant.status
              )
          )
          .length;


      const capacity =
        Number(
          event.capacity?.value ||
          event.capacity ||
          event.pro.capacity?.value ||
          event.pro.capacity ||
          0
        );


      if (
        capacity > 0 &&
        activeParticipants >=
          capacity
      ) {

        return json(
          res,
          400,
          {
            success: false,
            error:
              "Los cupos de este torneo ya están completos."
          }
        );

      }


      // --------------------------------------
      // Registration requirements
      // --------------------------------------

      const requiresProof =
        (
          event.registrationRequirements
            ?.requirements ||
          []
        )
          .some(
            (requirement) =>
              requirement?.requiresProof ===
              true
          );


      const proof =
        req.body?.proof ||
        null;


      if (
        event.registrationRequirements
          ?.enabled &&
        requiresProof &&
        !proof?.url
      ) {

        return json(
          res,
          400,
          {
            success: false,
            error:
              "Debes adjuntar el comprobante requerido."
          }
        );

      }


      // --------------------------------------
      // Existing participant
      // --------------------------------------

      const existingParticipant =
        event.pro.participants?.[
          `${entityType}_${entityId}`
        ];


      if (
        existingParticipant &&
        ![
          "rejected",
          "withdrawn",
          "no_show"
        ].includes(
          existingParticipant.status
        )
      ) {

        return json(
          res,
          409,
          {
            success: false,
            error:
              "Este participante ya tiene un asiento en el torneo."
          }
        );

      }


      // --------------------------------------
      // Competitive entity
      // --------------------------------------

      const participantCollection =
        entityType === "team"
          ? "teams"
          : "players";


      const entitySnap =
        await db
          .collection(
            participantCollection
          )
          .doc(entityId)
          .get();


      if (!entitySnap.exists) {

        return json(
          res,
          400,
          {
            success: false,
            error:
              "No se encontró el perfil competitivo."
          }
        );

      }


      const entity =
        entitySnap.data() ||
        {};


      const displayName =
        entityType === "team"
          ? (
              entity.name ||
              entity.shortName ||
              entityId
            )
          : (
              entity.gamertag ||
              entity.name ||
              [
                entity.firstName,
                entity.lastName
              ]
                .filter(Boolean)
                .join(" ") ||
              entityId
            );


      // --------------------------------------
      // Previous rejected request
      // --------------------------------------
      //
      // We reuse the latest rejected request
      // instead of creating an unlimited chain
      // of historical request objects.
      // --------------------------------------

      const previousRejected =
        Object.entries(requests)
          .map(
            ([
              id,
              request
            ]) => ({
              id,
              ...request
            })
          )
          .filter(
            (request) =>
              request.uid === uid &&
              request.entityType ===
                entityType &&
              request.entityId ===
                entityId &&
              request.status ===
                "rejected"
          )
          .sort(
            (a, b) =>
              String(
                b.createdAt || ""
              ).localeCompare(
                String(
                  a.createdAt || ""
                )
              )
          )[0] || null;


      const requestId =
        previousRejected?.id ||
        `request_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;


      const createdAt =
        new Date().toISOString();


      const request = {

        uid,

        entityType,

        entityId,

        participantId:
          `${entityType}_${entityId}`,

        displayName,

        status:
          "pending",

        proof,

        requirements:
          event.registrationRequirements ||
          null,

        createdAt,

        reviewedAt:
          null,

        rejectionReason:
          null
      };


      // --------------------------------------
      // Save request
      // --------------------------------------

      await ref.update({

        [
          `events.${eventId}.pro.registration.requests.${requestId}`
        ]:
          request

      });


      return json(
        res,
        201,
        {
          success: true,

          request: {
            id:
              requestId,

            ...request
          }
        }
      );
    }


    // ========================================
    // INVALID ACTION
    // ========================================

    return json(
      res,
      400,
      {
        success: false,
        error:
          "Acción de registro no válida."
      }
    );

  } catch (error) {

    console.error(
      "NEXUS — Tournament Registration API:",
      error
    );


    const status =
      /sesión|permiso/i.test(
        error?.message || ""
      )
        ? 401
        : 400;


    return json(
      res,
      status,
      {
        success: false,
        error:
          error?.message ||
          "No fue posible procesar la solicitud."
      }
    );

  }
}