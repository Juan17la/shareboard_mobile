# Data model

What a board is made of, as it travels between the apps and the server and as
it is stored. The authoritative definition is `server/src/model/types.ts`. The
clients mirror it in `web/src/lib/contract.ts` and
`mobile/src/features/board/model.ts`.

## Board

A board has **metadata** and a set of **elements**.

```ts
interface BoardMeta {
  id: string;            // "brd_" + 12 hex characters
  shortCode: string;     // 6 characters, e.g. "K7MQ2R"
  name: string;          // up to 80 characters
  access: 'public' | 'private';
  editPolicy: 'everyone' | 'selected' | 'creator-only';
  editors: UserId[];     // who may edit when editPolicy is 'selected'
  creatorId: UserId;
  hasPin: boolean;       // the PIN itself never leaves the server
  createdAt: number;     // epoch milliseconds
  updatedAt: number;
}
```

### Short codes

Six characters from `23456789ABCDEFGHJKMNPQRSTVWXYZ`: Crockford-style base 32
without the look-alikes `0 O 1 I L U`. That gives about 729 million codes. The
apps display them as `K7M·Q2R`; input is upper-cased and stripped of spaces,
dashes and dots before it is checked. Codes are unique (a unique index in
MongoDB backs this up).

### Roles

A person's role on a board is computed, never stored:

```
creator  if userId == creatorId
editor   if editPolicy == 'everyone'
editor   if editPolicy == 'selected' and userId in editors
viewer   otherwise
```

Creators and editors can change the board. Viewers can only watch. Only the
creator can rename, change permissions, or delete the board.

## Elements

Every element shares these fields:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | 12 random characters, made by the client that creates it |
| `createdBy` | UserId | Who drew it |
| `createdAt`, `updatedAt` | number | Epoch ms |
| `z` | number | Paint order, higher on top. **Assigned by the server** |
| `deleted` | boolean? | Soft delete marker |
| `group` | string \| null? | Elements with the same group id select and move as one |
| `rotation` | number? | Radians, clockwise, around the box centre (figures, text, images) |
| `opacity` | number? | 0.1–1; absent means opaque |

There are four kinds.

### `stroke`: a freehand line

```ts
{ kind: 'stroke', points: number[] /* x0,y0,x1,y1,… */, color: '#RRGGBB', width: number }
```

Points are a flat array to keep the JSON small. The client drops redundant
points before sending (at most 2,000 points per stroke) and draws a smooth
Catmull-Rom curve through what remains.

### `shape`: figures, lines and arrows

```ts
{
  kind: 'shape',
  shape: 'rectangle' | 'ellipse' | 'triangle' | 'polygon' | 'line' | 'arrow',
  from: Point, to: Point,          // the box corners, or a line's two ends
  stroke: string, strokeWidth: number, fill?: string | null,
  dash?: 'solid' | 'dashed' | 'dotted',
  rounded?: boolean,               // rounded corners (not ellipses)
  // label
  text?: string, fontSize?: number, font?: 'sans' | 'serif' | 'mono' | 'hand',
  align?: 'left' | 'center' | 'right', valign?: 'top' | 'middle' | 'bottom',
  labelAt?: number,                // a line's label position along it, 0..1
  // polygons
  sides?: number,                  // 4..12
  vertices?: Point[],              // irregular polygon: corners as 0..1 fractions of the box
  // lines and arrows
  headStart?: Marker, headEnd?: Marker,
  route?: 'straight' | 'curved' | 'elbow',
  bend?: number,                   // how far a curve or elbow is folded
  startAxis?: 'h' | 'v', endAxis?: 'h' | 'v',   // elbow directions
  curveFrom?: Point, curveTo?: Point,           // curve handles
  fromLink?: Link | null, toLink?: Link | null, // ends attached to elements
}
```

A **Link** attaches a line end to an element: `{ id, u, v }`, where `(u, v)` is
a point of that element's box as fractions from 0 to 1. When the element
moves, resizes or rotates, every client recomputes the line end from the link,
so attached arrows follow without extra network traffic.

