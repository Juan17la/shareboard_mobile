# Releasing

Server, web and mobile are versioned **together**: one version number (for
example `1.4.1-beta`) is released in all three at once, even if one of them did
not change. Versions follow [Semantic Versioning](https://semver.org/), with
`-beta` while the app is in beta.

## Branches

Each repository has:

| Branch | Role |
|--------|------|
| `main` | What is deployed. Render (server) and Vercel (web) deploy from it |
| `develop` | Integration branch |
| `feature/*`, `fix/*` | One per change, branched from `develop`, merged back with `--no-ff` |
| `release/<version>` | The version bump and dated changelog, merged into `main` and back into `develop` |

Tags are `v<version>` on `main`.

## Changelogs

Each repository has a `CHANGELOG.md` in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. New entries go
under `## [Unreleased]`, grouped as *Added*, *Changed*, *Fixed*. They are
written for users: what changed for them, not which file changed. The release
script turns `Unreleased` into the version and date, and that section becomes
the GitHub release notes.

## The scripts

They live in `git_scripts/` in the workspace folder (not in any repository).

| Script | Does |
|--------|------|
| `commit-all.sh` | Commits pending work as `feature/*` / `fix/*` branches off `develop` in each project, merges them `--no-ff`. Re-runnable: merged blocks are skipped. Never pushes |
| `deploy.sh [server] [web] [mobile]` | Checks, merges `develop` into `main`, pushes: deploys without a new version |
| `release.sh <version>` | A full release (below) |
| `release-now.sh [version]` | `release.sh` with a local APK build and no waiting for Render/Vercel |

### What `release.sh <version>` does

1. Runs `commit-all.sh`; every repository must then be clean.
2. Runs every project's checks; nothing is tagged or pushed if one fails.
3. Per project: `release/<version>` off `develop` with the version in
   `package.json`, the dated changelog section and, for mobile, the version and
   server URL in the EAS `beta` profile. Merged into `main`, tagged
   `v<version>`, merged back into `develop`.
4. Pushes branches and tags. Pushing `main` deploys the server (Render) and the
   web (Vercel). The tag triggers `.github/workflows/release.yml`, which re-runs
   the checks and publishes a GitHub pre-release with the changelog section as
   notes.
5. Waits until the server's `/health` reports the new `version` (the app is
   built against the new server). `WAIT=0` skips this.
6. Builds the APK locally with Gradle (`BUILD=local`, default) or on EAS
   (`BUILD=eas`), checks that the bundle contains the version and the server
   URL, copies it to `APK_DIR` (`~/Documents/apks_builds`) and attaches it to the
   mobile GitHub release as `shareboard-v<version>.apk`. Installed apps then
   offer it on their next launch.

Options (environment variables):

| Variable | Default | |
|----------|---------|--|
| `API_URL` | `https://shareboard-server.onrender.com` | The server the APK talks to |
| `BUILD` | `local` | `local`, `eas` or `none` |
| `ARCHS` | `arm64-v8a,x86_64` | CPU builds in the APK (phones and the emulator) |
| `WAIT` | `1` | Wait for `/health` to show the new version |
| `WEB_URL` | — | Also check that Vercel serves the SPA rewrite |
| `RENDER_DEPLOY_HOOK` | — | Render deploy hook URL, if Auto-Deploy is off |

The script is re-runnable: a project that already has the tag skips step 3, and
running it again retries a failed build.

## Checklist

1. Every change has an entry under `Unreleased` in the changelogs of the
   projects it touches.
2. The committed `develop` builds on its own (not just the working copy).
3. `./git_scripts/release.sh <next version>`.
4. Check: `https://shareboard-server.onrender.com/health` shows the version;
   the web app loads; the GitHub release of `shareboard_mobile` has exactly one
   `.apk`; an installed app offers the update.

Needs once: `gh auth login`; for local builds the Android SDK (`ANDROID_HOME`,
default `~/Android/Sdk`) and a JDK; for EAS builds `npx eas-cli login`.
