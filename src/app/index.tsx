/**
 * `/`: there is no home screen. The app always opens on this device's offline
 * board (docs/plans/34), made on first launch — it needs no network, so there
 * is always something to draw on at once. Only if the device cannot store it
 * does it fall back to the whiteboard the user was last at, or a new live one.
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
import { ensureLocal } from '@/features/board/local';

export default function Start() {
  const c = useColors();
  const t = useT();
  const hydrated = useSessionStore((s) => s.hydrated);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const newName = t.newBoardName;
  const localName = t.localBoardName;
  const failMessage = t.errCreate;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const live = () => {
      const { recent, userId } = useSessionStore.getState();
      // The last one opened; if it turns out to be gone the board screen lets go
      // of it and comes back here for the next.
      if (recent[0]) {
        router.replace({ pathname: '/board/[id]', params: { id: recent[0].id } });
        return;
      }
      createBoard({ name: newName, access: 'public', editPolicy: 'everyone', creatorId: userId }).then(
        (meta) => {
          if (!cancelled) router.replace({ pathname: '/board/[id]', params: { id: meta.id } });
        },
        (error) => {
          if (!cancelled) setFailed(error instanceof Error ? error.message : failMessage);
        },
      );
    };
    ensureLocal(localName).then(
      (board) => {
        if (!cancelled) router.replace({ pathname: '/board/[id]', params: { id: board.id } });
      },
      () => {
        if (!cancelled) live();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hydrated, attempt, newName, localName, failMessage]);

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
