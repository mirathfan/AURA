#!/bin/sh
# Starts a complete local AURA backend: Auth, Firestore, Storage and Functions
# emulators, with every AI provider call answered by a local stand-in.
# No cloud project, billing, live data or API key is involved.
set -e
cd "$(dirname "$0")/../.."
( cd functions && npm run build )
# Placeholder values so the emulator does not stop to ask for them. Both files
# are ignored by git and by deploys, and hold nothing real.
printf 'OPENAI_API_KEY=local-stand-in-not-a-real-key\nAPPLE_REVOCATION_PRIVATE_KEY=local-stand-in-not-a-real-key\n' > functions/.secret.local
printf 'APPLE_REVOCATION_TEAM_ID=LOCALTEAM\nAPPLE_REVOCATION_KEY_ID=LOCALKEY\nAPPLE_REVOCATION_CLIENT_ID=com.kasat.aura\n' > functions/.env.local
export NODE_OPTIONS="--require $(pwd)/scripts/local-backend/openai-stub.cjs"
exec npx --yes firebase-tools@latest emulators:start \
  --project demo-aura-local \
  --config firebase.local-dev.json \
  --only auth,firestore,storage,functions
