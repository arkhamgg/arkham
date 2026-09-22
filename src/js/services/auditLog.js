// ========================================
// ARKHAM — Audit Log Service
// ========================================

import { createEntity } from "./firestore.js";
import { getCurrentAdminAccess } from "./adminAccess.js";


// ========================================
// AUDIT COLLECTION
// ========================================

const AUDIT_LOG_COLLECTION =
  "auditLogs";


// ========================================
// CREATE AUDIT LOG
// ========================================

export async function createAuditLog({
  action,
  targetType = null,
  targetId = null,
  previousState = null,
  newState = null,
  reason = null,
  metadata = null
} = {}) {

  if (!action) {

    throw new Error(
      "La acción del audit log es obligatoria."
    );

  }

  const access =
    await getCurrentAdminAccess();

  if (!access) {

    throw new Error(
      "No se puede crear un audit log sin acceso administrativo."
    );

  }

  return await createEntity(
    AUDIT_LOG_COLLECTION,
    {

      actorId:
        access.uid,

      actorRole:
        access.roleId,

      action,

      targetType,

      targetId,

      previousState,

      newState,

      reason,

      metadata

    }
  );

}
