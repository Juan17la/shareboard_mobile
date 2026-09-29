/**
 * "Draw with AI": a small chat. The server (server/src/ai.ts) answers each
 * message with a drawing centred on what this screen is looking at, as one
 * group. It shows here as a preview first; *Add to board* commits it as this
 * user's own edit (one undo step), *Discard* drops it. Each prompt is
 * independent: the model does not see the board.
 *
 * The input sits on top and the newest message right under it: the sheet body
 * is already a ScrollView, and this way nothing needs scrolling to the end.
 */
import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { useColors, useSessionStore } from '@/features/session/store';
import { contentBounds } from '@/features/board/geometry';
import type { BoardElement } from '@/features/board/model';
import { drawWithAi } from '@/services/api/boards';

import { ElementRenderer } from '../board/ElementRenderer';

import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

interface Message {
  from: 'you' | 'ai' | 'error';
  text: string;
  /** An AI drawing still waiting for Add/Discard; cleared once decided. */
  elements?: BoardElement[];
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function AiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const userId = useSessionStore((s) => s.userId);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Message[]>([]);

  const addElements = useBoardStore((s) => s.addElements);
  const smooth = useSessionStore((s) => s.settings.smooth);

  const push = (msg: Message) => setLog((l) => [msg, ...l].slice(0, 30));

  const decide = (msg: Message, accept: boolean) => {
    const els = msg.elements ?? [];
    if (accept) addElements(els);
    const note = accept ? fill(t.aiAdded, { N: els.length }) : t.aiDiscarded;
    setLog((l) =>
      l.map((m) =>
        m === msg ? { ...m, elements: undefined, text: `${m.text} ${note}`.trim() } : m,
      ),
    );
  };

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
      push({ from: 'ai', text: res.reply, elements: res.elements.length ? res.elements : undefined });
    } catch (err) {
      push({ from: 'error', text: messageOf(err) });
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} title={t.sheetAi} onClose={onClose} closeLabel={t.close} tall>
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
              gap: 8,
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
            {m.elements ? (
              <>
                <Preview elements={m.elements} smooth={smooth} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button compact icon="check" label={t.aiAccept} onPress={() => decide(m, true)} />
                  <Button
                    compact
                    variant="secondary"
                    label={t.aiDiscard}
                    onPress={() => decide(m, false)}
                  />
                </View>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const PREVIEW_W = 260;
const PREVIEW_H = 180;
const PAD = 10;

/** The drawing as it will look, scaled to fit a card — the board's own renderer. */
function Preview({ elements, smooth }: { elements: BoardElement[]; smooth: boolean }) {
  const bounds = useMemo(() => contentBounds(elements), [elements]);
  if (!bounds) return null;
  const scale = Math.min(
    1,
    (PREVIEW_W - PAD * 2) / Math.max(1, bounds.width),
    (PREVIEW_H - PAD * 2) / Math.max(1, bounds.height),
  );
  const width = Math.round(bounds.width * scale + PAD * 2);
  const height = Math.round(bounds.height * scale + PAD * 2);
  return (
    <Canvas style={{ width, height, borderRadius: 8 }}>
      <Rect x={0} y={0} width={width} height={height} color="#FFFFFF" />
      <Group
        transform={[
          { translateX: PAD - bounds.x * scale },
          { translateY: PAD - bounds.y * scale },
          { scale },
        ]}
      >
        {elements.map((el) => (
          <ElementRenderer key={el.id} el={el} smooth={smooth} />
        ))}
      </Group>
    </Canvas>
  );
}
