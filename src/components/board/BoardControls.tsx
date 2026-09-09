import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

/** Floating column of secondary actions (top-right of the canvas area). */
export function BoardControls() {
  const actions: { label: string; glyph: string; href: string }[] = [
    { label: 'Export', glyph: '⤓', href: '/(modals)/export' },
    { label: 'Import', glyph: '⤒', href: '/(modals)/import' },
    { label: 'Permissions', glyph: '🔒', href: '/(modals)/permissions' },
    { label: 'Settings', glyph: '⚙', href: '/(modals)/settings' },
  ];
  return (
    <View className="absolute right-3 top-3 gap-2">
      {actions.map((a) => (
        <Pressable
          key={a.href}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => router.push(a.href as never)}
          className="h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 active:bg-surface dark:border-border-dark dark:bg-background-dark/90"
        >
          <Text className="text-base text-text dark:text-text-dark">{a.glyph}</Text>
        </Pressable>
      ))}
    </View>
  );
}
