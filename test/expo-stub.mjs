/**
 * Loaded before the node checks: the socket module reaches `expo-constants`
 * through `@/constants/config`, the store reaches `expo-crypto` through
 * `@/utils/id`, and both packages need a native runtime. tsx loads this project's `.ts` files as CommonJS, so the
 * require resolver is where the swap goes.
 */
import Module from 'node:module';

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'expo-constants') return new URL('./expo-constants.stub.cjs', import.meta.url).pathname;
  if (request === 'expo-crypto') return new URL('./expo-crypto.stub.cjs', import.meta.url).pathname;
  return resolve.call(this, request, ...rest);
};
