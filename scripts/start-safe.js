#!/usr/bin/env node

const { spawn, spawnSync } = require("child_process");
const path = require("path");

const PORTS = [3000, 4000];
const isPhoneMode = process.argv.includes("--phone");
const apiHost = isPhoneMode ? "0.0.0.0" : "127.0.0.1";
const webHost = isPhoneMode ? "0.0.0.0" : "";
const children = [];
let shuttingDown = false;

function inspectPort(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  const lines = result.stdout.trim().split("\n").slice(1);
  return lines
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ command: parts[0], pid: parts[1] }));
}

function printBusyPorts(busyPorts) {
  console.error("\n[preflight] Cannot start app because required ports are already in use.\n");

  for (const { port, processes } of busyPorts) {
    const detail = processes.map((p) => `${p.command}(pid:${p.pid})`).join(", ");
    console.error(`- Port ${port}: ${detail}`);
  }

  const pids = [...new Set(busyPorts.flatMap((entry) => entry.processes.map((p) => p.pid)))];
  if (pids.length) {
    console.error("\nFix:");
    console.error(`1) Stop the process(es): kill ${pids.join(" ")}`);
    console.error("2) Then run: npm start\n");
  }
}

function killChildrenAndExit(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 120);
}

function attachChildLifecycle(child, label) {
  children.push(child);
  child.on("error", (err) => {
    console.error(`[runner] ${label} failed: ${err.message}`);
    killChildrenAndExit(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 || signal === "SIGTERM" || signal === "SIGINT") {
      killChildrenAndExit(code || 0);
      return;
    }
    console.error(`[runner] ${label} exited unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
    killChildrenAndExit(1);
  });
}

function runStartRunner() {
  console.log("[preflight] Ports 3000 and 4000 are free.");
  console.log(`[preflight] Starting app (${isPhoneMode ? "phone/network" : "local"})...\n`);

  const apiChild = spawn("node", [path.join("server", "server.js")], {
    stdio: "inherit",
    env: { ...process.env, API_HOST: apiHost },
    shell: process.platform === "win32",
  });
  attachChildLifecycle(apiChild, "API server");

  const webCmd = process.platform === "win32"
    ? path.join("node_modules", ".bin", "react-scripts.cmd")
    : path.join("node_modules", ".bin", "react-scripts");
  const webChild = spawn(webCmd, ["start"], {
    stdio: "inherit",
    env: { ...process.env, ...(webHost ? { HOST: webHost } : {}) },
    shell: process.platform === "win32",
  });
  attachChildLifecycle(webChild, "Web server");
}

process.on("SIGINT", () => killChildrenAndExit(0));
process.on("SIGTERM", () => killChildrenAndExit(0));

const busyPorts = PORTS.map((port) => ({ port, processes: inspectPort(port) })).filter(
  (entry) => entry.processes.length > 0
);

if (busyPorts.length) {
  printBusyPorts(busyPorts);
  process.exit(1);
}

runStartRunner();
