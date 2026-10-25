/**
 * While `open`, Android's Back closes the overlay instead of leaving the app —
 * for overlays that are not a `Modal` (a `Modal` has `onRequestClose`). The
 * overlay opened last takes Back first.
 */
import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';

export function useBackToClose(open: boolean, onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open]);
}
