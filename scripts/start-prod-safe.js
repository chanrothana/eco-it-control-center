#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const buildIndex = path.join(projectRoot, "build", "index.html");
const serverEntry = path.join(projectRoot, "server", "server.js");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`[start:prod] Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

if (!fs.existsSync(buildIndex)) {
  console.warn("[start:prod] Frontend build is missing. Running npm run build before starting the server.");
  run("npm", ["run", "build"]);
}

run("node", [serverEntry]);
