import { Text, View } from 'react-native';

import { useBoardStore } from '@/features/board/store';

/** Row of presence avatars (initials) for everyone currently on the board. */
export function ConnectedUsers() {
  const participants = useBoardStore((s) => s.participants);
  const shown = participants.slice(0, 4);
  const overflow = participants.length - shown.length;

  return (
    <View className="flex-row items-center" accessibilityLabel={`${participants.length} people connected`}>
      {shown.map((p, i) => (
        <View
          key={p.userId}
          style={{ backgroundColor: p.color, marginLeft: i === 0 ? 0 : -8 }}
          className="h-7 w-7 items-center justify-center rounded-full border-2 border-background dark:border-background-dark"
        >
          <Text className="text-[11px] font-bold text-white">
            {p.nickname.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View className="ml-[-8px] h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-surface-selected dark:border-background-dark dark:bg-surface-selected-dark">
          <Text className="text-[11px] font-bold text-text-secondary dark:text-text-secondary-dark">
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
