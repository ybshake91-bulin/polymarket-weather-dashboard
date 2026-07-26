import { cpSync, existsSync, rmSync } from "node:fs";

if (!existsSync("out")) {
  throw new Error("Next.js static export directory 'out' was not created");
}

rmSync("dist", { recursive: true, force: true });
cpSync("out", "dist", { recursive: true });
cpSync("server", "dist/server", { recursive: true });
cpSync(".openai", "dist/.openai", { recursive: true });
