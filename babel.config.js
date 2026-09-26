/**
 * Babel config for Live Whiteboard (mobile).
 *
 * NativeWind is deliberately *not* wired in. The app styles everything with
 * plain style props (there is no `className` anywhere), and NativeWind's JSX
 * runtime (react-native-css-interop 0.2.x) replaces a `Pressable` style
 * *function* with an empty object — every `Button` and `IconButton` lost its
 * background, padding and alignment on device.
 *
 * `babel-preset-expo` automatically appends `react-native-worklets/plugin`
 * (Reanimated 4) when `react-native-worklets` is installed, so it is not
 * listed here on purpose. See node_modules/babel-preset-expo/build/configs/expo.js.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
