/**
 * Offers the newest GitHub release once per launch (Android: the APK opens in
 * the browser, which downloads it and hands it to the system installer).
 * The app ships for Android only; OTA JS updates (expo-updates) would skip
 * the download for changes that touch no native code.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fill } from '@/features/i18n/strings';
import { useT } from '@/features/i18n/store';
import { checkForUpdate, type Update } from '@/features/update/releases';

export function UpdatePrompt() {
  const t = useT();
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') void checkForUpdate().then(setUpdate);
  }, []);

  if (!update) return null;
  return (
    <ConfirmDialog
      open
      title={fill(t.updateTitle, { VERSION: update.version })}
      body={update.notes || t.updateBody}
      confirmLabel={t.updateCta}
      cancelLabel={t.updateLater}
      onConfirm={() => {
        void Linking.openURL(update.apkUrl);
        setUpdate(null);
      }}
      onCancel={() => setUpdate(null)}
    />
  );
}
