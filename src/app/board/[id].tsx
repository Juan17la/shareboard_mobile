/**
 * The board screen.
 *
 * It owns three things the design keeps deliberately flat: the connection
 * phase (identity -> PIN -> live), which sheet is open, and which confirm
 * dialog is open. Everything else is a child — the canvas, the floating header,
 * the tool rail, the bottom controls — and every sheet is a component rendered
 * right here rather than a route, so the board stays visible underneath.
 *
 * `pickName` is a one-shot route param: set when a board was just created or
 * imported, it forces the identity step even for someone whose nickname is
 * already remembered. Creating a board is the moment to choose how you appear
 * on it.
 */
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardFontsProvider } from '@/components/board/BoardFonts';
import { BottomControls } from '@/components/board/BottomControls';
import { ToolRail } from '@/components/board/ToolRail';
import { BoardHeader, HeaderScrim } from '@/components/header/BoardHeader';
import { NicknameScreen } from '@/components/screens/NicknameScreen';
import { PinScreen } from '@/components/screens/PinScreen';
import { ExportSheet } from '@/components/sheets/ExportSheet';
import { ImportSheet } from '@/components/sheets/ImportSheet';
import { MenuSheet } from '@/components/sheets/MenuSheet';
import { PeopleSheet } from '@/components/sheets/PeopleSheet';
import { PrivacySheet } from '@/components/sheets/PrivacySheet';
import { SettingsSheet } from '@/components/sheets/SettingsSheet';
import { ShareSheet } from '@/components/sheets/ShareSheet';
import { Backdrop } from '@/components/ui/Backdrop';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Txt } from '@/components/ui/Text';
import { ToastHost, toast } from '@/components/ui/Toast';
import { API_BASE_URL } from '@/constants/config';
import { fill, type Strings } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import type { BoardSnapshot } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { useBoardSync } from '@/hooks/use-board-sync';
import { deleteBoard, importSnapshot } from '@/services/api/boards';
import { boardShareLink } from '@/utils/deep-link';
import { notify, thud } from '@/utils/haptics';

// The web app is served from the API host unless they are split; override with
// `expo.extra` if they diverge.
const WEB_BASE_URL = API_BASE_URL;

type SheetName = 'share' | 'people' | 'privacy' | 'export' | 'import' | 'menu' | 'settings';
type ConfirmName = 'clear' | 'delete';

export default function BoardScreen() {
  const { id, pickName } = useLocalSearchParams<{ id: string; pickName?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const t = useT();
  const nickname = useSessionStore((s) => s.nickname);
  const forgetBoard = useSessionStore((s) => s.forgetBoard);
  const userId = useSessionStore((s) => s.userId);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const meta = useBoardStore((s) => s.meta);
  const boardToken = useBoardStore((s) => s.boardToken);
  const clearBoard = useBoardStore((s) => s.clearBoard);

  // Satisfied once the identity step has been passed for this board, either by
  // confirming a name or because there was never a reason to ask.
  const [identityDone, setIdentityDone] = useState(pickName !== '1');
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [confirm, setConfirm] = useState<ConfirmName | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useBoardSync(id, { paused: !identityDone });

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
      router.replace({ pathname: '/board/[id]', params: { id: created.id, pickName: '1' } });
    },
    [t, userId],
  );

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
    setConfirmBusy(true);
    try {
      await deleteBoard(meta.id, { userId, token: boardToken ?? '' });
      notify(haptics, true);
      toast(t.toastDeleted);
    } catch (error) {
      // The endpoint is still a placeholder server-side (see `DELETE_BOARD` in
      // services/api/endpoints.ts). Until it lands, deleting is honoured
      // locally — the board leaves the recent list and this device leaves the
      // session — rather than dead-ending on an error the user cannot act on.
      console.warn('[shareboard] deleteBoard failed, removing locally only:', error);
      toast(t.toastDeleted);
    } finally {
      setConfirmBusy(false);
      forgetBoard(meta.id);
      setConfirm(null);
      setSheet(null);
      router.replace('/');
    }
  }

  // --- gates -------------------------------------------------------------

  if (sync.phase === 'need-nickname') {
    return (
      <NicknameScreen
        landscape={landscape}
        onContinue={(name) => {
          sync.submitNickname(name);
          setIdentityDone(true);
        }}
      />
    );
  }

  if (sync.phase === 'need-pin') {
    return <PinScreen landscape={landscape} error={sync.error} onSubmit={sync.submitPin} />;
  }

  if (sync.phase === 'error') {
    return <BoardError t={t} message={sync.error} />;
  }

  if (sync.phase === 'loading' || !nickname) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator color="#6D3FB5" />
      </View>
    );
  }

  // --- the board ----------------------------------------------------------

  const link = meta ? boardShareLink(WEB_BASE_URL, meta.shortCode) : '';
  const headerHeight = insets.top + (landscape ? 84 : 112);

  return (
    <BoardFontsProvider>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <BoardCanvas onCursorMove={sync.sendCursor} />

        <HeaderScrim height={headerHeight} />
        <BoardHeader
          landscape={landscape}
          codeCopied={codeCopied}
          onCopyCode={copyCode}
          onOpenPeople={() => setSheet('people')}
          onOpenMenu={() => setSheet('menu')}
          onOpenPrivacy={() => setSheet('privacy')}
          onOpenShare={() => setSheet('share')}
        />

        <ToolRail landscape={landscape} />
        <BottomControls landscape={landscape} />

        <ToastHost
          bottom={Math.max(insets.bottom, 16) + 96}
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
          onOpenExport={() => setSheet('export')}
          onOpenImport={() => setSheet('import')}
          onOpenPrivacy={() => setSheet('privacy')}
          onOpenPeople={() => setSheet('people')}
          onOpenSettings={() => setSheet('settings')}
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
          busy={confirmBusy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      </View>
    </BoardFontsProvider>
  );
}

function BoardError({ t, message }: { t: Strings; message: string | null }) {
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
        <Button label={t.back} icon="back" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}
