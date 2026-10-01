/**
 * `/`: there is no home screen. The app opens on the whiteboard the user was
 * last at; with none (a first launch, or every remembered one gone) it makes a
 * blank one and opens that — so there is always something to draw on at once.
 *
 * Everything a home screen used to offer (a new board, an old one, a code, a
 * file, the settings) is a button on the whiteboard itself.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Txt } from '@/components/ui/Text';
import { useT } from '@/features/i18n/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { createBoard } from '@/services/api/boards';

export default function Start() {
  const c = useColors();
  const t = useT();
  const hydrated = useSessionStore((s) => s.hydrated);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const newName = t.newBoardName;
  const failMessage = t.errCreate;

  useEffect(() => {
    if (!hydrated) return;
    const { recent, userId } = useSessionStore.getState();
    // The last one opened; if it turns out to be gone the board screen lets go
    // of it and comes back here for the next.
    if (recent[0]) {
      router.replace({ pathname: '/board/[id]', params: { id: recent[0].id } });
      return;
    }
    let cancelled = false;
    createBoard({ name: newName, access: 'public', editPolicy: 'everyone', creatorId: userId }).then(
      (meta) => {
        if (!cancelled) router.replace({ pathname: '/board/[id]', params: { id: meta.id } });
      },
      (error) => {
        if (!cancelled) setFailed(error instanceof Error ? error.message : failMessage);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hydrated, attempt, newName, failMessage]);

  if (failed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 28,
        }}
      >
        <Txt weight="extrabold" size={20} leading={1.2} tracking={-0.4} style={{ textAlign: 'center' }}>
          {t.errCreate}
        </Txt>
        <Txt size={13} leading={1.45} tone="secondary" style={{ textAlign: 'center' }}>
          {failed}
        </Txt>
        <Button
          label={t.retry}
          variant="secondary"
          onPress={() => {
            setFailed(null);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  return <LoadingScreen />;
}
