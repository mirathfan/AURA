/* eslint-disable import/first */
const mockUser = { uid: 'owner' };
const mockAuth: { currentUser: typeof mockUser | null } = { currentUser: mockUser };
const mockPermit = jest.fn(async (_input: { patches: unknown[] }) => ({}));
const mockSet = jest.fn(async (..._args: unknown[]) => undefined);
const mockUpdate = jest.fn(async (..._args: unknown[]) => undefined);
const mockCommit = jest.fn(async (..._args: unknown[]) => undefined);
const mockTx = { get: jest.fn(), set: jest.fn(), update: jest.fn(), delete: jest.fn() };
jest.mock('./firebase', () => ({ app: {}, auth: mockAuth }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: () => mockPermit }));
jest.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSet(...args), updateDoc: (...args: unknown[]) => mockUpdate(...args),
  writeBatch: () => ({ ...mockTx, commit: mockCommit }),
  runTransaction: async (_db: unknown, operation: (tx: unknown) => unknown) => operation(mockTx),
}));
import { setDoc, updateDoc, writeBatch, runTransaction } from './mediaFirestore';
import type { DocumentReference, Firestore } from 'firebase/firestore';
const ref = { path: 'users/owner/items/shirt' } as DocumentReference;
const db = {} as Firestore;
beforeEach(() => { jest.clearAllMocks(); mockAuth.currentUser = mockUser; mockPermit.mockImplementation(async () => ({})); });
it('prepares the protected projection before committing media; excludes timestamp transforms', async () => {
  mockPermit.mockImplementation(async () => { expect(mockSet).not.toHaveBeenCalled(); return {}; });
  await setDoc(ref, { photos: { primaryUrl: 'users/owner/items/shirt/a.jpg' }, updatedAt: { sentinel: true } });
  expect(mockPermit).toHaveBeenCalledWith({ uid: 'owner', target: 'items/shirt', patches: [{ mode: 'set', data: { photos: { primaryUrl: 'users/owner/items/shirt/a.jpg' } } }] });
  expect(mockSet).toHaveBeenCalledTimes(1);
});
it('ordinary scalar edits do not require consent or a permit', async () => { await updateDoc(ref, { updatedAt: 1 }); expect(mockPermit).not.toHaveBeenCalled(); expect(mockUpdate).toHaveBeenCalledTimes(1); });
it('unknown and dotted nested fields are protected by default', async () => { await updateDoc(ref, { 'futureMedia.image': 'users/owner/a.jpg' }); expect(mockPermit).toHaveBeenCalledTimes(1); });
it('a rejected or retired permit cannot commit', async () => { mockPermit.mockRejectedValue(new Error('MEDIA_RETIRED')); await expect(setDoc(ref, { photos: {} })).rejects.toThrow('MEDIA_RETIRED'); expect(mockSet).not.toHaveBeenCalled(); });
it('switching accounts during preparation cannot apply a cached decision', async () => { mockPermit.mockImplementation(async () => { mockAuth.currentUser = { uid: 'other' }; return {}; }); await expect(setDoc(ref, { photos: {} })).rejects.toThrow('Account changed'); expect(mockSet).not.toHaveBeenCalled(); });
it('batches prepare all protected writes before their atomic commit', async () => { const batch = writeBatch(db); batch.set(ref, { photos: {} }); batch.update(ref, { 'photos.primaryUrl': 'users/owner/a.jpg' }); expect(mockPermit).not.toHaveBeenCalled(); await batch.commit(); expect(mockPermit.mock.calls[0][0].patches).toHaveLength(2); expect(mockCommit).toHaveBeenCalledTimes(1); });
it('transactions preserve their reads and defer commit until permits are prepared', async () => { mockTx.get.mockResolvedValue({ exists: () => true }); const result = await runTransaction(db, async (tx) => { await tx.get(ref); tx.update(ref, { photos: {} }); return 7; }); expect(result).toBe(7); expect(mockTx.get).toHaveBeenCalledWith(ref); expect(mockPermit).toHaveBeenCalledTimes(1); });
