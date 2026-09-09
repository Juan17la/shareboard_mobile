// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'example/*'],
  },
  {
    // The React Compiler-era hooks rules (v6 RC) are still experimental and
    // flag several legitimate patterns we rely on: mutating a Reanimated shared
    // value inside a gesture callback, and driving async connection phase from
    // an effect. Keep them as hints rather than hard errors.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
