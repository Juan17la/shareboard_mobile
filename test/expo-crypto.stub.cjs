// `expo-crypto` needs the native runtime; node's crypto is the same API here.
const { randomUUID, getRandomValues } = require('node:crypto');
module.exports = { randomUUID, getRandomValues };
