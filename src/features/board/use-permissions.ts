/**
 * Saving access changes from the sheets.
 *
 * The design's access panel has no Save button: every switch takes effect as
 * you touch it. That means the round trip has to be invisible, so each change
 * is applied to the local `meta` first and rolled back if the server refuses —
 * and because the server broadcasts a `permissions` frame to everyone on the
 * board, the authoritative version overwrites the optimistic one a moment later
 * anyway.
 *
 * The PIN is the one piece that cannot round-trip: `BoardMeta` only carries
 * `hasPin`, never the value. Whatever this device sets is kept in the session
 * store so the creator can still read their own PIN back (see the note in
 * `features/session/store.ts`).
 */
import { useCallback, useState } from 'react';

import { currentStrings } from '@/features/i18n/store';
import { useSessionStore } from '@/features/session/store';
import { updatePermissions } from '@/services/api/boards';
import type { UpdatePermissionsRequest } from '@/services/api/types';
import { toast } from '@/components/ui/Toast';

import { useBoardStore } from './store';

export interface PermissionsController {
  /** True while a change is in flight. */
  busy: boolean;
  /** Only the creator may change any of this. */
  isCreator: boolean;
  /** The PIN this device set for the board, if it was this device. */
  knownPin: string | null;
  apply(patch: UpdatePermissionsRequest): Promise<boolean>;
}

/** Four digits, uniformly random — `Math.random()` is fine for a room code. */
export function generatePin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function useBoardPermissions(): PermissionsController {
  const meta = useBoardStore((s) => s.meta);
  const setMeta = useBoardStore((s) => s.setMeta);
  const boardToken = useBoardStore((s) => s.boardToken);
  const userId = useSessionStore((s) => s.userId);
  const pins = useSessionStore((s) => s.pins);
  const rememberPin = useSessionStore((s) => s.rememberPin);
  const [busy, setBusy] = useState(false);

  const isCreator = !!meta && meta.creatorId === userId;

  const apply = useCallback(
    async (patch: UpdatePermissionsRequest) => {
      if (!meta || !isCreator) return false;
      const previous = meta;
      const t = currentStrings();

      setMeta({
        ...meta,
        access: patch.access ?? meta.access,
        editPolicy: patch.editPolicy ?? meta.editPolicy,
        editors: patch.editors ?? meta.editors,
        hasPin: patch.pin === null ? false : patch.pin ? true : meta.hasPin,
        updatedAt: Date.now(),
      });
      setBusy(true);

      try {
        const next = await updatePermissions(meta.id, patch, { userId, token: boardToken ?? '' });
        setMeta(next);
        if (patch.pin !== undefined) rememberPin(meta.id, patch.pin);
        toast(t.toastPermissions);
        return true;
      } catch (error) {
        setMeta(previous);
        toast(error instanceof Error ? error.message : t.errPermissions);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [meta, isCreator, setMeta, userId, boardToken, rememberPin],
  );

  return {
    busy,
    isCreator,
    knownPin: meta ? (pins[meta.id] ?? null) : null,
    apply,
  };
}
