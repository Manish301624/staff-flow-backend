const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const singletons = [
  "@tanstack/react-query",
  "@tanstack/query-core",
  "react",
  "react-dom",
  "react-native",
];

config.resolver.extraNodeModules = singletons.reduce((acc, pkg) => {
  const resolved = path.resolve(projectRoot, "node_modules", pkg);
  acc[pkg] = resolved;
  return acc;
}, {});

module.exports = config;
