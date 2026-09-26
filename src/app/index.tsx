/**
 * Home: the whiteboard itself, with a glass card floating over it.
 *
 * There is no landing page to get past — a board is already there behind the
 * card: the real canvas, header and tool rail over a made-up board
 * (`features/board/demo.ts`) with collaborators drifting about, blurred just
 * enough to read as one step away. The card is three tabs: *Start* (name a new board and create
 * it, type a join code, import a file), *Recent* (the boards this device has
 * opened) and *Settings* (who you are on a board, the theme, the language).
 * Creating a board is one field and one button; everything else a board used
 * to be configured with up front — visibility, PIN, who can edit — is changed
 * from inside it, where the creator can see what they are changing.
 *
 * The join code is six boxes over one invisible `TextInput`, so the keyboard,
 * paste and autofill all work as they do on any input while the boxes show the
 * code character by character. A pasted link goes straight through
 * `parseBoardRef`.
 */
import { useCanvasRef, type CanvasRef } from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardCanvas } from '@/components/board/BoardCanvas';
import { useBoardMirror } from '@/components/board/BoardMirror';
import { BottomControls } from '@/components/board/BottomControls';
import { Toolbar } from '@/components/board/Toolbar';
import { BoardHeader, HeaderScrim } from '@/components/header/BoardHeader';
import { AvatarPicker } from '@/components/screens/NicknameScreen';
import { ImportSheet } from '@/components/sheets/ImportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GlassPanel, GlassScene } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { Segmented } from '@/components/ui/Segmented';
import { SectionLabel } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Text';
import { ToastHost, toast } from '@/components/ui/Toast';
import { Fonts, Radius, Shadow, type Theme } from '@/constants/theme';
import { relativeTime, useT } from '@/features/i18n/store';
import type { Lang } from '@/features/i18n/strings';
import { useDemoBoard } from '@/features/board/demo';
import { LIMITS, type BoardSnapshot } from '@/features/board/model';
import { useSessionStore, useColors, useDark } from '@/features/session/store';
import { createBoard, importSnapshot, resolveShortCode } from '@/services/api/boards';
import { parseBoardRef } from '@/utils/deep-link';
import { thud } from '@/utils/haptics';
import { SHORT_CODE_LENGTH, normalizeShortCode } from '@/utils/short-code';

type Tab = 'start' | 'recent' | 'settings';

