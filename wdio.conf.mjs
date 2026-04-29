import path from "node:path";
import { obsidianBetaAvailable } from "wdio-obsidian-service";

const rootDir = path.resolve(".");
const cacheDir = path.join(rootDir, ".obsidian-cache");
const vaultPath = path.join(rootDir, "test", "vaults", "rollover");

const capabilities = [];

capabilities.push({
  browserName: "obsidian",
  browserVersion: "1.11.5",
  "wdio:obsidianOptions": {
    cacheDir,
    installerVersion: "latest",
    plugins: [rootDir],
    vault: vaultPath,
  },
});

const includeCatalyst = process.env.OBSIDIAN_CATALYST === "1";
if (includeCatalyst && (await obsidianBetaAvailable(cacheDir))) {
  capabilities.push({
    browserName: "obsidian",
    browserVersion: "latest-beta",
    "wdio:obsidianOptions": {
      cacheDir,
      installerVersion: "latest",
      plugins: [rootDir],
      vault: vaultPath,
    },
  });
}

export const config = {
  runner: "local",
  specs: ["./test/specs/**/*.e2e.js"],
  maxInstances: 1,
  capabilities,
  logLevel: "info",
  services: ["obsidian"],
  reporters: ["spec", "obsidian"],
  framework: "mocha",
  mochaOpts: {
    timeout: 120000,
  },
};
