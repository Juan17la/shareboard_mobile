/**
 * "Import": open a file back into a board.
 *
 * One button, one switch, three outcomes — see `features/board/import.ts` for
 * how the file's actual bytes decide which. A restored board is always a *new*
 * board rather than a paste into this one, so importing can never overwrite
 * something other people are working on; a plain picture is placed on the
 * current board as a single element.
 *
 * The sheet is used from the home screen too, where there is no board to place
 * a picture on — `allowImagePlacement` is what tells the two apart.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/features/i18n/store';
import { pickBoardFile, pickImageFile } from '@/features/board/import';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import type { BoardSnapshot } from '@/features/board/model';
import { notify } from '@/utils/haptics';

import { Button } from '../ui/Button';
import { Sheet, SheetRow } from '../ui/Sheet';
import { Toggle } from '../ui/Toggle';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function ImportSheet({
  open,
  onClose,
  onImportSnapshot,
  allowImagePlacement,
}: {
  open: boolean;
  onClose: () => void;
  /** Given a parsed snapshot, create the board and navigate to it. */
  onImportSnapshot: (snapshot: BoardSnapshot) => Promise<void>;
  allowImagePlacement: boolean;
}) {
  const t = useT();
  const addImage = useBoardStore((s) => s.addImage);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [editable, setEditable] = useState(true);
  const [busy, setBusy] = useState(false);

  const placeImage = (uri: string, width: number, height: number) => {
    // Scale a large picture down to something that fits on screen at 100%
    // zoom; the element keeps its aspect ratio and can be re-cropped later.
    const scale = Math.min(1, 600 / Math.max(width, height));
    addImage({ x: 40, y: 40 }, width * scale, height * scale, uri);
  };

  async function choose() {
    setBusy(true);
    try {
      const result = await pickBoardFile(editable);
      if (result.kind === 'canceled') return;

      if (result.kind === 'snapshot') {
        await onImportSnapshot(result.snapshot);
        notify(haptics, true);
        toast(t.toastImport);
        onClose();
        return;
      }

      if (!allowImagePlacement || !canEdit) {
        toast(t.toastNoEdit);
        return;
      }
      placeImage(result.uri, result.width, result.height);
      notify(haptics, true);
      toast(t.toastImportImage);
      onClose();
    } catch (error) {
      notify(haptics, false);
      toast(error instanceof Error ? error.message : t.errImport);
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto() {
    setBusy(true);
    try {
      const result = await pickImageFile();
      if (result.kind !== 'image') return;
      placeImage(result.uri, result.width, result.height);
      toast(t.toastImportImage);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : t.errImport);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} title={t.sheetImport} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 13 }}>
        <Button
          label={t.pickFile}
          icon="download"
          variant="dashed"
          onPress={choose}
          loading={busy}
          fullWidth
          style={{ paddingVertical: 26, flexDirection: 'column' }}
        />
        <Txt size={11.5} leading={1.35} tone="secondary" style={{ textAlign: 'center' }}>
          {t.importHint}
        </Txt>

        <SheetRow
          title={t.importEditable}
          description={t.importEditableHint}
          right={<Toggle value={editable} onChange={setEditable} label={t.importEditable} />}
        />

        {allowImagePlacement ? (
          <Button
            label={t.addImage}
            icon="image"
            variant="secondary"
            onPress={addPhoto}
            disabled={busy || !canEdit}
            fullWidth
          />
        ) : null}
      </View>
    </Sheet>
  );
}
