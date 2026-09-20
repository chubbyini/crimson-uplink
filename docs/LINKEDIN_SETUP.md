# LinkedIn setup (10 min, one time + refresh every ~60 days)

You need: a LinkedIn Developer app + a personal access token with
`openid` + `w_member_social`. The app stores the token you paste
(`users/{uid}/settings` → LinkedIn token); publishing is one call per
approved draft, nothing else.

## 1. Create the app

1. https://developer.linkedin.com → Create app.
2. Name: `Crimson Uplink`, logo: any square image.
3. **Privacy Policy URL:** `https://<your-vercel-domain>/privacy`
   (shipped in-app for exactly this field).
4. Verify (company page or phone), create.

## 2. Request products

App → Products tab → request access to:

- **Share on LinkedIn** (gives `w_member_social`)
- **Sign In with LinkedIn using OpenID Connect** (gives `openid`)

Both are self-serve for personal use; approval is usually fast.

## 3. Mint a token (manual code flow, no backend needed yet)

1. App → Auth tab → add Redirect URL: `https://www.linkedin.com/developers/tools/oauth/redirect`
   (LinkedIn's own token-generator redirect).
2. Build this URL (fill `YOUR_CLIENT_ID` from the Auth tab):
   `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https%3A%2F%2Fwww.linkedin.com%2Fdevelopers%2Ftools%2Foauth%2Fredirect&scope=openid%20w_member_social`
3. Open it, approve → the redirect page shows a `code`.
4. Exchange it (terminal; fill values):
   `curl -X POST https://www.linkedin.com/oauth/v2/accessToken -d grant_type=authorization_code -d code=PASTE_CODE -d client_id=YOUR_CLIENT_ID -d client_secret=YOUR_CLIENT_SECRET -d redirect_uri=https://www.linkedin.com/developers/tools/oauth/redirect`
5. Copy `access_token` → Crimson Uplink **Settings → LinkedIn token** → Save.

## 4. Test

Drafts → approved linkedin draft → **Publish to LinkedIn** → View live link.
First failure mode is almost always scopes: re-check step 2 and re-mint.

## 5. Refresh (~60 days)

Personal tokens expire. Repeat step 3, paste the new token. (Post-MVP:
per-user OAuth login removes this chore.)
