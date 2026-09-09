import { Text, View } from 'react-native';

import { StatusColors } from '@/constants/theme';
import type { ConnectionStatus as Status } from '@/features/board/store';
import { useBoardStore } from '@/features/board/store';

const LABEL: Record<Status, string> = {
  idle: 'Connecting…',
  connecting: 'Connecting…',
  online: 'Live',
  offline: 'Offline',
};

const COLOR: Record<Status, string> = {
  idle: StatusColors.connecting,
  connecting: StatusColors.connecting,
  online: StatusColors.online,
  offline: StatusColors.offline,
};

export function ConnectionStatus() {
  const status = useBoardStore((s) => s.connection);
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLabel={`Connection: ${LABEL[status]}`}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR[status] }} />
      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">{LABEL[status]}</Text>
    </View>
  );
}
