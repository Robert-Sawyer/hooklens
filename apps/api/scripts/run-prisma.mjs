import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const prismaCli = resolve(
  scriptDirectory,
  "../node_modules/prisma/build/index.js",
);
const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
