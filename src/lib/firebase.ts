import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  type Auth,
  type Persistence,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

import { firebaseConfigStatus, logFirebaseConfigProblem } from "./firebaseConfig";

// Certificate pinning is handled by Firebase SDK.
// Do not override or disable SSL verification anywhere in this codebase.
type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

function isDevBuild() {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

function getAsyncStoragePersistence(storage: typeof AsyncStorage): Persistence {
  return class ReactNativeAsyncStoragePersistence {
    static type = "LOCAL" as const;
    readonly type = "LOCAL" as const;

    async _isAvailable() {
      try {
        const testKey = "__firebase_auth_storage_test__";
        await storage.setItem(testKey, "1");
        await storage.removeItem(testKey);
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const value = await storage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {
      return;
    }

    _removeListener() {
      return;
    }
  } as unknown as Persistence;
}

// Local backend for development. Only a development build with
// EXPO_PUBLIC_AURA_USE_EMULATORS=1 talks to the Firebase emulators on this
// machine; a release build can never take this path. Ports match
// firebase.local-dev.json.
const LOCAL_EMULATOR_HOST = "127.0.0.1";
const LOCAL_EMULATOR_PROJECT_ID = "demo-aura-local";
const LOCAL_EMULATOR_PORTS = { auth: 19098, firestore: 8189, storage: 9399, functions: 5101 } as const;

export function isUsingLocalEmulators() {
  return isDevBuild() && process.env.EXPO_PUBLIC_AURA_USE_EMULATORS === "1";
}

function connectLocalEmulators(services: FirebaseServices) {
  connectAuthEmulator(services.auth, `http://${LOCAL_EMULATOR_HOST}:${LOCAL_EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(services.db, LOCAL_EMULATOR_HOST, LOCAL_EMULATOR_PORTS.firestore);
  connectStorageEmulator(services.storage, LOCAL_EMULATOR_HOST, LOCAL_EMULATOR_PORTS.storage);
  // Every callable in the app uses the default us-central1 instance.
  connectFunctionsEmulator(getFunctions(services.app), LOCAL_EMULATOR_HOST, LOCAL_EMULATOR_PORTS.functions);
  console.warn("[Firebase] Using LOCAL emulators. No live data is read or written.");

  // Optional convenience for local testing: sign in the seeded test account
  // from scripts/local-backend/seed.cjs. It can only reach the auth emulator.
  const email = process.env.EXPO_PUBLIC_AURA_LOCAL_TEST_EMAIL;
  const password = process.env.EXPO_PUBLIC_AURA_LOCAL_TEST_PASSWORD;
  if (email && password) {
    signInWithEmailAndPassword(services.auth, email, password).catch((error) => {
      console.warn("[Firebase] Local test sign-in failed.", error instanceof Error ? error.message : String(error));
    });
  }
}

function firebaseUnavailableError(serviceName: string) {
  const error = new Error(`AURA Firebase ${serviceName} is unavailable.`);
  error.name = "FirebaseConfigurationError";
  return error;
}

function unavailableFirebaseService<T extends object>(serviceName: string): T {
  return new Proxy({} as T, {
    get() {
      throw firebaseUnavailableError(serviceName);
    },
    set() {
      throw firebaseUnavailableError(serviceName);
    },
  });
}

function logFirebaseInitializationError(error: unknown) {
  if (isDevBuild()) {
    console.error("[Firebase] Failed to initialize Firebase services.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  console.error("[Firebase] Failed to initialize Firebase services.");
}

function initializeFirebaseServices(): FirebaseServices | null {
  if (!firebaseConfigStatus.ok) {
    logFirebaseConfigProblem(firebaseConfigStatus);
    return null;
  }

  try {
    // In emulator mode the app always uses a demo project id, so nothing can
    // address the live project even by accident.
    const config = isUsingLocalEmulators()
      ? { ...firebaseConfigStatus.config, projectId: LOCAL_EMULATOR_PROJECT_ID }
      : firebaseConfigStatus.config;
    const app = getApps().length ? getApp() : initializeApp(config);
    let auth: Auth;
    try {
      auth = initializeAuth(app, {
        persistence: getAsyncStoragePersistence(AsyncStorage),
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== "auth/already-initialized") {
        throw error;
      }
      auth = getAuth(app);
    }

    const services: FirebaseServices = {
      app,
      auth,
      db: getFirestore(app),
      storage: getStorage(app),
    };
    if (isUsingLocalEmulators()) connectLocalEmulators(services);
    return services;
  } catch (error) {
    firebaseInitializationError = error instanceof Error ? error : new Error("Firebase initialization failed.");
    logFirebaseInitializationError(error);
    return null;
  }
}

export let firebaseInitializationError: Error | null = null;
const firebaseServices = initializeFirebaseServices();

export function hasFirebaseServices() {
  return firebaseServices !== null;
}

export function requireFirebaseServices() {
  if (!firebaseServices) throw firebaseUnavailableError("services");
  return firebaseServices;
}

export { firebaseConfigStatus };

export const app = firebaseServices?.app ?? unavailableFirebaseService<FirebaseApp>("app");
export const auth = firebaseServices?.auth ?? unavailableFirebaseService<Auth>("auth");
export const db = firebaseServices?.db ?? unavailableFirebaseService<Firestore>("db");
export const storage =
  firebaseServices?.storage ?? unavailableFirebaseService<FirebaseStorage>("storage");
