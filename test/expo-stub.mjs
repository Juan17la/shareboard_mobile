/**
 * Loaded before `test/socket-lifecycle.mjs`: the socket module reaches
 * `expo-constants` through `@/constants/config`, and that package needs a
 * native runtime. tsx loads this project's `.ts` files as CommonJS, so the
 * require resolver is where the swap goes.
 */
import Module from 'node:module';

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'expo-constants') return new URL('./expo-constants.stub.cjs', import.meta.url).pathname;
  return resolve.call(this, request, ...rest);
};
