#!/usr/bin/env node

const { spawn, spawnSync } = require("child_process");
const path = require("path");

const WEB_PORT = 3000;
const API_PORT = 4000;
const isPhoneMode = process.argv.includes("--phone");
// Local mode should stay loopback-only; phone mode exposes to LAN.
const apiHost = isPhoneMode ? "0.0.0.0" : "127.0.0.1";
const webHost = isPhoneMode ? "0.0.0.0" : "127.0.0.1";
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
  console.error("\n[preflight] Cannot start app because web port is already in use.\n");

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

function attachChildLifecycle(child, label, { fatalOnExit = true } = {}) {
  children.push(child);
  child.on("error", (err) => {
    if (fatalOnExit) {
      console.error(`[runner] ${label} failed: ${err.message}`);
      killChildrenAndExit(1);
      return;
    }
    console.warn(`[runner] ${label} failed: ${err.message}`);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const isClean = code === 0 || signal === "SIGTERM" || signal === "SIGINT";
    if (isClean) {
      if (!fatalOnExit) return;
      killChildrenAndExit(code || 0);
      return;
    }
    if (fatalOnExit) {
      console.error(`[runner] ${label} exited unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
      killChildrenAndExit(1);
      return;
    }
    console.warn(
      `[runner] ${label} exited unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`
    );
    console.warn("[runner] Web server will continue running, but API requests may fail.");
  });
}

function runStartRunner(isApiPortBusy) {
  if (isApiPortBusy) {
    console.warn(
      `[preflight] Port ${API_PORT} is already in use. Skipping API startup and continuing with web server.`
    );
  }
  console.log(`[preflight] Starting app (${isPhoneMode ? "phone/network" : "local"})...\n`);

  if (!isApiPortBusy) {
    const apiChild = spawn("node", [path.join("server", "server.js")], {
      stdio: "inherit",
      env: { ...process.env, ...(apiHost ? { API_HOST: apiHost } : {}) },
      shell: process.platform === "win32",
    });
    attachChildLifecycle(apiChild, "API server", { fatalOnExit: false });
  }

  const webCmd = process.platform === "win32"
    ? path.join("node_modules", ".bin", "react-scripts.cmd")
    : path.join("node_modules", ".bin", "react-scripts");
  const webEnv = { ...process.env, PORT: String(WEB_PORT) };
  webEnv.HOST = webHost;
  if (!isPhoneMode) {
    webEnv.DANGEROUSLY_DISABLE_HOST_CHECK = "true";
  }
  const webChild = spawn(webCmd, ["start"], {
    stdio: "inherit",
    env: webEnv,
    shell: process.platform === "win32",
  });
  attachChildLifecycle(webChild, "Web server", { fatalOnExit: true });
}

process.on("SIGINT", () => killChildrenAndExit(0));
process.on("SIGTERM", () => killChildrenAndExit(0));

const webPortProcesses = inspectPort(WEB_PORT);
if (webPortProcesses.length) {
  printBusyPorts([{ port: WEB_PORT, processes: webPortProcesses }]);
  process.exit(1);
}

const apiPortProcesses = inspectPort(API_PORT);
const isApiPortBusy = apiPortProcesses.length > 0;

runStartRunner(isApiPortBusy);
