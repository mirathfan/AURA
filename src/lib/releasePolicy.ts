// Advisory UX only. Rules, media permits, consent and deletion fences enforce
// safety even when a client lies about its version or ignores this policy.
export const CLIENT_CONTRACT_VERSION = 1;
export function releaseBlocker(policy: unknown, contract = CLIENT_CONTRACT_VERSION): 'upgrade' | 'maintenance' | null {
  if (!policy || typeof policy !== 'object') return null;
  const data = policy as Record<string, unknown>;
  if (data.maintenance === true) return 'maintenance';
  if (Number.isInteger(data.minimumContract) && (data.minimumContract as number) > contract) return 'upgrade';
  return null;
}
