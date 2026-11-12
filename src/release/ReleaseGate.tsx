import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { router, usePathname, type Href } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAppTheme } from '../hooks/useAppTheme';
import { releaseBlocker } from '../lib/releasePolicy';
import { AURA_PUBLIC_DETAILS } from '../../shared/privacyPolicy';
export function useReleaseBlocker() {
  const [policy, setPolicy] = useState<unknown>(null);
  useEffect(() => onSnapshot(doc(db, 'releaseControl', 'client'), (snap) => setPolicy(snap.data() ?? null), () => {
    // Keep a previously observed requirement. Offline state never grants any
    // backend permission and must not erase the last observed update notice.
  }), []);
  const path = usePathname();
  return ['/privacy', '/account-deletion'].includes(path) ? null : releaseBlocker(policy);
}
export function ReleaseGate({ reason }: { reason: 'upgrade' | 'maintenance' }) {
  const { colors } = useAppTheme();
  const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert('Unable to open', `Contact ${AURA_PUBLIC_DETAILS.supportEmail} for help.`));
  return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 28, gap: 20 }}>
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>{reason === 'upgrade' ? 'Update AURA to continue' : 'AURA is being updated'}</Text>
    <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}>Your account and wardrobe are kept. {reason === 'upgrade' ? 'Install the latest available beta from TestFlight.' : 'Please try again shortly.'} Privacy information and account deletion remain available.</Text>
    {reason === 'upgrade' && <Pressable accessibilityRole="button" onPress={() => open('itms-beta://')}><Text style={{ color: colors.textPrimary }}>Open TestFlight</Text></Pressable>}
    <Pressable accessibilityRole="link" onPress={() => router.push('/privacy' as Href)}><Text style={{ color: colors.textPrimary }}>Privacy Policy</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/account-deletion' as Href)}><Text style={{ color: colors.textPrimary }}>Account deletion</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => open(`mailto:${AURA_PUBLIC_DETAILS.supportEmail}`)}><Text style={{ color: colors.textPrimary }}>Contact support</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { void signOut(auth).catch(() => Alert.alert('Unable to sign out', 'Please try again.')); }}><Text style={{ color: colors.textSecondary }}>Sign out</Text></Pressable>
  </View>;
}
