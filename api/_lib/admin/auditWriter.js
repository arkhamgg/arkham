// ========================================
// NEXUS — Admin Audit Writer
// ========================================

import { FieldValue } from "firebase-admin/firestore";

const AUDIT_LOGS_COLLECTION = "auditLogs";

export async function writeAdminAudit({
  firestore,
  actorId,
  actorRole,
  action,
  targetType = null,
  targetId = null,
  previousState = null,
  newState = null,
  reason = null,
  metadata = null
} = {}) {
  if (!firestore || !actorId || !action) return null;

  const ref = firestore.collection(AUDIT_LOGS_COLLECTION).doc();

  await ref.set({
    actorId,
    actorRole: actorRole || null,
    action,
    targetType,
    targetId,
    previousState,
    newState,
    reason,
    metadata,
    createdAt: FieldValue.serverTimestamp()
  });

  return ref.id;
}
