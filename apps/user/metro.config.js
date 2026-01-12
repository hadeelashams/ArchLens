const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the local app, the root node_modules, and the shared package
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, 'packages/shared')
];

// 2. Let Metro know where to find packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force resolution of the shared package
config.resolver.extraNodeModules = {
  '@archlens/shared': path.resolve(workspaceRoot, 'packages/shared'),
};

module.exports = config;