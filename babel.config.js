/**
 * Babel config for Live Whiteboard (mobile).
 *
 * - `jsxImportSource: "nativewind"` + the `nativewind/babel` preset enable the
 *   `className` prop across the app (NativeWind v4).
 * - `babel-preset-expo` automatically appends `react-native-worklets/plugin`
 *   (Reanimated 4) when `react-native-worklets` is installed, so it is not
 *   listed here on purpose. See node_modules/babel-preset-expo/build/configs/expo.js.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
