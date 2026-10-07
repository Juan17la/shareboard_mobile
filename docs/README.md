# Shareboard documentation

Shareboard is a collaborative whiteboard. Several people draw on the same
infinite board at the same time, from a browser or the Android app, with no
account. This folder documents what the app does and how it works inside.

Shareboard is made of three projects. Each one is its own Git repository:

| Project | Repository | What it is |
|---------|------------|------------|
| Server | [shareboard_server](https://github.com/Juan17la/shareboard_server) | Fastify + TypeScript. REST API, WebSocket, MongoDB |
| Web | [shareboard_web](https://github.com/Juan17la/shareboard_web) | React + Vite app, served at <https://shareboard-web.vercel.app> |
| Mobile | [shareboard_mobile](https://github.com/Juan17la/shareboard_mobile) | Expo / React Native Android app (this repository) |

## Where to start

| I want to... | Read |
|--------------|------|
| Install the app and draw my first board | [Getting started](user-guide/getting-started.md) |
| Learn every tool and feature | [Features](user-guide/features.md) |
| Fix a problem | [Troubleshooting](user-guide/troubleshooting.md) |
| Understand the overall design | [Architecture overview](architecture/overview.md) |
| Know what a board is made of | [Data model](architecture/data-model.md) |
| See how the apps talk to the server | [Communication: REST and WebSocket](architecture/communication.md) |
| Understand the backend | [Server internals](architecture/server.md) |
| Understand the web and mobile apps | [Client internals](architecture/clients.md) |
| Run everything on my machine | [Building and running](development/building.md) |
| Ship a new version | [Releasing](development/releasing.md) |

## Other material

- `plans/` holds the short design notes written before each feature (one file
  per change, numbered in the order they were made). They explain *why* a
  feature behaves the way it does.
- Each repository has a `CHANGELOG.md` with every released change.
- The visual design the app follows lives outside the repositories, in
  `Shareboard Mobile App Design/`.

## A note on older references

Code comments sometimes point at `docs/01-introduction`, `docs/02-backend-connection`,
`docs/05-model-date`, `docs/06-loading-exporting` or `docs/07-websockets`.
Those were the original specification files. Their content now lives here:

| Old reference | Now |
|---------------|-----|
| 01-introduction | [Architecture overview](architecture/overview.md) |
| 02-backend-connection | [Communication](architecture/communication.md) (REST) |
| 05-model-date | [Data model](architecture/data-model.md) |
| 06-loading-exporting | [Client internals](architecture/clients.md#export-and-import) |
| 07-websockets | [Communication](architecture/communication.md) (WebSocket) |
