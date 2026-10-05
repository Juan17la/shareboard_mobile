/**
 * "Export": the board as a picture.
 *
 * The preview is a second, offscreen Skia canvas rendering the same elements
 * cropped to their bounding box — which is also the canvas the export is
 * *taken* from, via `makeImageSnapshot()`. Exporting an infinite board means
 * choosing a frame, and the tightest frame around what was actually drawn is
 * the one nobody has to think about.
 *
 * The saved file carries the board's snapshot inside it (`features/board/embed.ts`),
 * so the picture can be imported back with every stroke still editable.
 */
import { Canvas, Group, ImageFormat, Rect, useCanvasRef } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useT, useTf } from '@/features/i18n/store';
import { contentBounds } from '@/features/board/geometry';
import {
  saveImageToPhotos,
  shareImage,
  shareSnapshot,
  shareSvg,
  type ImageFormat as Ext,
} from '@/features/board/export';
import { visibleSorted } from '@/features/board/ops';
import { toSnapshot } from '@/features/board/serialization';
import { toSvg } from '@/features/board/svg';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { notify } from '@/utils/haptics';

import { ElementRenderer } from '../board/ElementRenderer';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Sheet, SheetRow } from '../ui/Sheet';
import { Toggle } from '../ui/Toggle';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

const PADDING = 24;
const PREVIEW_MAX = 220;

/**
 * The shell is always mounted so the sheet can animate in; the body is not.
 * Measuring the board's bounding box is O(points) and the element map changes
 * on every stroke, so leaving the body mounted would re-measure the whole board
 * continuously while someone is drawing — for a panel nobody is looking at.
 */
export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} title={t.sheetExport} onClose={onClose} closeLabel={t.close}>
      {open ? <ExportSheetBody onClose={onClose} /> : null}
    </Sheet>
  );
}

function ExportSheetBody({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const tf = useTf();
  const elements = useBoardStore((s) => s.elements);
  const meta = useBoardStore((s) => s.meta);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const smooth = useSessionStore((s) => s.settings.smooth);
  const haptics = useSessionStore((s) => s.settings.haptics);
  const canvasRef = useCanvasRef();

  const [format, setFormat] = useState<Ext | 'svg'>('png');
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  // With something selected (the cursor's pick, groups included), that is
  // what is exported unless the whole board is asked for.
  const [scope, setScope] = useState<'all' | 'selection'>(selectedIds.length ? 'selection' : 'all');

  const list = useMemo(() => {
    const all = visibleSorted(elements);
    if (scope === 'all') return all;
    const ids = new Set(selectedIds);
    return all.filter((el) => ids.has(el.id));
  }, [elements, scope, selectedIds]);
  const bounds = useMemo(() => contentBounds(list), [list]);

  const width = Math.max(1, Math.ceil((bounds?.width ?? 0) + PADDING * 2));
  const height = Math.max(1, Math.ceil((bounds?.height ?? 0) + PADDING * 2));
  const previewScale = Math.min(1, PREVIEW_MAX / Math.max(width, height));

  // A JPEG has no alpha channel, so it is not offered while "transparent" is on.
  const paintBackground = !transparent;

  async function run(action: 'save' | 'share' | 'json') {
    if (!meta) return;
    setBusy(true);
    try {
      // What is exported is what the file carries back: only the selection's
      // elements when only the selection is exported.
      const snapshot = toSnapshot(meta.name, Object.fromEntries(list.map((el) => [el.id, el])));
      if (action === 'json') {
        await shareSnapshot(snapshot);
        onClose();
        return;
      }
      if (format === 'svg') {
        const svg = toSvg(list, { background: paintBackground ? '#FFFFFF' : null });
        if (!svg) throw new Error(t.previewEmpty);
        await shareSvg(meta.name, svg);
        notify(haptics, true);
        toast(t.toastShared);
        onClose();
        return;
      }
      const image = canvasRef.current?.makeImageSnapshot();
      if (!image) throw new Error(t.previewEmpty);
      const base64 = image.encodeToBase64(
        format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG,
        format === 'png' ? 100 : 92,
      );
      const input = { boardName: meta.name, format, base64, snapshot };
      if (action === 'save') await saveImageToPhotos(input);
      else await shareImage(input);
      notify(haptics, true);
      toast(action === 'save' ? t.toastExport : t.toastShared);
      onClose();
    } catch (error) {
      notify(haptics, false);
      toast(error instanceof Error ? error.message : t.errExport);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 13 }}>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 130,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          // The export is painted as on the light board, so a transparent one
          // is previewed on a light well — dark ink on c.surface would vanish.
          backgroundColor: paintBackground ? c.surface : '#F2F2F7',
          overflow: 'hidden',
        }}
      >
        {bounds ? (
          <View style={{ width: width * previewScale, height: height * previewScale }}>
            {/* The canvas renders at full export size and is scaled down for
                  display, so `makeImageSnapshot` captures real pixels rather
                  than the thumbnail. */}
            <Canvas
              ref={canvasRef}
              style={{
                width,
                height,
                transform: [{ scale: previewScale }],
                transformOrigin: 'top left',
              }}
            >
              {paintBackground ? (
                <Rect x={0} y={0} width={width} height={height} color="#FFFFFF" />
              ) : null}
              <Group
                transform={[
                  { translateX: PADDING - bounds.x },
                  { translateY: PADDING - bounds.y },
                ]}
              >
                {list.map((el) => (
                  <ElementRenderer key={el.id} el={el} smooth={smooth} />
                ))}
              </Group>
            </Canvas>
          </View>
        ) : (
          <Txt size={11.5} mono tone="tertiary">
            {t.previewEmpty}
          </Txt>
        )}
      </View>

      {bounds ? (
        <Txt size={11} mono tone="secondary" style={{ textAlign: 'center' }}>
          {tf('exportSize', { W: width, H: height, N: list.length })}
        </Txt>
      ) : null}

      {selectedIds.length ? (
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: t.exportAll },
            { value: 'selection', label: t.exportSelection },
          ]}
        />
      ) : null}

      <Segmented
        value={format}
        onChange={setFormat}
        options={[
          { value: 'png', label: 'PNG' },
          ...(transparent ? [] : [{ value: 'jpg' as const, label: 'JPG' }]),
          { value: 'svg', label: 'SVG' },
        ]}
      />

      <SheetRow
        title={t.transparentBg}
        right={
          <Toggle
            value={transparent}
            onChange={(on) => {
              setTransparent(on);
              if (on && format === 'jpg') setFormat('png');
            }}
            label={t.transparentBg}
          />
        }
      />

      <Button
        label={t.download}
        onPress={() => run('save')}
        loading={busy}
        // A photo library takes pictures, not SVG documents: those go through Share.
        disabled={!bounds || format === 'svg'}
        fullWidth
      />
      <Button
        label={t.shareImage}
        variant="secondary"
        onPress={() => run('share')}
        disabled={busy || !bounds}
        fullWidth
      />
      <Button
        label={t.exportFile}
        variant="ghost"
        onPress={() => run('json')}
        disabled={busy}
        fullWidth
      />
    </View>
  );
}
