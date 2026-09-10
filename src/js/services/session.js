// ========================================
// NEXUS — Session Service
// ========================================

import { authReady } from "./firebase.js";
import { observeAuthState } from "./auth.js";
import { getEntity } from "./firestore.js";


let currentSession = null;

let initialized = false;

let initializationPromise = null;

let sessionInitialized = false;

const sessionListeners =
  new Set();


// ========================================
// NOTIFY SESSION LISTENERS
// ========================================

function notifySessionListeners() {

  sessionListeners.forEach(
    (callback) => {

      callback(
        currentSession
      );

    }
  );

}


// ========================================
// INITIALIZE SESSION
// ========================================

export function initializeSession(
  callback = null
) {

  if (callback) {

    sessionListeners.add(
      callback
    );

  }


  if (initialized) {

    if (callback) {

      callback(
        currentSession
      );

    }

    return initializationPromise;

  }


  initialized = true;


  initializationPromise =
    new Promise(
      (resolve) => {

        authReady.then(
          () => {

            observeAuthState(
              async (user) => {

                if (!user) {

                  currentSession =
                    null;

                  sessionInitialized =
                    true;

                  notifySessionListeners();

                  resolve(
                    null
                  );

                  return;

                }


                try {

                  const profile =
                    await getEntity(
                      "users",
                      user.uid
                    );


                  currentSession = {

                    user: {

                      uid:
                        user.uid,

                      email:
                        user.email

                    },

                    profile

                  };


                  sessionInitialized =
                    true;


                  notifySessionListeners();


                  resolve(
                    currentSession
                  );

                } catch (error) {

                  console.error(
                    "NEXUS — Error cargando sesión:",
                    error
                  );


                  currentSession =
                    null;


                  sessionInitialized =
                    true;


                  notifySessionListeners();


                  resolve(
                    null
                  );

                }

              }
            );

          }
        ).catch(
          (error) => {

            console.error(
              "NEXUS — Error inicializando Firebase Auth:",
              error
            );


            currentSession =
              null;


            sessionInitialized =
              true;


            notifySessionListeners();


            resolve(
              null
            );

          }
        );

      }
    );


  return initializationPromise;

}


// ========================================
// REFRESH SESSION PROFILE
// ========================================

export async function refreshSession() {

  if (
    !currentSession ||
    !currentSession.user ||
    !currentSession.user.uid
  ) {

    return null;

  }


  const profile =
    await getEntity(
      "users",
      currentSession.user.uid
    );


  currentSession = {

    ...currentSession,

    profile

  };


  sessionInitialized =
    true;


  notifySessionListeners();


  return currentSession;

}


// ========================================
// GET CURRENT SESSION
// ========================================

export function getCurrentSession() {

  return currentSession;

}


// ========================================
// SESSION INITIALIZED
// ========================================

export function isSessionInitialized() {

  return sessionInitialized;

}


// ========================================
// WAIT FOR AUTHENTICATED SESSION
// ========================================

export function waitForAuthenticatedSession() {

  if (currentSession) {

    return Promise.resolve(
      currentSession
    );

  }


  return new Promise(
    (resolve) => {

      const handleSession =
        (session) => {

          if (!session) {

            return;

          }


          sessionListeners.delete(
            handleSession
          );


          resolve(
            session
          );

        };


      sessionListeners.add(
        handleSession
      );

    }
  );

}


// ========================================
// SESSION CHANGE
// ========================================

export function onSessionChange(
  callback
) {

  sessionListeners.add(
    callback
  );


  return () => {

    sessionListeners.delete(
      callback
    );

  };

}