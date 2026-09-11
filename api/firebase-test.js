// ========================================
// NEXUS — Firebase Environment Test
// ========================================

export async function GET() {

  return Response.json({
    success: true,
    firebaseProjectId:
      !!process.env.FIREBASE_PROJECT_ID,

    firebaseClientEmail:
      !!process.env.FIREBASE_CLIENT_EMAIL,

    firebasePrivateKey:
      !!process.env.FIREBASE_PRIVATE_KEY
  });

}