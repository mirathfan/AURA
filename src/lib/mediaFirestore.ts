/* eslint-disable import/export -- Explicit mutations override the SDK star re-export. */
// Explicit write adapter: reads/listeners retain normal Firebase behavior. All
// non-scalar/unknown fields receive a server permit before the original SDK
// commit, which still evaluates the normal Firestore rules and transactions.
import * as firestore from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase';
import { mediaProjection, needsMediaPermit } from '../../shared/mediaSafety';
export * from 'firebase/firestore';
type Patch = { data: Record<string, unknown>; mode: 'set' | 'merge' | 'update' };
type Pending = Map<string, { ref: firestore.DocumentReference; patches: Patch[] }>;
function enqueue(pending: Pending, ref: firestore.DocumentReference, data: firestore.DocumentData, mode: Patch['mode']) {
  if (!needsMediaPermit(data) && mode !== 'set') return;
  const projected = Object.fromEntries(Object.entries(data).filter(([key]) => needsMediaPermit({ [key]: true })));
  // A full replacement can drop protected fields and therefore needs a permit.
  const entry = pending.get(ref.path) ?? { ref, patches: [] };
  entry.patches.push({ data: mode === 'set' ? mediaProjection(data) : projected, mode });
  pending.set(ref.path, entry);
}
async function prepare(pending: Pending) {
  if (!pending.size) return;
  const user = auth.currentUser;
  for (const { ref, patches } of pending.values()) {
    const [root, uid, ...target] = ref.path.split('/');
    if (!user || root !== 'users' || uid !== user.uid || auth.currentUser !== user) throw new Error('Account changed. Please try again.');
    await httpsCallable(getFunctions(app), 'prepareMediaWrite')({ uid, target: target.join('/'), patches });
    if (auth.currentUser !== user) throw new Error('Account changed. Please try again.');
  }
}
export const setDoc = (async (ref: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions) => {
  const pending: Pending = new Map();
  if (options && 'mergeFields' in options) throw new Error('Use explicit merge fields in the media adapter.');
  enqueue(pending, ref, data, (options && 'merge' in options && options.merge) ? 'merge' : 'set');
  await prepare(pending);
  return options ? firestore.setDoc(ref, data, options) : firestore.setDoc(ref, data);
}) as typeof firestore.setDoc;
export const updateDoc = (async (ref: firestore.DocumentReference, data: firestore.DocumentData) => {
  const pending: Pending = new Map(); enqueue(pending, ref, data, 'update'); await prepare(pending);
  return firestore.updateDoc(ref, data);
}) as typeof firestore.updateDoc;
export const addDoc: typeof firestore.addDoc = async (collection, data) => {
  const ref = firestore.doc(collection); await setDoc(ref, data); return ref;
};
export const writeBatch: typeof firestore.writeBatch = (db) => {
  const batch = firestore.writeBatch(db); const pending: Pending = new Map();
  const adapter = {
    set(ref: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions) {
      if (options && 'mergeFields' in options) throw new Error('Unsupported mergeFields.');
      enqueue(pending, ref, data, (options && 'merge' in options && options.merge) ? 'merge' : 'set');
      if (options) batch.set(ref, data, options); else batch.set(ref, data); return adapter;
    },
    update(ref: firestore.DocumentReference, data: firestore.DocumentData) { enqueue(pending, ref, data, 'update'); batch.update(ref, data); return adapter; },
    delete(ref: firestore.DocumentReference) { batch.delete(ref); return adapter; },
    async commit() { await prepare(pending); return batch.commit(); },
  };
  return adapter as firestore.WriteBatch;
};
export const runTransaction: typeof firestore.runTransaction = (db, update, options) => firestore.runTransaction(db, async (tx) => {
  const pending: Pending = new Map();
  const adapter = {
    get: tx.get.bind(tx),
    set(ref: firestore.DocumentReference, data: firestore.DocumentData, setOptions?: firestore.SetOptions) {
      if (setOptions && 'mergeFields' in setOptions) throw new Error('Unsupported mergeFields.');
      enqueue(pending, ref, data, (setOptions && 'merge' in setOptions && setOptions.merge) ? 'merge' : 'set');
      if (setOptions) tx.set(ref, data, setOptions); else tx.set(ref, data); return adapter;
    },
    update(ref: firestore.DocumentReference, data: firestore.DocumentData) { enqueue(pending, ref, data, 'update'); tx.update(ref, data); return adapter; },
    delete(ref: firestore.DocumentReference) { tx.delete(ref); return adapter; },
  };
  const result = await update(adapter as firestore.Transaction);
  await prepare(pending); return result;
}, options);
