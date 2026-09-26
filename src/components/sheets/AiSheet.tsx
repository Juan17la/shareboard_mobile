/**
 * "Draw with AI": a small chat. Each message is drawn by the server (see
 * server/src/ai.ts) centred on what this screen is looking at, and the
 * elements arrive over the socket like anyone else's — so this sheet only
 * keeps the log. Each prompt is independent: the model does not see the board.
 *
 * The input sits on top and the newest message right under it: the sheet body
 * is already a ScrollView, and this way nothing needs scrolling to the end.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { drawWithAi } from '@/services/api/boards';

import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

interface Message {
  from: 'you' | 'ai' | 'error';
  text: string;
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function AiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Message[]>([]);

  const push = (msg: Message) => setLog((l) => [msg, ...l].slice(0, 30));

  async function send() {
    const text = prompt.trim();
    const { meta, boardToken, viewport, camera } = useBoardStore.getState();
    if (!text || busy || !meta) return;
    // Read before the `try`, and no `finally`: the React Compiler skips a
    // component with either inside one (see app/board/[id].tsx).
    const auth = { userId, token: boardToken ?? '' };
    const at = {
      x: (viewport.width / 2 - camera.x) / camera.scale,
      y: (viewport.height / 2 - camera.y) / camera.scale,
    };
    push({ from: 'you', text });
    setPrompt('');
    setBusy(true);
    try {
      const res = await drawWithAi(meta.id, text, at, auth);
      push({ from: 'ai', text: [res.reply, fill(t.aiAdded, { N: res.added })].join(' ').trim() });
    } catch (err) {
      push({ from: 'error', text: messageOf(err) });
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} title={t.sheetAi} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 12 }}>
        <Field
          autoFocus
          value={prompt}
          maxLength={1000}
          placeholder={t.aiPlaceholder}
          accessibilityLabel={t.aiPlaceholder}
          hint={log.length ? undefined : t.aiHint}
          returnKeyType="send"
          onChangeText={setPrompt}
          onSubmitEditing={() => void send()}
        />
        <Button
          icon="sparkle"
          label={t.aiSend}
          compact
          loading={busy}
          disabled={!prompt.trim()}
          onPress={() => void send()}
        />

        {busy ? (
          <Txt size={12} tone="secondary">
            {t.aiThinking}
          </Txt>
        ) : null}
        {log.map((m, i) => (
          <View
            key={log.length - i}
            style={{
              alignSelf: m.from === 'you' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor:
                m.from === 'you' ? c.accent : m.from === 'error' ? c.dangerSoft : c.surfaceSelected,
            }}
          >
            <Txt
              size={13}
              leading={1.4}
              tone={m.from === 'you' ? 'inverse' : m.from === 'error' ? 'danger' : 'default'}
            >
              {m.text}
            </Txt>
          </View>
        ))}
      </View>
    </Sheet>
  );
}
