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
 * menu is where a new one, an old one, a code or a file is reached from.
 * Nothing comes before the first stroke: the identity step appears the first
 * time a live board opens (shared or joined), then only when a name clashes
 * with someone's on the board.
 *
 * A live board is a shared one, so making one (new, imported, or the offline
 * board shared) needs an account: a guest is shown the account sheet instead,
 * and brought back to where they were once signed in.
 */
import { useCanvasRef } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardCanvas } from '@/components/board/BoardCanvas';
import { ConnectionBanner } from '@/components/board/ConnectionBanner';
import { useBoardMirror } from '@/components/board/BoardMirror';
import { BottomControls } from '@/components/board/BottomControls';
import { ReactionStream, TimerPill } from '@/components/board/ClassControls';
import { PERF_HUD, PerfHud } from '@/components/board/PerfHud';
import { Toolbar } from '@/components/board/Toolbar';
import { Tutorial } from '@/components/board/Tutorial';
import { BoardHeader } from '@/components/header/BoardHeader';
import { NicknameScreen } from '@/components/screens/NicknameScreen';
import { PinScreen } from '@/components/screens/PinScreen';
import { AccountSheet } from '@/components/sheets/AccountSheet';
import { SheetBack } from '@/components/ui/sheet-back';
import { AiSheet } from '@/components/sheets/AiSheet';
import { BoardsSheet } from '@/components/sheets/BoardsSheet';
import { ExportSheet } from '@/components/sheets/ExportSheet';
import { ImportSheet } from '@/components/sheets/ImportSheet';
import { JoinSheet } from '@/components/sheets/JoinSheet';
import { MenuSheet } from '@/components/sheets/MenuSheet';
import { TemplatesSheet } from '@/components/sheets/TemplatesSheet';
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
import { isLocalId } from '@/features/board/local';
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
  | 'templates'
  | 'join'
  | 'boards'
  | 'account';
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
  const hydrated = useSessionStore((s) => s.hydrated);
  const onboarded = useSessionStore((s) => s.onboarded);
  const signedIn = useSessionStore((s) => s.account !== null);

  const meta = useBoardStore((s) => s.meta);
  const clearBoard = useBoardStore((s) => s.clearBoard);

  // Sheets opened from another sheet stack up, so each can go back to the one
  // that opened it; `setSheet` starts over, `pushSheet` goes one deeper.
  const [stack, setStack] = useState<SheetName[]>([]);
  const sheet = stack.at(-1) ?? null;
  const setSheet = useCallback((next: SheetName | null) => setStack(next ? [next] : []), []);
  const pushSheet = useCallback((next: SheetName) => setStack((s) => [...s, next]), []);
  const backSheet = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const [confirm, setConfirm] = useState<ConfirmName | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Where to go back to once signed in, and why the account sheet is asking.
  const [afterSignIn, setAfterSignIn] = useState<SheetName | null>(null);
  const askAccount = (from: SheetName | null) => {
    setAfterSignIn(from);
    pushSheet('account');
  };

  // A live board waits for a name, asked once; the offline board needs none.
  const sync = useBoardSync(id, { paused: hydrated && !onboarded && !isLocalId(id) });

  // What the glass panels blur: the canvas itself, via throttled snapshots.
  const canvasRef = useCanvasRef();
  const mirror = useBoardMirror(canvasRef);

  const handleImportSnapshot = useCallback(
    async (snapshot: BoardSnapshot) => {
      if (!useSessionStore.getState().account) {
        setAfterSignIn('import');
        pushSheet('account');
        return;
      }
      // Always a new board, never a paste into this one — importing must not be
      // able to overwrite something other people are working on.
      const created = await importSnapshot(
        { ...snapshot, meta: { name: snapshot.meta.name || t.importedBoardName } },
        userId,
      );
      router.setParams({ id: created.id });
    },
    [t, userId, pushSheet],
  );

  const [creating, setCreating] = useState(false);
  /** A fresh, empty whiteboard — public, anyone with the code can draw; the access button changes that. */
  async function createNew(name = '') {
    if (!signedIn) {
      askAccount('join');
      return;
    }
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

  // An account is registered under the name, so one not chosen yet is asked first.
  if (sheet === 'account' && !onboarded) {
    return (
      <NicknameScreen
        landscape={landscape}
        blank
        onCancel={() => setSheet(null)}
        onContinue={(name) => {
          useSessionStore.getState().setNickname(name);
          useSessionStore.getState().setOnboarded();
        }}
      />
    );
  }

  if (sync.phase === 'need-nickname') {
    return (
      <NicknameScreen
        landscape={landscape}
        blank={!onboarded}
        onContinue={(name) => {
          sync.submitNickname(name);
          useSessionStore.getState().setOnboarded();
        }}
      />
    );
  }

  if (sync.phase === 'need-pin') {
    return <PinScreen landscape={landscape} error={sync.error} onSubmit={sync.submitPin} />;
  }

  if (sync.phase === 'error') {
    return (
      <BoardError
        t={t}
        message={sync.error}
        creating={creating}
        signedIn={signedIn}
        // A guest cannot make a live board; their own offline one is always there.
        onNew={() => (signedIn ? void createNew() : router.replace('/'))}
      />
    );
  }

  if (sync.phase === 'loading' || !nickname) {
    return <LoadingScreen />;
  }

  // --- the board ----------------------------------------------------------

  const link = meta ? boardShareLink(WEB_BASE_URL, meta.shortCode) : '';
  // One header row in either orientation: 4 + 48 (chip and buttons) + 4, plus the top inset.
  const headerHeight = insets.top + 56;

  return (
    <SheetBack.Provider value={stack.length > 1 ? backSheet : undefined}>
    <GlassScene render={mirror} style={{ backgroundColor: c.background }}>
      <BoardCanvas onCursorMove={sync.sendCursor} onPreview={sync.sendPreview} canvasRef={canvasRef} />

      <BoardHeader
        onOpenPeople={() => pushSheet('people')}
        onOpenMenu={() => setSheet('menu')}
        onOpenShare={() => setSheet('share')}
      />

      <Toolbar landscape={landscape} />
      <BottomControls top={headerHeight + 6} onReact={sync.sendReact} onTimer={sync.sendTimer} />
      <TimerPill top={headerHeight + 6} />
      <ReactionStream bottom={Math.max(insets.bottom, 16) + 140} />
      <ConnectionBanner top={headerHeight + 54} onRetry={sync.retry} />
      {PERF_HUD ? <PerfHud /> : null}
      <Tutorial offerTop={headerHeight + 54} />

      <ToastHost
        bottom={Math.max(insets.bottom, 16) + 128}
        enabled={sheet === null && confirm === null}
      />

      <ShareSheet
        open={sheet === 'share'}
        onClose={() => setSheet(null)}
        link={link}
        onOpenExport={() => pushSheet('export')}
        onOpenPrivacy={() => pushSheet('privacy')}
        onNeedAccount={() => askAccount('share')}
      />
      <PeopleSheet open={sheet === 'people'} onClose={() => setSheet(null)} />
      <AiSheet open={sheet === 'ai'} onClose={() => setSheet(null)} />
      <TemplatesSheet open={sheet === 'templates'} onClose={() => setSheet(null)} />
      <PrivacySheet
        open={sheet === 'privacy'}
        onClose={() => setSheet(null)}
        onOpenPeople={() => pushSheet('people')}
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
        onOpenBoards={() => pushSheet('boards')}
        onOpenNew={() => pushSheet('join')}
        onOpenSettings={() => pushSheet('settings')}
        onOpenImport={() => pushSheet('import')}
        onOpenExport={() => pushSheet('export')}
        onOpenPrivacy={() => pushSheet('privacy')}
        onOpenPeople={() => pushSheet('people')}
        onOpenAi={() => pushSheet('ai')}
        onOpenTemplates={() => pushSheet('templates')}
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
        onOpenAccount={() => askAccount(null)}
      />
      <AccountSheet
        open={sheet === 'account'}
        onClose={() => setSheet(null)}
        onSignedIn={() => setSheet(afterSignIn)}
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
    </SheetBack.Provider>
  );
}

function BoardError({
  t,
  message,
  creating,
  signedIn,
  onNew,
}: {
  t: Strings;
  message: string | null;
  creating: boolean;
  signedIn: boolean;
  onNew: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
        <Txt weight="extrabold" size={20} leading={1.2} tracking={-0.4} style={{ textAlign: 'center' }}>
          {t.errOpen}
        </Txt>
        {message ? (
          <Txt size={13} leading={1.45} tone="secondary" style={{ textAlign: 'center' }}>
            {message}
          </Txt>
        ) : null}
        <Button
          label={signedIn ? t.newWhiteboard : t.localBoardName}
          icon={signedIn ? 'plus' : 'pencil'}
          variant="secondary"
          loading={creating}
          onPress={onNew}
        />
      </View>
    </View>
  );
}
