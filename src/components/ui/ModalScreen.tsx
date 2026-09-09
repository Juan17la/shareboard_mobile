import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shared shell for the `(modals)` routes: title bar + close + scroll body. */
export function ModalScreen({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <Text className="text-lg font-semibold text-text dark:text-text-dark">{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface dark:active:bg-surface-dark"
        >
          <Text className="text-xl text-text-secondary dark:text-text-secondary-dark">✕</Text>
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          className="border-t border-border px-4 pt-3 dark:border-border-dark"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
