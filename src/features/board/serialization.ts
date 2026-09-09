/**
 * Board <-> snapshot-file conversion + validation.
 * The file format is defined in model.ts (`BoardSnapshot`) and documented with a
 * JSON Schema in docs/05-model-date.
 */
import {
  LIMITS,
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  type BoardElement,
  type BoardSnapshot,
} from './model';
import { visibleSorted, type ElementMap } from './ops';

export function toSnapshot(name: string, elements: ElementMap): BoardSnapshot {
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    meta: { name },
    elements: visibleSorted(elements),
    exportedAt: Date.now(),
  };
}

export class SnapshotParseError extends Error {}

const isColor = (v: unknown) => typeof v === 'string' && LIMITS.colorPattern.test(v);
const isPoint = (v: unknown): v is { x: number; y: number } =>
  !!v && typeof (v as any).x === 'number' && typeof (v as any).y === 'number';

function validateElement(raw: unknown): BoardElement {
  if (!raw || typeof raw !== 'object') throw new SnapshotParseError('Element is not an object');
  const el = raw as Record<string, unknown>;
  if (typeof el.id !== 'string') throw new SnapshotParseError('Element missing id');

  switch (el.kind) {
    case 'stroke':
      if (!Array.isArray(el.points) || el.points.length < 2) {
        throw new SnapshotParseError('Stroke missing points');
      }
      if (!isColor(el.color)) throw new SnapshotParseError('Stroke has invalid color');
      break;
    case 'shape':
      if (!isPoint(el.from) || !isPoint(el.to)) throw new SnapshotParseError('Shape missing from/to');
      if (!isColor(el.stroke)) throw new SnapshotParseError('Shape has invalid stroke color');
      break;
    case 'text':
      if (typeof el.text !== 'string' || el.text.length > LIMITS.maxTextLength) {
        throw new SnapshotParseError('Text element invalid');
      }
      if (!isPoint(el.at)) throw new SnapshotParseError('Text missing position');
      break;
    case 'image':
      if (typeof el.uri !== 'string' || !isPoint(el.at)) {
        throw new SnapshotParseError('Image element invalid');
      }
      break;
    default:
      throw new SnapshotParseError(`Unknown element kind "${String(el.kind)}"`);
  }
  return raw as BoardElement;
}

/** Parse + validate a snapshot file. Throws `SnapshotParseError` on bad input. */
export function parseSnapshot(text: string): BoardSnapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SnapshotParseError('File is not valid JSON');
  }
  if (!json || typeof json !== 'object') throw new SnapshotParseError('Empty file');
  const obj = json as Record<string, unknown>;

  if (obj.format !== SNAPSHOT_FORMAT) {
    throw new SnapshotParseError('Not a Live Whiteboard file');
  }
  if (obj.version !== SNAPSHOT_VERSION) {
    throw new SnapshotParseError(
      `Unsupported file version ${String(obj.version)} (this app reads v${SNAPSHOT_VERSION})`,
    );
  }
  if (!Array.isArray(obj.elements)) throw new SnapshotParseError('File has no elements array');
  if (obj.elements.length > LIMITS.maxElements) {
    throw new SnapshotParseError('File exceeds the element limit');
  }

  const elements = obj.elements.map(validateElement);
  const name =
    obj.meta && typeof (obj.meta as any).name === 'string' ? (obj.meta as any).name : 'Imported board';

  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    meta: { name },
    elements,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
  };
}

/** Re-key elements so an imported snapshot never collides with a live board. */
export function rekeyElements(elements: BoardElement[], newId: () => string): BoardElement[] {
  return elements.map((el, i) => ({ ...el, id: newId(), z: i + 1 }));
}
