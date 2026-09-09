import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DrawingPalette } from '@/constants/theme';
import type { ShapeKind, ToolType } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';

const TOOLS: { tool: ToolType; glyph: string; label: string }[] = [
  { tool: 'select', glyph: '⤢', label: 'Select' },
  { tool: 'pen', glyph: '✎', label: 'Pen' },
  { tool: 'eraser', glyph: '⌫', label: 'Eraser' },
  { tool: 'text', glyph: 'T', label: 'Text' },
];

const SHAPES: { shape: ShapeKind; glyph: string }[] = [
  { shape: 'rectangle', glyph: '▭' },
  { shape: 'ellipse', glyph: '◯' },
  { shape: 'line', glyph: '╱' },
  { shape: 'arrow', glyph: '→' },
];

const WIDTHS = [2, 4, 8, 14, 22];

function ToolButton({
  active,
  disabled,
  onPress,
  children,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-lg ${
        active ? 'bg-primary' : 'bg-transparent active:bg-surface-selected dark:active:bg-surface-selected-dark'
      } ${disabled ? 'opacity-30' : ''}`}
    >
      <Text className={`text-xl ${active ? 'text-white' : 'text-text dark:text-text-dark'}`}>{children}</Text>
    </Pressable>
  );
}

export function Toolbar() {
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const setTool = useBoardStore((s) => s.setTool);
  const setConfig = useBoardStore((s) => s.setConfig);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const undoDepth = useBoardStore((s) => s.undoStack.length);
  const redoDepth = useBoardStore((s) => s.redoStack.length);

  const [popover, setPopover] = useState<'color' | 'width' | 'shape' | null>(null);
  const togglePopover = (p: 'color' | 'width' | 'shape') => setPopover((cur) => (cur === p ? null : p));

  const isShapeTool = ['rectangle', 'ellipse', 'line', 'arrow'].includes(tool);

  return (
    <View className="border-t border-border bg-background px-2 pb-2 pt-1 dark:border-border-dark dark:bg-background-dark">
      {popover === 'color' ? (
        <View className="mb-2 flex-row flex-wrap gap-2 rounded-lg bg-surface p-3 dark:bg-surface-dark">
          {DrawingPalette.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Color ${c}`}
              onPress={() => {
                setConfig({ color: c });
                setPopover(null);
              }}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 rounded-full border ${
                config.color === c ? 'border-primary' : 'border-border dark:border-border-dark'
              }`}
            />
          ))}
        </View>
      ) : null}

      {popover === 'width' ? (
        <View className="mb-2 flex-row items-center gap-3 rounded-lg bg-surface p-3 dark:bg-surface-dark">
          {WIDTHS.map((w) => (
            <Pressable
              key={w}
              accessibilityRole="button"
              accessibilityLabel={`Stroke width ${w}`}
              onPress={() => {
                setConfig({ width: w });
                setPopover(null);
              }}
              className={`items-center justify-center rounded-lg p-2 ${
                config.width === w ? 'bg-surface-selected dark:bg-surface-selected-dark' : ''
              }`}
            >
              <View style={{ width: 28, height: w, borderRadius: w / 2, backgroundColor: '#888' }} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {popover === 'shape' ? (
        <View className="mb-2 flex-row gap-2 rounded-lg bg-surface p-3 dark:bg-surface-dark">
          {SHAPES.map((s) => (
            <ToolButton
              key={s.shape}
              label={s.shape}
              active={tool === s.shape}
              onPress={() => {
                setConfig({ shape: s.shape });
                setTool(s.shape);
                setPopover(null);
              }}
            >
              {s.glyph}
            </ToolButton>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          {TOOLS.map((t) => (
            <ToolButton
              key={t.tool}
              label={t.label}
              active={tool === t.tool}
              disabled={!canEdit && t.tool !== 'select'}
              onPress={() => setTool(t.tool)}
            >
              {t.glyph}
            </ToolButton>
          ))}
          <ToolButton label="Shapes" active={isShapeTool} disabled={!canEdit} onPress={() => togglePopover('shape')}>
            ◇
          </ToolButton>
        </View>

        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Color"
            disabled={!canEdit}
            onPress={() => togglePopover('color')}
            style={{ backgroundColor: config.color }}
            className={`h-9 w-9 rounded-full border-2 border-border dark:border-border-dark ${!canEdit ? 'opacity-30' : ''}`}
          />
          <ToolButton label="Stroke width" disabled={!canEdit} onPress={() => togglePopover('width')}>
            ●
          </ToolButton>
          <ToolButton label="Undo" disabled={undoDepth === 0} onPress={undo}>
            ↶
          </ToolButton>
          <ToolButton label="Redo" disabled={redoDepth === 0} onPress={redo}>
            ↷
          </ToolButton>
        </View>
      </View>
    </View>
  );
}
