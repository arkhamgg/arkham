// ========================================
// ARKHAM — Reload Payment Proof Service
// ========================================

import { upload } from "@imagekit/javascript";
import { auth, authReady } from "./firebase.js";

const API = "/api/admin?resource=public-reloads";
const IMAGEKIT_PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

async function request(body) {
  await authReady;
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para gestionar tu recarga.");

  const idToken = await user.getIdToken();
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "No fue posible procesar el comprobante.");
  }
  return data;
}

export async function getReloadProofUploadAuth(draftId) {
  return request({ action: "proof-auth", draftId });
}

/**
 * Uploads the proof first and only then asks the backend to persist the order.
 * No reloadOrders document exists until this complete flow succeeds.
 */
export async function uploadReloadPaymentProof(file, purchase) {
  if (!(file instanceof File)) throw new Error("Selecciona un comprobante válido.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("El comprobante debe ser JPG, PNG, WEBP o PDF.");
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("El comprobante no puede superar los 5 MB.");
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT) throw new Error("ImageKit no está configurado.");
  if (!purchase?.draftId) throw new Error("No fue posible preparar la orden.");

  const authData = await getReloadProofUploadAuth(purchase.draftId);
  if (!authData?.token || !authData?.expire || !authData?.signature || !authData?.folder) {
    throw new Error("No fue posible preparar la subida del comprobante.");
  }

  const result = await upload({
    file,
    fileName: file.name,
    publicKey: IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    token: authData.token,
    expire: authData.expire,
    signature: authData.signature,
    folder: authData.folder,
    useUniqueFileName: true
  });

  const proof = {
    provider: "imagekit",
    fileId: result.fileId || null,
    filePath: result.filePath || null,
    url: result.url || null,
    fileName: result.name || file.name,
    contentType: file.type,
    size: result.size || file.size
  };

  return request({
    action: "create-order-with-proof",
    draftId: purchase.draftId,
    gameId: purchase.gameId,
    productId: purchase.productId,
    gameData: purchase.gameData,
    whatsapp: purchase.whatsapp,
    proof
  });
}
