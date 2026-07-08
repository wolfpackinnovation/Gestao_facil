import {
  db,
} from '@/lib/firebase'
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
  FirestoreDataConverter,
  WithFieldValue,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'

export type DocumentId = string

export interface BaseEntity {
  id?: DocumentId
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

function getConverter<T extends BaseEntity>(): FirestoreDataConverter<T> {
  return {
    toFirestore(entity: WithFieldValue<T>): DocumentData {
      const { id, ...data } = entity as any
      return {
        ...data,
        updatedAt: Timestamp.now(),
        createdAt: data.createdAt ?? Timestamp.now(),
      }
    },
    fromFirestore(snapshot, options): T {
      const data = snapshot.data(options) as T
      return {
        ...data,
        id: snapshot.id,
      }
    },
  }
}

function colRef<T extends BaseEntity>(collectionName: string) {
  return collection(db, collectionName).withConverter(getConverter<T>())
}

function docRef<T extends BaseEntity>(collectionName: string, docId: string) {
  return doc(db, collectionName, docId).withConverter(getConverter<T>())
}

export async function create<T extends BaseEntity>(
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<DocumentId> {
  const ref = colRef<T>(collectionName)
  const docSnap = await addDoc(ref, data as any)
  return docSnap.id
}

export async function createWithId<T extends BaseEntity>(
  collectionName: string,
  id: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const ref = docRef<T>(collectionName, id)
  await setDoc(ref, data as any)
}

export async function get<T extends BaseEntity>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const ref = docRef<T>(collectionName, docId)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export async function getAll<T extends BaseEntity>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const ref = colRef<T>(collectionName)
  const q = constraints.length ? query(ref, ...constraints) : ref
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data())
}

export async function update<T extends BaseEntity>(
  collectionName: string,
  docId: string,
  data: Partial<Omit<T, 'id' | 'createdAt'>>
): Promise<void> {
  const ref = docRef<T>(collectionName, docId)
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  } as any)
}

export async function remove(
  collectionName: string,
  docId: string
): Promise<void> {
  const ref = doc(db, collectionName, docId)
  await deleteDoc(ref)
}

export async function upsert<T extends BaseEntity>(
  collectionName: string,
  docId: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const ref = docRef<T>(collectionName, docId)
  await setDoc(ref, data as any, { merge: true })
}

export function subscribe<T extends BaseEntity>(
  collectionName: string,
  callback: (items: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const ref = colRef<T>(collectionName)
  const q = constraints.length ? query(ref, ...constraints) : ref
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => d.data()))
  })
}

export function subscribeDoc<T extends BaseEntity>(
  collectionName: string,
  docId: string,
  callback: (item: T | null) => void
): Unsubscribe {
  const ref = docRef<T>(collectionName, docId)
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export { where, orderBy, limit, Timestamp }
export type { QueryConstraint, Unsubscribe }
