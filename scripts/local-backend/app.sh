#!/bin/sh
# Starts the Expo bundler pointed at the local backend from start.sh and signs
# in the seeded test account. Development builds only.
set -e
cd "$(dirname "$0")/../.."
ACCOUNT=scripts/local-backend/.test-account.local
[ -f "$ACCOUNT" ] || { echo "Run node scripts/local-backend/seed.cjs first."; exit 1; }
export EXPO_PUBLIC_AURA_USE_EMULATORS=1
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-aura-local
export EXPO_PUBLIC_OUTFIT_INTENT_URL=http://127.0.0.1:5101/demo-aura-local/us-central1/outfitIntent
export EXPO_PUBLIC_AURA_LOCAL_TEST_EMAIL="$(grep '^email=' "$ACCOUNT" | cut -d= -f2)"
export EXPO_PUBLIC_AURA_LOCAL_TEST_PASSWORD="$(grep '^password=' "$ACCOUNT" | cut -d= -f2)"
exec npx expo start --port 8081 --clear
