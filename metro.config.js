// Learn more: https://docs.expo.dev/guides/customizing-metro/
// Monorepo setup: https://docs.expo.dev/guides/monorepos/
const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so edits in `packages/shared` trigger a rebuild.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from this app first, then from the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Only use the two paths above — never walk up the filesystem looking for
//    another node_modules. Prevents duplicate React copies in a workspace.
config.resolver.disableHierarchicalLookup = true;

// NativeWind: compile `src/global.css` (Tailwind) into the RN style system.
module.exports = withNativeWind(config, { input: './src/global.css' });
