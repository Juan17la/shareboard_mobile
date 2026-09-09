import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoardStore } from '@/features/board/store';

import { ConnectedUsers } from './ConnectedUsers';
import { ConnectionStatus } from './ConnectionStatus';

export function BoardHeader() {
  const insets = useSafeAreaInsets();
  const meta = useBoardStore((s) => s.meta);

  return (
    <View
      className="border-b border-border bg-background px-3 pb-2 dark:border-border-dark dark:bg-background-dark"
      style={{ paddingTop: insets.top + 6 }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface dark:active:bg-surface-dark"
        >
          <Text className="text-xl text-text dark:text-text-dark">‹</Text>
        </Pressable>

        <View className="flex-1 px-2">
          <Pressable onPress={() => router.push('/(modals)/settings')} accessibilityRole="button">
            <Text numberOfLines={1} className="text-base font-semibold text-text dark:text-text-dark">
              {meta?.name ?? 'Board'}
            </Text>
          </Pressable>
          <ConnectionStatus />
        </View>

        <View className="flex-row items-center gap-2">
          <ConnectedUsers />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share board"
            onPress={() => router.push('/(modals)/share')}
            className="h-9 items-center justify-center rounded-lg bg-primary px-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-white">Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