**Markers** (line ends): `none`, `arrow`, `triangle`, `triangle-outline`,
`circle`, `circle-outline`, `circle-half`, `diamond`, `diamond-outline`, `bar`,
and the crow's-foot set `one`, `many`, `zero-one`, `zero-many`, `one-many`.

### `text`

```ts
{ kind: 'text', at: Point, text: string, color: string, fontSize: number,
  bold?, italic?, underline?, font?, width?: number /* wrap width */, align? }
```

### `image`

```ts
{ kind: 'image', at: Point, width: number, height: number, uri: string }
```

The `uri` is usually a `data:` URI. The image's bytes travel inside the element,
which is why clients shrink pictures to fit the 256 KB WebSocket frame limit.

### Optional fields and compatibility

Every field added after the first release is **optional**, and its absence
means the old behaviour. Older apps simply ignore fields they do not know, and
older boards keep their look. The server drops unknown fields instead of
storing them.

## Operations

All changes are expressed as ops:

```ts
type Op =
  | { t: 'add'; el: BoardElement }
  | { t: 'update'; id: string; patch: Partial<BoardElement>; updatedAt: number }
  | { t: 'delete'; id: string }
  | { t: 'clear' };
```

- `add` inserts or replaces an element. The server overwrites its `z` with the
  next number on the board.
- `update` merges `patch` into the element. A `null` value in the patch
  **removes** that field. Undo uses this to take back a field that did not
  exist before.
- `delete` marks the element `deleted: true`. Deleted elements are kept so the
  removal reaches everyone deterministically, and are filtered out of what
  clients and snapshots receive.
- `clear` empties the board.

Ops are **idempotent**: applying the same op twice gives the same board.

### Undo and redo

Undo is purely local. When a client commits ops, it computes their **inverse**
against the state just before (an `add` is undone by a `delete`, an `update` by
an `update` restoring the previous values, a `delete` by re-adding the
element). Undoing sends that inverse as ordinary ops. Each client keeps 100
steps and only ever undoes its own changes.

## Participants

```ts
interface Participant {
  userId: UserId;
  nickname: string;     // unique on the board, case-insensitive, ≤ 40 chars
  color: string;        // presence colour
  avatar?: string;      // an emoji
  role: 'creator' | 'editor' | 'viewer';
  cursor?: Point;       // board coordinates
  selection?: string[]; // element ids this person holds
  lastSeen: number;
}
```

Participants exist only in memory while someone is connected. They are never
stored.

The **presence colour** is the one the person picked, unless someone already on
the board has it; then the server assigns the next of six colours in join
order.

## Snapshot (export file)

The `.json` export, the server's `/snapshot`, the import endpoint and the data
hidden inside exported pictures all use this format:

```json
{
  "format": "live-whiteboard",
  "version": 1,
  "meta": { "name": "Sprint board" },
  "elements": [ … visible elements in paint order … ],
  "exportedAt": 1759852800000
}
```

## Limits

Enforced by the server and checked by the clients before sending.

| Limit | Value |
|-------|-------|
| Elements per board | 5,000 |
| Points per stroke | 2,000 |
| Text length | 2,000 |
| Stroke width | 1–64 |
| Font size | 10–400 |
| Polygon sides | 4–12 |
| Nickname | 40 characters |
| Board name | 80 characters |
| Colours | `#RRGGBB` or `#RRGGBBAA` |
| WebSocket message | 256 KB |
| Ops per second per user | 60 |

## How it is stored

One MongoDB document per board in the `boards` collection:

```ts
{ _id: 'brd_…', shortCode, name, access, editPolicy, editors, creatorId,
  createdAt, updatedAt, pinHash: 'salt:key' | null, elements: BoardElement[] }
```

Indexes: unique on `shortCode`, descending on `updatedAt`. The PIN is stored
only as a **scrypt** hash with a random salt.

On the devices:

| | Web | Android |
|---|---|---|
| Offline board | IndexedDB, database `shareboard`, store `local`, key `board` | JSON file in the app's documents folder |
| Session (user id, name, settings, recent boards, own PINs) | `localStorage` key `shareboard.session` | AsyncStorage |
