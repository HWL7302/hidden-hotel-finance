import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const nextCacheDir = join(projectRoot, ".next");
const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

rmSync(nextCacheDir, { force: true, recursive: true });

const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
