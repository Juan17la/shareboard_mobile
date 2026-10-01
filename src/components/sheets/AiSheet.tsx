/**
 * "Draw with AI": a small chat. The server (server/src/ai.ts) answers each
 * message with a drawing centred on what this screen is looking at, as one
 * group. It shows here as a preview first; *Add to board* commits it as this
 * user's own edit (one undo step), *Discard* drops it. Each prompt is
 * independent: the model does not see the board.
 *
 * A chat, read top to bottom: the oldest message first, the newest last, with
 * the input pinned under them. The sheet takes the whole height so there is
 * room for a drawing preview, and the list follows the newest message down.
 */
import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { Component, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

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

  const list = useRef<ScrollView>(null);

  const push = (msg: Message) => setLog((l) => [...l, msg].slice(-30));

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
    <Sheet open={open} title={t.sheetAi} onClose={onClose} closeLabel={t.close} full>
      <View style={{ flex: 1, gap: 10 }}>
        <ScrollView
          ref={list}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 6 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // The newest message is the last one: keep it in view as it arrives.
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        >
          {log.length === 0 ? (
            <Txt size={12.5} leading={1.45} tone="secondary">
              {t.aiHint}
            </Txt>
          ) : null}
          {log.map((m, i) => (
            <View
              key={i}
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
                  {/* A drawing that cannot be painted must not take the answer with it. */}
                  <PreviewGuard fallback={t.aiNoPreview}>
                    <Preview elements={m.elements} smooth={smooth} />
                  </PreviewGuard>
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
          {busy ? (
            <Txt size={12} tone="secondary">
              {t.aiThinking}
            </Txt>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              value={prompt}
              maxLength={1000}
              placeholder={t.aiPlaceholder}
              accessibilityLabel={t.aiPlaceholder}
              returnKeyType="send"
              onChangeText={setPrompt}
              onSubmitEditing={() => void send()}
            />
          </View>
          <Button
            icon="sparkle"
            label={t.aiSend}
            compact
            loading={busy}
            disabled={!prompt.trim()}
            onPress={() => void send()}
          />
        </View>
      </View>
    </Sheet>
  );
}

/** Shows `fallback` instead of the preview if painting it throws. */
class PreviewGuard extends Component<{ children: ReactNode; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Txt size={12} tone="secondary">
        {this.props.fallback}
      </Txt>
    ) : (
      this.props.children
    );
  }
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
