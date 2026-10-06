/**
 * The header's "+": another whiteboard — a blank one, named here, or one
 * someone else made, joined with its code.
 *
 * The code is six characters of a board's code, or a link to it.
 * The code is six boxes over one invisible `TextInput`, so the keyboard, paste
 * and autofill all work as they do on any input while the boxes show the code
 * character by character. A pasted link goes straight through `parseBoardRef`;
 * the sixth character opens the board.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useColors } from '@/features/session/store';
import { LIMITS } from '@/features/board/model';
import { resolveShortCode } from '@/services/api/boards';
import { parseBoardRef } from '@/utils/deep-link';
import { SHORT_CODE_LENGTH, normalizeShortCode } from '@/utils/short-code';

import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { SectionLabel, Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function JoinSheet({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  /** Makes a blank whiteboard with this name (empty: the default name) and opens it. */
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const c = useColors();
  const t = useT();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);

  // No `finally` and nothing conditional inside a `try` in here: the React
  // Compiler skips a component that has either.
  async function join(raw: string) {
    const ref = parseBoardRef(raw);
    if (!ref) {
      toast(t.errCodeInvalid);
      return;
    }
    setBusy(true);
    const lookup =
      ref.kind === 'id' ? Promise.resolve(ref.boardId) : resolveShortCode(ref.shortCode);
    try {
      const boardId = await lookup;
      setCode('');
      onClose();
      router.replace({ pathname: '/board/[id]', params: { id: boardId } });
    } catch (error) {
      setCode('');
      toast(error instanceof Error ? error.message : t.errJoin);
    }
    setBusy(false);
  }

  /** Characters fill the boxes; a link or an id skips them and joins at once. */
  function onChange(raw: string) {
    if (busy) return;
    if (raw.includes('/') || raw.includes(':')) {
      void join(raw);
      return;
    }
    const next = normalizeShortCode(raw).slice(0, SHORT_CODE_LENGTH);
    setCode(next);
    if (next.length === SHORT_CODE_LENGTH) void join(next);
  }

  return (
    <Sheet open={open} title={t.anotherWhiteboard} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 10, marginBottom: 22 }}>
        <SectionLabel>{t.newWhiteboard}</SectionLabel>
        <Field
          value={name}
          onChangeText={(next) => setName(next.slice(0, LIMITS.maxBoardNameLength))}
          placeholder={t.boardNamePlaceholder}
          accessibilityLabel={t.boardName}
          returnKeyType="done"
          onSubmitEditing={() => onCreate(name.trim())}
        />
        <Button label={t.createBoard} icon="plus" loading={creating} fullWidth onPress={() => onCreate(name.trim())} />
      </View>
      <View style={{ gap: 8, paddingBottom: 8 }}>
        <SectionLabel>{t.joinWhiteboard}</SectionLabel>
        {/* The boxes are a picture of the input; the input itself is the thing
            with focus, so paste and autofill just work. */}
        <Pressable
          accessibilityRole="none"
          onPress={() => input.current?.focus()}
          style={{ flexDirection: 'row', gap: 6, opacity: busy ? 0.6 : 1 }}
        >
          {Array.from({ length: SHORT_CODE_LENGTH }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: code.length === i ? c.accent : c.borderField,
                backgroundColor: code.length === i ? c.background : c.glassTintSolid,
              }}
            >
              <Txt mono weight="bold" size={18}>
                {code[i] ?? ''}
              </Txt>
            </View>
          ))}
          <TextInput
            ref={input}
            value={code}
            onChangeText={onChange}
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
        <Txt size={11} leading={1.4} tone="secondary">
          {t.joinCodeHint}
        </Txt>
      </View>
    </Sheet>
  );
}
