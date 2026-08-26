# Zero to Deploy — xMind

A fresh-machine, copy-paste runbook for taking xMind from `git clone` to live on the App Store, Play Store, and Vercel. Every command works on macOS, Linux, and Windows (PowerShell). Where a step is platform-specific, both invocations are shown.

---

## 0. Accounts you'll need (free tiers cover the demo)

1. **GitHub** — fork or clone the repo
2. **MongoDB Atlas** — free shared cluster
3. **Clerk** — free dev tier; create an "Expo / React Native" application
4. **Cloudinary** — free tier; you only need API key + secret + cloud name
5. **Arcjet** — free 100k req/month; create a site key
6. **Vercel** — free hobby tier for the backend
7. **Expo** account — free; needed for `eas build`
8. **Apple Developer** ($99/yr) — only if you want to ship to TestFlight / App Store
9. **Google Play Console** ($25 one-time) — only if you want to ship to Play Store

---

## 1. Install local toolchain

### macOS / Linux

```bash
# Node 20 LTS via Homebrew or your package manager
brew install node@20
node -v   # should print v20.x

# Expo CLI is bundled — no global install needed; use npx
npx --version
```

### Windows (PowerShell)

```powershell
winget install OpenJS.NodeJS.LTS
node -v   # should print v20.x
```

### Mobile build prerequisites

- **iOS native builds (macOS only):** Xcode 15+ from the Mac App Store, then `xcode-select --install`
- **Android native builds (any OS):** [Android Studio](https://developer.android.com/studio) with the API 34 SDK + emulator
- For the JS-only path you can skip both and use **Expo Go** on a physical device.

### Expo & EAS

```bash
npm i -g eas-cli   # one-time global install for build/submit
eas --version
eas login
```

---

## 2. Clone the repo

```bash
git clone https://github.com/aashir-athar/xmind-app.git
cd xmind-app
```

The repo is split:

- `Mobile/` — Expo app
- `Backend/` — Vercel-deployable Express API

---

## 3. Configure the backend

### 3.1 MongoDB Atlas

1. Create a free M0 cluster at https://cloud.mongodb.com
2. Add a database user (`Database Access` → `Add New Database User`)
3. Allow network access from anywhere: `0.0.0.0/0` (Vercel) — or set Vercel's egress IPs if you need stricter
4. Copy the SRV connection string

### 3.2 Clerk

1. Create an application in https://dashboard.clerk.com (choose "Expo" template)
2. Note both keys:
   - **Publishable key** → mobile (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`)
   - **Secret key** → backend (`CLERK_SECRET_KEY`)

### 3.3 Cloudinary

1. Sign up at https://cloudinary.com
2. From the dashboard, copy the **Cloud name**, **API Key**, and **API Secret**

### 3.4 Arcjet

1. Create a site at https://arcjet.com
2. Copy the **Arcjet Key** (starts with `ajkey_…`)

### 3.5 Backend `.env`

```bash
cd Backend
cp .env.example .env
```

Fill in:

```
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/xmind?retryWrites=true&w=majority
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ARCJET_KEY=ajkey_...
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
```

### 3.6 Run the backend locally

```bash
npm install
npm run dev   # node --watch src/server.js → http://localhost:5001
```

Verify: open `http://localhost:5001/` — you should see `{"ok":true,"name":"xMind API"}`.

---

## 4. Configure the mobile app

### 4.1 Mobile `.env`

```bash
cd ../Mobile
cp .env.example .env
```

Fill in:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# Pointing at the local backend during development:
EXPO_PUBLIC_API_URL=http://192.168.x.x:5001/api
```

> Replace `192.168.x.x` with your machine's LAN IP — `localhost` will not resolve from a physical device.
> On a simulator/emulator you can use `http://localhost:5001/api`.

### 4.2 Install dependencies

```bash
npm install --legacy-peer-deps
```

> The `--legacy-peer-deps` flag is needed because of a transitive `react-native-windows` peer-range constraint that disagrees with React 19. The build itself is unaffected.

### 4.3 Start the dev server

```bash
npx expo start
```

- Press `i` to open the iOS simulator (macOS only)
- Press `a` to open an Android emulator
- Or scan the QR code with Expo Go on your physical device

### 4.4 Optional — build a custom dev client (required for `expo-glass-effect`)

```bash
npx expo install expo-dev-client
eas build --profile development --platform ios   # or android
```

Once installed on your device, run `npx expo start --dev-client` and the Liquid Glass surfaces will render natively on iOS 26.

---

## 5. Deploy the backend to Vercel

### 5.1 Push to GitHub

The backend is already in this repo under `Backend/`. Make sure it's committed.

### 5.2 Import to Vercel

1. https://vercel.com/new → Import the GitHub repo
2. **Root Directory** → `Backend`
3. **Framework preset** → "Other"
4. **Build command** → leave blank (Vercel auto-detects `npm install` and runs `src/server.js`)
5. Add environment variables from `Backend/.env` (every key from section 3.5 except `PORT`)
6. Deploy

Vercel will give you a URL like `https://xmind-app.vercel.app`.

### 5.3 Point the mobile app at production

In `Mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://xmind-app.vercel.app/api
```

Restart the Expo dev server for the new env var to load.

---

## 6. Build the mobile app for the stores

### 6.1 Configure EAS

If `eas.json` doesn't exist yet, create one in `Mobile/`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 6.2 Build

```bash
cd Mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

EAS will spin up a cloud build, sign with credentials it stores for you, and post a download link when finished.

### 6.3 Submit

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

iOS lands in App Store Connect (TestFlight); Android lands in the Google Play Console.

### 6.4 OTA updates after launch

```bash
eas update --branch production --message "Hotfix: feed ranker tuning"
```

OTA updates ship JS/asset changes without a store review — keep them tight and don't change native code in OTA channels.

---

## 7. Known caveats

- **Clerk + custom dev client.** OAuth (Apple / Google) requires a dev client when testing on iOS. Expo Go falls back to development URLs that Clerk can't redirect to.
- **Arcjet first-request bot flag.** A fresh device may get a single 403 with `error: "Bot access denied"`. The mobile API client retries once automatically — see `Mobile/utils/api.ts`.
- **MongoDB Atlas IP allow-list.** If you tighten Atlas to specific IPs, you must add Vercel's egress IPs (or set `0.0.0.0/0` and rely on the strong DB user password).
- **`--legacy-peer-deps` on npm install.** Caused by `react-native-lazy-image-loader` declaring a stale React peer range. Safe to keep.
- **Avatar / banner aspect ratios.** Banner is 3:1; avatar is square. Cloudinary auto-trims to those dimensions when the user uploads.

---

## 8. Smoke test

After deploying:

1. Hit `https://<your-vercel-url>/` — should return `{ ok: true, name: "xMind API" }`.
2. Open the mobile app, sign in with Apple or Google.
3. Post one short message with a `#hashtag`.
4. Pull-to-refresh the feed.
5. Wait 5 minutes, then check the trending rail — your hashtag should appear.

If everything works, you're live. Star the repo, file a "good first issue" if anything tripped you up, and ship.