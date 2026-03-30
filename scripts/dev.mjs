import net from "node:net";
import { execSync, spawn } from "node:child_process";

function isPortBusy(port, host = "127.0.0.1") {
  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano -p tcp", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      return output
        .split(/\r?\n/)
        .some((line) => line.includes(`:${port}`) && line.toUpperCase().includes("LISTENING"));
    } catch {
      return false;
    }
  }

  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(true);
        return;
      }
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port, host);
  });
}

function spawnCommand(command, args) {
  if (process.platform === "win32") {
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command, ...args], {
      stdio: "inherit",
      env: process.env,
    });
  }

  return spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

const backendAlreadyRunning = await isPortBusy(3001);
let serverProcess = null;

if (backendAlreadyRunning) {
  console.log("[dev] Port 3001 is already in use by another process. Keeping the existing backend and starting the client only.");
} else {
  serverProcess = spawnCommand("npm", ["run", "dev:server"]);
}

const clientProcess = spawnCommand("npm", ["run", "dev:client"]);

const shutdown = () => {
  if (!clientProcess.killed) {
    clientProcess.kill();
  }
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

clientProcess.on("exit", (code) => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  process.exit(code ?? 0);
});

if (serverProcess) {
  serverProcess.on("exit", async (code) => {
    if ((code ?? 0) !== 0) {
      const portBusyAfterExit = await isPortBusy(3001);
      if (portBusyAfterExit) {
        console.log("[dev] A backend is already active on port 3001. Leaving the client running.");
        return;
      }
    }

    if (!clientProcess.killed) {
      clientProcess.kill();
    }
    process.exit(code ?? 0);
  });
}
