# Building and running

## Workspace layout

The three repositories are expected side by side in one folder:

```
shareboard_project/
  server/     ← shareboard_server
  web/        ← shareboard_web
  mobile/     ← shareboard_mobile
  git_scripts/   release and deploy scripts (kept in the workspace, not in a repo)
```

```bash
mkdir shareboard_project && cd shareboard_project
git clone https://github.com/Juan17la/shareboard_server.git server
git clone https://github.com/Juan17la/shareboard_web.git web
git clone https://github.com/Juan17la/shareboard_mobile.git mobile
```

Some checks in `web/` and `mobile/` borrow `tsx` from `server/node_modules`, so
install the server first.

## Requirements

- **Node.js 22** or newer.
- **MongoDB:** a local `mongod` or a free MongoDB Atlas cluster (or run the
  server with `MEMORY_ONLY=true`).
- For the Android app: **Android Studio** (SDK, an emulator) and **JDK 17+**,
  or a phone with a development build.

## 1. Server: http://localhost:3000

```bash
cd server
cp .env.example .env      # set MONGO_URL; the rest has defaults
npm install
npm run dev               # tsx watch: restarts on every change
```

`MEMORY_ONLY=true npm run dev` runs without a database; boards are lost when it
restarts. To try **Draw with AI**, set `AI_API_KEY` (a free Gemini key from
Google AI Studio works with the default `AI_PROVIDER=gemini`). All variables
are listed in [Server internals](../architecture/server.md#configuration).

Production build: `npm run build && npm start`.

## 2. Web: http://localhost:5173

```bash
cd web
cp .env.example .env.local   # optional, defaults point at localhost:3000
npm install
npm run dev
```

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:3000` |
| `VITE_WS_URL` | `ws://localhost:3000/ws` |

Production build: `npm run build` (output in `dist/`). Vercel uses
`vercel.json`: an SPA rewrite so `/board/…` and `/b/…` load the app, and
long-lived caching for hashed assets.

## 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

The app uses native modules (Skia, Reanimated) that **Expo Go does not
include**. Use a development build:

```bash
npx expo run:android          # builds and installs a dev client on the emulator or phone
```

In development the app finds the server on the machine running Expo by itself:
a `localhost` URL is rewritten to that machine's LAN address. To point it
somewhere else:

| Variable | Default |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | `app.json` → `extra.apiBaseUrl` (`http://localhost:3000`) |
| `EXPO_PUBLIC_WS_URL` | `app.json` → `extra.wsUrl` |
| `EXPO_PUBLIC_WEB_URL` | `https://shareboard-web.vercel.app` (share links) |
| `EXPO_PUBLIC_RELEASE` | empty (set by releases; enables the update check) |

### A release APK on your machine

```bash
cd mobile
npx expo prebuild --platform android --no-install
cd android
EXPO_PUBLIC_API_URL=https://shareboard-server.onrender.com \
EXPO_PUBLIC_WS_URL=wss://shareboard-server.onrender.com/ws \
EXPO_PUBLIC_RELEASE=1.5.0-beta NODE_ENV=production \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk
```

- `prebuild` rewrites the `android` / `ios` scripts in `package.json`; revert
  that change.
- Gradle does not notice when only `EXPO_PUBLIC_*` values change. Run
  `./gradlew createBundleReleaseJsAndAssets --rerun` first, or the APK keeps
  the old JavaScript bundle.
- The first build takes around 20 minutes; later ones with only JavaScript
  changes take a minute or two.

EAS (Expo's cloud build) also works: `npx eas-cli build --profile beta
--platform android` (profiles in `eas.json`).

## Checks

Run before every commit to a shared branch:

```bash
cd server && npm run typecheck
cd web    && npm run lint && npm run build && npm run check:geometry
cd mobile && npm run lint && npx tsc --noEmit && npm run check:geometry && npm run check:update
```

With a server running: `server$ npm run smoke` and `mobile$ npm run check:socket`.
Both create test boards on that server.

## Code style

- TypeScript everywhere, strict mode.
- Prettier, no config file: run it as
  `npx prettier --single-quote --print-width 100 --trailing-comma all --write <files>`.
- Comments explain *why*, not *what*. A deliberate shortcut with a known limit
  is marked `ponytail:` with its upgrade path.
- A change to the [data model](../architecture/data-model.md) or the
  [protocol](../architecture/communication.md) is made in all three projects,
  and a change to shared client logic in both clients.
- New fields are optional, so older apps and boards keep working.