export default function Home() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const nickColor = useSessionStore((s) => s.nickColor);
  const recent = useSessionStore((s) => s.recent);
  const forgetBoard = useSessionStore((s) => s.forgetBoard);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [tab, setTab] = useState<Tab>('start');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const codeInput = useRef<TextInput>(null);
  // The demo board behind the card; the glass on Android blurs a snapshot of it.
  const canvasRef = useCanvasRef();
  const mirror = useBoardMirror(canvasRef);
  // Home stays mounted under a board: the demo lives only while home is shown.
  const focused = useIsFocused();

  const openBoard = (boardId: string, pickName = false) => {
    router.push({
      pathname: '/board/[id]',
      // `pickName` forces the identity step even for someone whose nickname is
      // already remembered — creating a board is the moment to choose how you
      // will appear on it.
      params: pickName ? { id: boardId, pickName: '1' } : { id: boardId },
    });
  };

  // No `finally` and nothing conditional inside a `try` in here: the React
  // Compiler skips a component that has either, and compiled, typing in the
  // card no longer re-renders the demo board behind it.
  async function handleCreate() {
    setBusy(true);
    const request = {
      name: name.trim() || t.newBoardName,
      access: 'public',
      editPolicy: 'everyone',
      creatorId: userId,
    } as const;
    try {
      const meta = await createBoard(request);
      thud(haptics);
      openBoard(meta.id, true);
    } catch (error) {
      toast(messageOf(error, t.errCreate));
    }
    setBusy(false);
  }

  async function handleJoin(raw: string) {
    const ref = parseBoardRef(raw);
    if (!ref) {
      toast(t.errCodeInvalid);
      return;
    }
    setBusy(true);
    const lookup = ref.kind === 'id' ? Promise.resolve(ref.boardId) : resolveShortCode(ref.shortCode);
    try {
      const boardId = await lookup;
      setCode('');
      openBoard(boardId);
    } catch (error) {
      setCode('');
      toast(messageOf(error, t.errJoin));
    }
    setBusy(false);
  }

  /** Characters fill the boxes; a link or an id skips them and joins at once. */
  function onCodeChange(raw: string) {
    if (busy) return;
    if (raw.includes('/') || raw.includes(':')) {
      void handleJoin(raw);
      return;
    }
    const next = normalizeShortCode(raw).slice(0, SHORT_CODE_LENGTH);
    setCode(next);
    if (next.length === SHORT_CODE_LENGTH) void handleJoin(next);
  }

  async function handleImport(snapshot: BoardSnapshot) {
    // An imported file always becomes a *new* board, so importing can never
    // overwrite one that other people are working on.
    const meta = await importSnapshot(
      { ...snapshot, meta: { name: snapshot.meta.name || t.importedBoardName } },
      userId,
    );
    openBoard(meta.id, true);
  }

  const start = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.accent,
            ...Shadow.accent,
          }}
        >
          <Icon name="board" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="extrabold" size={26} leading={1.05} tracking={-0.6}>
            {t.appName}
          </Txt>
          <Txt weight="semibold" size={12.5} tone="secondary">
            {t.tagline}
          </Txt>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Field
          value={name}
          onChangeText={setName}
          placeholder={t.boardNamePlaceholder}
          maxLength={LIMITS.maxBoardNameLength}
          accessibilityLabel={t.boardNamePlaceholder}
          returnKeyType="go"
          onSubmitEditing={() => !busy && handleCreate()}
        />
        <Button label={t.createBoard} icon="plus" onPress={handleCreate} loading={busy} fullWidth />
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t.joinCode}</SectionLabel>
        {/* The boxes are a picture of the input; the input itself is the thing
            with focus, so paste and autofill just work. */}
        <Pressable
          accessibilityRole="none"
          onPress={() => codeInput.current?.focus()}
          style={{ flexDirection: 'row', gap: 6, opacity: busy ? 0.6 : 1 }}
        >
          {Array.from({ length: SHORT_CODE_LENGTH }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 14,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: code.length === i ? c.accent : c.borderStrong,
                backgroundColor: code.length === i ? c.background : c.glassTintSolid,
              }}
            >
              <Txt mono weight="bold" size={20}>
                {code[i] ?? ''}
              </Txt>
            </View>
          ))}
          <TextInput
            ref={codeInput}
            value={code}
            onChangeText={onCodeChange}
            accessibilityLabel={t.joinCode}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            autoCorrect={false}
            caretHidden
            editable={!busy}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0,
              fontFamily: Fonts.monoBold,
              color: 'transparent',
            }}
          />
        </Pressable>
        <Txt size={11.5} leading={1.4} tone="secondary">
          {t.joinCodeHint}
        </Txt>
      </View>

      <Button
        label={t.importBoard}
        icon="upload"
        variant="dashed"
        onPress={() => setImporting(true)}
        fullWidth
      />
    </>
  );

  const recentTab = (
    <View style={{ gap: 8 }}>
      {recent.length === 0 ? (
        <Txt size={12.5} leading={1.4} tone="secondary" style={{ textAlign: 'center', paddingVertical: 24 }}>
          {t.noRecent}
        </Txt>
      ) : (
        recent.map((board) => (
          <GlassPanel key={board.id} level="row" radius={Radius.lg} border={c.border}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${board.name}, ${board.shortCode}`}
              onPress={() => openBoard(board.id)}
              onLongPress={() => {
                forgetBoard(board.id);
                toast(t.forget);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                paddingHorizontal: 13,
                paddingVertical: 12,
              }}
            >
              <Avatar name={board.name} color={nickColor} size={38} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="bold" size={13.5} leading={1.2} numberOfLines={1}>
                  {board.name}
                </Txt>
                <Txt size={11} mono tone="secondary" numberOfLines={1}>
                  {board.shortCode} · {relativeTime(t, board.lastOpenedAt)}
                </Txt>
              </View>
              <Icon name="chevron" size={16} color={c.textTertiary} />
            </Pressable>
          </GlassPanel>
        ))
      )}
    </View>
  );

  return (
    <GlassScene render={mirror} style={{ backgroundColor: c.background }}>
      {focused ? <DemoBoard canvasRef={canvasRef} /> : null}
      {busy ? <LoadingBar /> : null}
      <KeyboardAvoidingView
        // The gutter is the parent's padding, not the card's margin: a card at
        // `width: '100%'` ignores its own margins and ran edge to edge.
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <GlassPanel
          level="panel"
          radius={Radius.xxl}
          style={{
            width: '100%',
            maxWidth: 460,
            maxHeight: height - insets.top - insets.bottom - 32,
            ...Shadow.panel,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
          >
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'start', label: t.tabStart },
                { value: 'recent', label: t.recent },
                { value: 'settings', label: t.tabSettings },
              ]}
            />
            {tab === 'start' ? start : null}
            {tab === 'recent' ? recentTab : null}
            {tab === 'settings' ? <SettingsTab /> : null}
          </ScrollView>
        </GlassPanel>
      </KeyboardAvoidingView>

      <ToastHost bottom={Math.max(insets.bottom, 16) + 24} enabled={!importing} />

      <ImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        onImportSnapshot={handleImport}
        allowImagePlacement={false}
      />
    </GlassScene>
  );
}

const noop = () => {};
const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * The board the card floats over: the same components as the board screen,
 * fed the demo content, out of focus and out of reach (no touches, hidden from
 * screen readers). The drawing is blurred in Skia; iOS blurs the chrome over
 * it natively too, Android — whose `BlurView` misdraws (see ui/Glass) — veils
 * it instead.
 */
function DemoBoard({ canvasRef }: { canvasRef: RefObject<CanvasRef | null> }) {
  useDemoBoard();
  const c = useColors();
  const dark = useDark();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const headerHeight = insets.top + (landscape ? 58 : 104);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={FILL}
    >
      <BoardCanvas canvasRef={canvasRef} blur={3} />
      <HeaderScrim height={headerHeight} />
      <BoardHeader
        landscape={landscape}
        codeCopied={false}
        onCopyCode={noop}
        onOpenPeople={noop}
        onOpenMenu={noop}
        onOpenPrivacy={noop}
        onOpenShare={noop}
      />
      <Toolbar landscape={landscape} />
      <BottomControls top={headerHeight + 6} onOpenAi={noop} />
      {Platform.OS === 'ios' ? (
        <BlurView intensity={14} tint={dark ? 'dark' : 'light'} style={FILL} />
      ) : (
        // `background` is a six-digit hex: + 55% alpha.
        <View style={[FILL, { backgroundColor: c.background + '8C' }]} />
      )}
    </View>
  );
}

/** Who you are on a board, and how the app looks: all local, all remembered. */
function SettingsTab() {
  const t = useT();
  const c = useColors();
  const nickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const avatar = useSessionStore((s) => s.avatar);
  const setNickname = useSessionStore((s) => s.setNickname);
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);
  const lang = useSessionStore((s) => s.lang);
  const setLang = useSessionStore((s) => s.setLang);
  const [draft, setDraft] = useState(nickname);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SectionLabel>{t.nickPlaceholder}</SectionLabel>
        <GlassPanel level="row" radius={18} border={c.border}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <Avatar name={draft || '?'} color={nickColor} avatar={avatar} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field
                value={draft}
                // Written through as typed: a tap on the theme or language
                // does not blur the field, so a blur-time save never came.
                onChangeText={(v) => {
                  setDraft(v);
                  setNickname(v);
                }}
                placeholder={t.nickPlaceholder}
                maxLength={LIMITS.maxNicknameLength}
                autoComplete="nickname"
                accessibilityLabel={t.nickPlaceholder}
                style={{
                  borderWidth: 0,
                  backgroundColor: 'transparent',
                  paddingHorizontal: 0,
                  paddingVertical: 4,
                  fontSize: 16,
                }}
              />
            </View>
          </View>
        </GlassPanel>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t.yourIcon}</SectionLabel>
        <AvatarPicker name={draft} />
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t.theme}</SectionLabel>
        <Segmented<Theme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t.themeLight },
            { value: 'dark', label: t.themeDark },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t.language}</SectionLabel>
        <Segmented<Lang>
          value={lang}
          onChange={setLang}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
        />
      </View>
    </View>
  );
}
