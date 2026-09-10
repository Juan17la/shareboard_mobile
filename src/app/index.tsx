/**
 * Home: create a board, join one with a code, or reopen a recent one.
 *
 * The design gives creation a single button and no form. Everything a board
 * used to be configured with up front — name, visibility, PIN, who can edit —
 * is now changed from inside the board, where the creator can see what they are
 * changing. "Crear una pizarra sin necesidad de registrarse" (docs/01) is meant
 * to be two taps, and asking four questions before the canvas appears was the
 * thing standing in the way.
 *
 * In landscape the same content reflows into two columns rather than scrolling
 * a narrow strip.
 */
import { router } from 'expo-router';
import { useState } from 'react';
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

import { ImportSheet } from '@/components/sheets/ImportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Backdrop } from '@/components/ui/Backdrop';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Text';
import { ToastHost, toast } from '@/components/ui/Toast';
import { Colors, Fonts, Radius, Shadow } from '@/constants/theme';
import { relativeTime, useT, useToggleLang } from '@/features/i18n/store';
import type { BoardSnapshot } from '@/features/board/model';
import { useSessionStore } from '@/features/session/store';
import { createBoard, importSnapshot, resolveShortCode } from '@/services/api/boards';
import { parseBoardRef } from '@/utils/deep-link';
import { thud } from '@/utils/haptics';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const t = useT();
  const toggleLang = useToggleLang();
  const userId = useSessionStore((s) => s.userId);
  const nickColor = useSessionStore((s) => s.nickColor);
  const recent = useSessionStore((s) => s.recent);
  const forgetBoard = useSessionStore((s) => s.forgetBoard);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const openBoard = (boardId: string, pickName = false) => {
    router.push({
      pathname: '/board/[id]',
      // `pickName` forces the identity step even for someone whose nickname is
      // already remembered — creating a board is the moment to choose how you
      // will appear on it.
      params: pickName ? { id: boardId, pickName: '1' } : { id: boardId },
    });
  };

  async function handleCreate() {
    setBusy(true);
    try {
      const meta = await createBoard({
        name: t.newBoardName,
        access: 'public',
        editPolicy: 'everyone',
        creatorId: userId,
      });
      thud(haptics);
      openBoard(meta.id, true);
    } catch (error) {
      toast(error instanceof Error ? error.message : t.errCreate);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const ref = parseBoardRef(code);
    if (!ref) {
      toast(t.errCodeInvalid);
      return;
    }
    setBusy(true);
    try {
      const boardId = ref.kind === 'id' ? ref.boardId : await resolveShortCode(ref.shortCode);
      setCode('');
      openBoard(boardId);
    } catch (error) {
      toast(error instanceof Error ? error.message : t.errJoin);
    } finally {
      setBusy(false);
    }
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

  const canJoin = code.trim().length >= 3 && !busy;
  const gutter = Math.max(insets.left, insets.right, landscape ? 46 : 22);

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(landscape ? { width: '100%' } : null),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.accent,
            ...Shadow.accent,
          }}
        >
          <Icon name="board" size={19} color="#FFFFFF" />
        </View>
        <Txt weight="extrabold" size={20} tracking={-0.4}>
          {t.appName}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.language}
        onPress={toggleLang}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: Colors.borderStrong,
          backgroundColor: 'rgba(255,255,255,0.8)',
        }}
      >
        <Txt weight="bold" size={11}>
          {t.langLabel}
        </Txt>
      </Pressable>
    </View>
  );

  const createColumn = (
    <View style={{ gap: 14, flex: landscape ? 1 : undefined, minWidth: 0 }}>
      <View style={{ gap: 6 }}>
        <Txt weight="extrabold" size={26} leading={1.15} tracking={-0.6}>
          {t.homeTitle}
        </Txt>
        <Txt size={14} leading={1.45} color="#565D6C">
          {t.homeSub}
        </Txt>
      </View>
      <Button label={t.createBoard} icon="plus" onPress={handleCreate} loading={busy} fullWidth />
    </View>
  );

  const joinColumn = (
    <View style={{ gap: 20, flex: landscape ? 1 : undefined, minWidth: 0 }}>
      <GlassPanel level="row" radius={Radius.xl} border={Colors.border}>
        <View style={{ gap: 11, padding: 16 }}>
          <Txt weight="extrabold" size={13}>
            {t.joinTitle}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={code}
              onChangeText={(value) => setCode(value.toUpperCase())}
              placeholder="ABC-123"
              placeholderTextColor="rgba(27,32,48,0.3)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={40}
              returnKeyType="go"
              onSubmitEditing={() => canJoin && handleJoin()}
              accessibilityLabel={t.codeFieldLabel}
              style={{
                flex: 1,
                minWidth: 0,
                paddingHorizontal: 13,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: Colors.borderStrong,
                backgroundColor: '#FFFFFF',
                fontFamily: Fonts.monoBold,
                fontSize: 15,
                letterSpacing: 1.5,
                color: Colors.text,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.enter}
              accessibilityState={{ disabled: !canJoin }}
              disabled={!canJoin}
              onPress={handleJoin}
              style={{
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: canJoin ? Colors.accent : 'rgba(27,32,48,0.14)',
              }}
            >
              <Txt weight="extrabold" size={13.5} tone="inverse">
                {t.enter}
              </Txt>
            </Pressable>
          </View>
          <Txt size={11.5} leading={1.4} tone="secondary">
            {t.joinHint}
          </Txt>
        </View>
      </GlassPanel>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t.recent}</SectionLabel>
        {recent.length === 0 ? (
          <Txt size={11.5} leading={1.4} tone="secondary">
            {t.noRecent}
          </Txt>
        ) : (
          recent.map((board) => (
            <GlassPanel key={board.id} level="row" radius={Radius.lg} border={Colors.border}>
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
                <Icon name="chevron" size={16} color="rgba(27,32,48,0.35)" />
              </Pressable>
            </GlassPanel>
          ))
        )}
      </View>

      <Button
        label={t.importBoard}
        icon="share"
        variant="dashed"
        onPress={() => setImporting(true)}
        fullWidth
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop variant="home" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            gap: landscape ? 14 : 20,
            paddingTop: insets.top + (landscape ? 14 : 26),
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingHorizontal: gutter,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {header}
          <View
            style={
              landscape
                ? { flexDirection: 'row', gap: 28, alignItems: 'flex-start' }
                : { gap: 20 }
            }
          >
            {createColumn}
            {joinColumn}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ToastHost bottom={Math.max(insets.bottom, 16) + 24} enabled={!importing} />

      <ImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        onImportSnapshot={handleImport}
        allowImagePlacement={false}
      />
    </View>
  );
}
