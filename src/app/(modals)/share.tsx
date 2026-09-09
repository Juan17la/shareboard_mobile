import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalScreen } from '@/components/ui/ModalScreen';
import { API_BASE_URL } from '@/constants/config';
import { useBoardStore } from '@/features/board/store';
import { boardDeepLink, boardShareLink } from '@/utils/deep-link';

// The web app usually lives at the API host without the trailing `/api`; adjust
// via app.json extra if they diverge.
const WEB_BASE_URL = API_BASE_URL;

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">{label}</Text>
      <Pressable
        onPress={onCopy}
        className="flex-row items-center justify-between rounded-lg border border-border p-3 active:bg-surface dark:border-border-dark dark:active:bg-surface-dark"
      >
        <Text className="flex-1 text-text dark:text-text-dark" numberOfLines={1}>
          {value}
        </Text>
        <Text className="ml-2 text-primary">{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

export default function ShareModal() {
  const meta = useBoardStore((s) => s.meta);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (value: string, key: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  if (!meta) return <ModalScreen title="Share">{null}</ModalScreen>;

  const link = boardShareLink(WEB_BASE_URL, meta.shortCode);
  const deepLink = boardDeepLink(meta.id);

  return (
    <ModalScreen title="Share board">
      <View className="items-center gap-1 py-2">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Short code</Text>
        <Text className="text-4xl font-bold tracking-[4px] text-text dark:text-text-dark">
          {meta.shortCode}
        </Text>
      </View>
      <CopyRow label="Web link" value={link} copied={copied === 'link'} onCopy={() => copy(link, 'link')} />
      <CopyRow
        label="App deep link"
        value={deepLink}
        copied={copied === 'deep'}
        onCopy={() => copy(deepLink, 'deep')}
      />
      <Pressable onPress={() => Linking.openURL(link)} className="rounded-lg bg-primary p-3 active:opacity-80">
        <Text className="text-center font-semibold text-white">Open the web board</Text>
      </Pressable>
      <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
        {meta.access === 'private'
          ? 'This board is private — people also need the PIN.'
          : 'Anyone with the link can open this board.'}
      </Text>
    </ModalScreen>
  );
}
