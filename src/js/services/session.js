// ========================================
// NEXUS — Session Service
// ========================================

import {
  authReady
} from "./firebase.js";

import {
  observeAuthState
} from "./auth.js";

import {
  getEntity
} from "./firestore.js";


// ========================================
// CURRENT SESSION
// ========================================

let currentSession =
  null;


// ========================================
// SESSION STATE
// ========================================

let initialized =
  false;

let initializationPromise =
  null;

let sessionInitialized =
  false;


// ========================================
// SESSION LISTENERS
// ========================================

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

  // ========================================
  // REGISTER CALLBACK
  // ========================================

  if (callback) {

    sessionListeners.add(
      callback
    );

  }


  // ========================================
  // ALREADY INITIALIZED
  // ========================================

  if (initialized) {

    if (callback) {

      callback(
        currentSession
      );

    }

    return initializationPromise;

  }


  // ========================================
  // INITIALIZATION
  // ========================================

  initialized =
    true;


  initializationPromise =
    new Promise(
      (resolve) => {

        // ========================================
        // WAIT FOR AUTH PERSISTENCE
        // ========================================

        authReady.then(
          () => {

            // ========================================
            // OBSERVE AUTH STATE
            // ========================================

            observeAuthState(
              async (user) => {

                // ========================================
                // NO AUTHENTICATED USER
                // ========================================

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


                // ========================================
                // GET NEXUS USER PROFILE
                // ========================================

                try {

                  const profile =
                    await getEntity(
                      "users",
                      user.uid
                    );


                  // ========================================
                  // CREATE SESSION
                  // ========================================

                  currentSession = {

                    user: {

                      uid:
                        user.uid,

                      email:
                        user.email

                    },

                    profile:
                      profile

                  };


                  // ========================================
                  // SESSION READY
                  // ========================================

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
// GET CURRENT SESSION
// ========================================

export function getCurrentSession() {

  return currentSession;

}


// ========================================
// SESSION INITIALIZATION STATE
// ========================================

export function isSessionInitialized() {

  return sessionInitialized;

}


// ========================================
// WAIT FOR AUTHENTICATED SESSION
// ========================================

export function waitForAuthenticatedSession() {

  // ========================================
  // SESSION ALREADY AVAILABLE
  // ========================================

  if (currentSession) {

    return Promise.resolve(
      currentSession
    );

  }


  // ========================================
  // WAIT FOR SESSION
  // ========================================

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
// SESSION LISTENER
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