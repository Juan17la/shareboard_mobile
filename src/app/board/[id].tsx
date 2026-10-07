/**
 * The board screen.
 *
 * It owns three things the design keeps deliberately flat: the connection
 * phase (identity -> PIN -> live), which sheet is open, and which confirm
 * dialog is open. Everything else is a child — the canvas, the floating header,
 * the tool rail, the bottom controls — and every sheet is a component rendered
 * right here rather than a route, so the board stays visible underneath.
 *
 * There is no screen behind it: the app opens on the last whiteboard, and the
 * menu is where a new one, an old one, a code or a file is reached from. The
 * identity step only appears when a name clashes with someone's on the board
 * (everyone starts with a guest name, changed in the settings).
 */
import { useCanvasRef } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardCanvas } from '@/components/board/BoardCanvas';
import { ConnectionBanner } from '@/components/board/ConnectionBanner';
import { useBoardMirror } from '@/components/board/BoardMirror';
import { BottomControls } from '@/components/board/BottomControls';
import { PERF_HUD, PerfHud } from '@/components/board/PerfHud';
import { Toolbar } from '@/components/board/Toolbar';
import { Tutorial } from '@/components/board/Tutorial';
import { BoardHeader } from '@/components/header/BoardHeader';
import { NicknameScreen } from '@/components/screens/NicknameScreen';
import { PinScreen } from '@/components/screens/PinScreen';
import { AiSheet } from '@/components/sheets/AiSheet';
import { BoardsSheet } from '@/components/sheets/BoardsSheet';
import { ExportSheet } from '@/components/sheets/ExportSheet';
import { ImportSheet } from '@/components/sheets/ImportSheet';
import { JoinSheet } from '@/components/sheets/JoinSheet';
import { MenuSheet } from '@/components/sheets/MenuSheet';
import { PeopleSheet } from '@/components/sheets/PeopleSheet';
import { PrivacySheet } from '@/components/sheets/PrivacySheet';
import { SettingsSheet } from '@/components/sheets/SettingsSheet';
import { ShareSheet } from '@/components/sheets/ShareSheet';
import { Backdrop } from '@/components/ui/Backdrop';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlassScene } from '@/components/ui/Glass';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Txt } from '@/components/ui/Text';
import { ToastHost, toast } from '@/components/ui/Toast';
import { WEB_BASE_URL } from '@/constants/config';
import { fill, type Strings } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import type { BoardSnapshot } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { useBoardSync } from '@/hooks/use-board-sync';
import { createBoard, deleteBoard, importSnapshot } from '@/services/api/boards';
import { boardShareLink } from '@/utils/deep-link';
import { notify, thud } from '@/utils/haptics';

type SheetName =
  | 'share'
  | 'people'
  | 'privacy'
  | 'export'
  | 'import'
  | 'menu'
  | 'settings'
  | 'ai'
  | 'join'
  | 'boards';
type ConfirmName = 'clear' | 'delete';

/**
 * One screen for every board. Going to another board sets this route's `id`
 * (`router.setParams`) rather than navigating: a second board screen would
 * live beside this one until its transition ended, and this one's unmount
 * would then reset the store under the board just joined — a frozen board
 * until the app was restarted. The key remounts the board cleanly instead.
 */
export default function BoardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BoardScreen key={id} id={id} />;
}

function BoardScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const c = useColors();

  const t = useT();
  const nickname = useSessionStore((s) => s.nickname);
  const forgetBoard = useSessionStore((s) => s.forgetBoard);
  const userId = useSessionStore((s) => s.userId);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const meta = useBoardStore((s) => s.meta);
  const clearBoard = useBoardStore((s) => s.clearBoard);

  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [confirm, setConfirm] = useState<ConfirmName | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useBoardSync(id);

  // What the glass panels blur: the canvas itself, via throttled snapshots.
  const canvasRef = useCanvasRef();
  const mirror = useBoardMirror(canvasRef);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copyCode = useCallback(async () => {
    if (!meta) return;
    await Clipboard.setStringAsync(meta.shortCode);
    setCodeCopied(true);
    toast(t.toastCopied);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCodeCopied(false), 1500);
  }, [meta, t]);

  const handleImportSnapshot = useCallback(
    async (snapshot: BoardSnapshot) => {
      // Always a new board, never a paste into this one — importing must not be
      // able to overwrite something other people are working on.
      const created = await importSnapshot(
        { ...snapshot, meta: { name: snapshot.meta.name || t.importedBoardName } },
        userId,
      );
      router.setParams({ id: created.id });
    },
    [t, userId],
  );

  const [creating, setCreating] = useState(false);
  /** A fresh, empty whiteboard — public, anyone with the code can draw; the access button changes that. */
  async function createNew(name = '') {
    setCreating(true);
    const request = {
      name: name || t.newBoardName,
      access: 'public',
      editPolicy: 'everyone',
      creatorId: userId,
    } as const;
    try {
      const created = await createBoard(request);
      thud(haptics);
      setSheet(null);
      router.setParams({ id: created.id });
    } catch (error) {
      toast(error instanceof Error ? error.message : t.errCreate);
    }
    setCreating(false);
  }

  // A board that is gone (deleted, or its server forgot it) is let go of; the
  // root then opens the next one, or a new one.
  useEffect(() => {
    if (!sync.notFound) return;
    forgetBoard(id);
    router.replace('/');
  }, [sync.notFound, id, forgetBoard]);

  async function runConfirm() {
    if (confirm === 'clear') {
      clearBoard();
      thud(haptics);
      setConfirm(null);
      setSheet(null);
      toast(t.toastCleared);
      return;
    }

    if (confirm !== 'delete' || !meta) return;
    // The server drops the board and disconnects everyone else on it; only then
    // does this device forget it and leave.
    setDeleting(true);
    // Read before the `try`: the React Compiler cannot compile a component
    // with a `??` inside one, and this screen re-renders on every snapshot the
    // glass takes of the board (Android) — compiled, its children are reused.
    const token = useBoardStore.getState().boardToken ?? '';
    try {
      await deleteBoard(meta.id, { userId, token });
    } catch (error) {
      toast(error instanceof Error ? error.message : t.errDelete);
      setDeleting(false);
      return;
    }
    notify(haptics, true);
    forgetBoard(meta.id);
    setConfirm(null);
    setSheet(null);
    toast(t.toastDeleted);
    router.replace('/');
  }

  // --- gates -------------------------------------------------------------

  if (sync.phase === 'need-nickname') {
    return (
      <NicknameScreen
        landscape={landscape}
        onContinue={(name) => sync.submitNickname(name)}
      />
    );
  }

  if (sync.phase === 'need-pin') {
    return <PinScreen landscape={landscape} error={sync.error} onSubmit={sync.submitPin} />;
  }

  if (sync.phase === 'error') {
    return <BoardError t={t} message={sync.error} creating={creating} onNew={() => void createNew()} />;
  }

  if (sync.phase === 'loading' || !nickname) {
    return <LoadingScreen />;
  }

  // --- the board ----------------------------------------------------------

  const link = meta ? boardShareLink(WEB_BASE_URL, meta.shortCode) : '';
  // Portrait: 6 + 34 (title row) + 6 + 30 (action strip) + 6; landscape is the
  // one row: 6 + 34 + 4. Plus a little run-out for the scrim's fade so the
  // header never sits on its edge.
  const headerHeight = insets.top + (landscape ? 50 : 92);

  return (
    <GlassScene render={mirror} style={{ backgroundColor: c.background }}>
      <BoardCanvas onCursorMove={sync.sendCursor} canvasRef={canvasRef} />

      <BoardHeader
        landscape={landscape}
        codeCopied={codeCopied}
        onCopyCode={copyCode}
        onOpenPeople={() => setSheet('people')}
        onOpenMenu={() => setSheet('menu')}
        onOpenSettings={() => setSheet('settings')}
        onOpenNew={() => setSheet('join')}
        onOpenPrivacy={() => setSheet('privacy')}
        onOpenShare={() => setSheet('share')}
        onOpenExport={() => setSheet('export')}
      />

      <Toolbar landscape={landscape} />
      <BottomControls top={headerHeight + 6} onOpenAi={() => setSheet('ai')} />
      <ConnectionBanner top={headerHeight + 50} onRetry={sync.retry} />
      {PERF_HUD ? <PerfHud /> : null}
      <Tutorial />

      <ToastHost
        bottom={Math.max(insets.bottom, 16) + 128}
        enabled={sheet === null && confirm === null}
      />

      <ShareSheet
        open={sheet === 'share'}
        onClose={() => setSheet(null)}
        link={link}
        onOpenExport={() => setSheet('export')}
        onOpenPrivacy={() => setSheet('privacy')}
      />
      <PeopleSheet open={sheet === 'people'} onClose={() => setSheet(null)} />
      <AiSheet open={sheet === 'ai'} onClose={() => setSheet(null)} />
      <PrivacySheet
        open={sheet === 'privacy'}
        onClose={() => setSheet(null)}
        onOpenPeople={() => setSheet('people')}
      />
      <ExportSheet open={sheet === 'export'} onClose={() => setSheet(null)} />
      <ImportSheet
        open={sheet === 'import'}
        onClose={() => setSheet(null)}
        onImportSnapshot={handleImportSnapshot}
        allowImagePlacement
      />
      <MenuSheet
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        onOpenBoards={() => setSheet('boards')}
        onOpenSettings={() => setSheet('settings')}
        onOpenImport={() => setSheet('import')}
        onOpenPrivacy={() => setSheet('privacy')}
        onOpenPeople={() => setSheet('people')}
        onOpenAi={() => setSheet('ai')}
      />
      <BoardsSheet open={sheet === 'boards'} onClose={() => setSheet(null)} currentId={id} />
      <JoinSheet
        open={sheet === 'join'}
        onClose={() => setSheet(null)}
        onCreate={(name) => void createNew(name)}
        creating={creating}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        onAskClear={() => setConfirm('clear')}
        onAskDelete={() => setConfirm('delete')}
      />

      <ConfirmDialog
        open={confirm !== null}
        tone={confirm === 'delete' ? 'danger' : 'warn'}
        title={confirm === 'delete' ? t.deleteTitle : t.clearTitle}
        body={
          confirm === 'delete'
            ? fill(t.deleteBody, { CODE: meta?.shortCode ?? '' })
            : t.clearBody
        }
        confirmLabel={confirm === 'delete' ? t.deleteCta : t.clearCta}
        cancelLabel={t.cancel}
        busy={deleting}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </GlassScene>
  );
}

function BoardError({
  t,
  message,
  creating,
  onNew,
}: {
  t: Strings;
  message: string | null;
  creating: boolean;
  onNew: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="home" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
        <Txt weight="extrabold" size={20} leading={1.2} tracking={-0.4} style={{ textAlign: 'center' }}>
          {t.errOpen}
        </Txt>
        {message ? (
          <Txt size={13} leading={1.45} tone="secondary" style={{ textAlign: 'center' }}>
            {message}
          </Txt>
        ) : null}
        <Button label={t.newWhiteboard} icon="plus" variant="secondary" loading={creating} onPress={onNew} />
      </View>
    </View>
  );
}
