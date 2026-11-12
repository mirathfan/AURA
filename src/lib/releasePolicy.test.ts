import { releaseBlocker } from './releasePolicy';
it.each([null, {}, { minimumContract: 1 }, { minimumContract: '2' }, { minimumContract: -1 }])('does not invent an upgrade requirement: %p', (policy) => expect(releaseBlocker(policy)).toBeNull());
it('uses the operator-controlled contract floor for updated clients', () => expect(releaseBlocker({ minimumContract: 2 })).toBe('upgrade'));
it('maintenance takes priority without deleting account state', () => expect(releaseBlocker({ maintenance: true, minimumContract: 2 })).toBe('maintenance'));
