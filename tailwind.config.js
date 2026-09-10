/** @type {import('tailwindcss').Config} */
// Design tokens for Shareboard. This file is the single source of truth for the
// UI palette and is meant to be copied verbatim into the React web app.
// See docs/03-styles for the rationale behind every token.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The design is light-only: frosted white panels over a soft ambient wash.
  // There is no dark palette to pair against, so no `dark:` variants are used,
  // and `class` keeps NativeWind from binding the scheme to the OS setting —
  // with `media` it refuses the explicit light scheme app.json pins.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- UI surfaces (kept deliberately restrained: board content is the star) ---
        background: '#FFFFFF',
        surface: '#F5F6F8',
        'surface-selected': '#EEF0F6',
        text: '#1B2030',
        'text-secondary': '#5A6170',
        'text-tertiary': '#8B909C',

        // --- Brand / intent (one accent does active tool, CTA and selection) ---
        accent: '#6D3FB5',
        'accent-deep': '#3C42AD',
        'accent-soft': 'rgba(109,63,181,0.11)',
        danger: '#C4353A',
        'danger-bright': '#E5484D',
        warn: '#B4530A',

        // --- Glass ---
        glass: 'rgba(255,255,255,0.46)',
        'glass-solid': 'rgba(255,255,255,0.62)',
        line: 'rgba(27,32,48,0.10)',
        'line-strong': 'rgba(27,32,48,0.14)',

        // --- Connection status badges ---
        status: {
          online: '#0F9E8E',
          connecting: '#F59E0B',
          offline: '#9AA0A6',
        },
      },
      // Only two family utilities: `font-sans` and `font-mono`. Weight is not a
      // family in Tailwind's model but *is* a separate file for a loaded font,
      // so weights go through the `<Text weight>` component instead — naming
      // families "bold"/"medium" here would collide with the font-weight
      // utilities of the same name.
      fontFamily: {
        sans: ['Nunito_400Regular'],
        mono: ['JetBrainsMono_500Medium'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '26px',
      },
    },
  },
  plugins: [],
};
