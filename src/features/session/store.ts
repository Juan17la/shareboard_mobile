/**
 * Per-install session: a stable anonymous `userId`, the identity the user picks
 * (nickname + colour), the app preferences from the settings sheet, and a short
 * list of recently opened boards. Persisted to AsyncStorage.
 *
 * There are no accounts (docs/01-introduction). The `userId` is the identity the
 * backend keys presence and permissions on — never the IP.
 *
 * One thing lives here that looks like it belongs to the board: `pins`. A
 * board's PIN never leaves the server (`BoardMeta` only carries `hasPin`), so
 * the only device that can show the creator their own PIN is the device that
 * set it. Keeping the ones we chose ourselves is what lets the access sheet
 * display the PIN instead of four dots.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { LIMITS } from '@/features/board/model';
import { Avatars, Palettes, avatarColor, type Palette, type Theme } from '@/constants/theme';
import type { Lang } from '@/features/i18n/strings';
import { newUserId } from '@/utils/id';

export interface RecentBoard {
  id: string;
  shortCode: string;
  name: string;
  lastOpenedAt: number;
  /** 'creator' if this device created the board. */
  role: 'creator' | 'member';
}

/** The toggles in the settings sheet. All local to this device. */
export interface AppSettings {
  /** Dot grid under the drawing. */
  grid: boolean;
  /** Show other participants' cursors. */
  peers: boolean;
  /** Curve-fit freehand strokes instead of joining raw points. */
  smooth: boolean;
  /** Haptic tick when a tool or option is picked. */
  haptics: boolean;
}

interface SessionState {
  userId: string;
  nickname: string;
  /** Preferred presence colour; the server may still assign a different one. */
  nickColor: string;
  /** Presence icon; its colour is `nickColor`. */
  avatar: string;
  lang: Lang;
  /** Light board or dark board; light unless chosen otherwise. */
  theme: Theme;
  settings: AppSettings;
  recent: RecentBoard[];
  /** PINs this device chose, by board id. */
  pins: Record<string, string>;
  /** True once AsyncStorage has been read back. */
  hydrated: boolean;

  setNickname(nickname: string): void;
  setAvatar(avatar: string): void;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
  setLang(lang: Lang): void;
  toggleLang(): void;
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  rememberBoard(board: Omit<RecentBoard, 'lastOpenedAt'>): void;
  forgetBoard(id: string): void;
  rememberPin(boardId: string, pin: string | null): void;
}

/**
 * AsyncStorage reaches for `window` the moment it is touched, and Expo Router's
 * static web rendering evaluates this module in Node, where there is none. On
 * that one pass the store runs unpersisted — there is no device to remember
 * anything for, and the real values load again in the browser.
 */
function storageBackend(): typeof AsyncStorage {
  if (typeof window !== 'undefined') return AsyncStorage;
  const noop = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
  return noop as unknown as typeof AsyncStorage;
}

export const DEFAULT_SETTINGS: AppSettings = {
  grid: true,
  peers: true,
  smooth: true,
  haptics: false,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      userId: newUserId(),
      nickname: '',
      nickColor: Avatars[0].color,
      avatar: Avatars[0].icon,
      lang: 'es',
      theme: 'light',
      settings: DEFAULT_SETTINGS,
      recent: [],
      pins: {},
      hydrated: false,

      setNickname(nickname) {
        set({ nickname: nickname.trim().slice(0, LIMITS.maxNicknameLength) });
      },

      /** The icon brings its colour along: one choice, not two. */
      setAvatar(avatar) {
        set({ avatar, nickColor: avatarColor(avatar) });
      },

      setLang(lang) {
        set({ lang });
      },

      toggleLang() {
        set((s) => ({ lang: s.lang === 'es' ? 'en' : 'es' }));
      },

      setTheme(theme) {
        set({ theme });
      },

      toggleTheme() {
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }));
      },

      setSetting(key, value) {
        set((s) => ({ settings: { ...s.settings, [key]: value } }));
      },

      rememberBoard(board) {
        set((s) => {
          const rest = s.recent.filter((b) => b.id !== board.id);
          return {
            recent: [{ ...board, lastOpenedAt: Date.now() }, ...rest].slice(0, 12),
          };
        });
      },

      forgetBoard(id) {
        set((s) => {
          const { [id]: _removed, ...pins } = s.pins;
          return { recent: s.recent.filter((b) => b.id !== id), pins };
        });
      },

      rememberPin(boardId, pin) {
        set((s) => {
          if (pin === null) {
            const { [boardId]: _removed, ...pins } = s.pins;
            return { pins };
          }
          return { pins: { ...s.pins, [boardId]: pin } };
        });
      },
    }),
    {
      name: 'shareboard.session',
      storage: createJSONStorage(() => storageBackend()),
      partialize: (s) => ({
        userId: s.userId,
        nickname: s.nickname,
        nickColor: s.nickColor,
        avatar: s.avatar,
        lang: s.lang,
        theme: s.theme,
        settings: s.settings,
        recent: s.recent,
        pins: s.pins,
      }),
      // Older installs have no `settings`/`lang` key; merge over the defaults so
      // a new toggle does not come back `undefined` and render as "off".
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionState>;
        const avatar = saved.avatar || Avatars[0].icon;
        return {
          ...current,
          ...saved,
          avatar,
          nickColor: avatarColor(avatar),
          theme: saved.theme === 'dark' ? 'dark' : 'light',
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        };
      },
      onRehydrateStorage: () => () => {
        // Nobody is asked their name before they can draw: until they pick one
        // in Settings, a guest name stands in (the identity screen is left for
        // a clash with someone's name on the board).
        const { nickname, lang } = useSessionStore.getState();
        useSessionStore.setState({
          hydrated: true,
          ...(nickname
            ? null
            : { nickname: `${lang === 'es' ? 'Invitado' : 'Guest'} ${1000 + Math.floor(Math.random() * 9000)}` }),
        });
      },
    },
  ),
);

/**
 * The palette in use. A zustand hook rather than context so it works inside a
 * Skia canvas too, whose children render in their own React root and never see
 * the app tree's providers.
 */
export const useColors = (): Palette => Palettes[useSessionStore((s) => s.theme)];

/** Whether the dark board is on. */
export const useDark = (): boolean => useSessionStore((s) => s.theme === 'dark');
