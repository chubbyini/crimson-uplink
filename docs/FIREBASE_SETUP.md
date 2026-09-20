# Firebase setup (5 min)

1. Create a project at https://console.firebase.google.com → Add project.
2. **Authentication** → Sign-in method → enable **Google**. Add your localhost
   + hosting domains under Authorized domains.
3. **Firestore Database** → Create database (production mode). Then
   **Rules** → paste `firestore.rules` from repo root (per-user:
   `users/{uid}/...` owner-only) → Publish.
4. Project settings → **Your apps** → Web app (`</>`) → copy config values.
5. `apps/web/.env.local` (never commit):
   `NEXT_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID` from step 4.
   See `apps/web/.env.example`.
6. Run `cd apps/web; npm install; npm run dev` → header shows
   **Sign in with Google** (or **Connect Firebase** until env is set).

Per-user data lives under `users/{uid}/{sources,items,ideas,drafts,
publishes,stats,settings}` — enforced by `firestore.rules`.
