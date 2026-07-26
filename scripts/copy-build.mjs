import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

if (!existsSync("out")) {
  throw new Error("Next.js static export directory 'out' was not created");
}

rmSync("dist", { recursive: true, force: true });
cpSync("out", "dist", { recursive: true });
cpSync(".openai", "dist/.openai", { recursive: true });

const sourceHtml = readFileSync("out/index.html", "utf8");

const inlinedHtml = sourceHtml
  .replace(
    /<link rel="stylesheet" href="([^"]+)"[^>]*\/>/g,
    (_match, href) => {
      const cssPath = join("out", href.replace(/^\//, ""));
      if (!existsSync(cssPath)) {
        throw new Error(`Referenced stylesheet was not found: ${cssPath}`);
      }
      return `<style>${readFileSync(cssPath, "utf8")}</style>`;
    },
  )
  .replace(/<link rel="preload"[^>]*as="script"[^>]*\/>/g, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .replace('<div hidden=""><!--$--><!--/$--></div>', "");

const workerSource = `const PAGE_HTML = ${JSON.stringify(inlinedHtml)};

const SECURITY_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=60",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not found", { status: 404 });
    }

    return new Response(request.method === "HEAD" ? null : PAGE_HTML, {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  },
};
`;

const workerPath = "dist/server/index.js";
mkdirSync(dirname(workerPath), { recursive: true });
writeFileSync(workerPath, workerSource, "utf8");

mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", inlinedHtml, "utf8");
writeFileSync("docs/.nojekyll", "", "utf8");
