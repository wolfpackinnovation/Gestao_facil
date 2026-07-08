import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}

const firebaseConfig = {
  apiKey: 'AIzaSyAW8fUc38Hi1WxYhHL0fTnwo9Kvbwerft4',
  authDomain: 'gestaofacil-2f34c.firebaseapp.com',
  projectId: 'gestaofacil-2f34c',
  storageBucket: 'gestaofacil-2f34c.firebasestorage.app',
  messagingSenderId: '802298074107',
  appId: '1:802298074107:web:e2e892597abe87a80d315e',
  measurementId: 'G-PXQPE92TXG',
}

function getFirebase() {
  const existing = getApps()

  if (existing.length) {
    const app = existing[0]
    const db = getFirestore(app)
    const auth = getAuth(app)
    const storage = getStorage(app)
    return { app, db, auth, storage }
  }

  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth(app)
  const storage = getStorage(app)

  if (__DEV__ && extra.firebaseUseEmulator === 'true') {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
    connectStorageEmulator(storage, 'localhost', 9199)
  }

  return { app, db, auth, storage }
}

const { app, db, auth, storage } = getFirebase()

export { db, auth, storage }
export default app
