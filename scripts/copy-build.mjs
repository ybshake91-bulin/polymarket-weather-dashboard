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

const liveFeedScript = `<script>
(() => {
  const feedUrl = "https://raw.githubusercontent.com/ybshake91-bulin/polymarket-weather-dashboard/live-data/status.json";
  const refUrl = "https://api.github.com/repos/ybshake91-bulin/polymarket-weather-dashboard/git/ref/heads/live-data";
  let latestAppliedAt = 0;
  const blockerText = {
    before_initial_d1_decision: "尚未到 D-1 12:00 初盘时间",
    market_closed_or_inactive: "市场已关闭或不可交易",
    selected_pair_not_fillable: "所选双档缺少可成交深度",
    decision_pair_probability_below_floor: "综合决策概率低于门槛",
    pair_price_above_ceiling: "双档成本超过上限",
    blended_edge_below_floor: "综合概率低于保守成交成本"
  };
  const field = (card, name) => card.querySelector('[data-field="' + name + '"]');
  const percent = (value, signed = false) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const result = (Number(value) * 100).toFixed(1) + "%";
    return signed && Number(value) > 0 ? "+" + result : result;
  };
  const setText = (card, name, value) => {
    const target = field(card, name);
    if (target) target.textContent = value ?? "—";
  };
  const applyCity = (city, data) => {
    const card = document.querySelector('[data-city="' + city + '"]');
    if (!card || !data) return;
    card.classList.remove("live", "skip", "waiting", "candidate");
    const visualStatus = data.status === "live" ? "live" : data.status === "candidate" ? "candidate" : data.status === "waiting" ? "waiting" : "skip";
    card.classList.add(visualStatus);
    setText(card, "badge", data.status === "live" ? "真实持仓" : data.status === "candidate" ? "候选" : data.status === "waiting" ? "等待" : "跳过");
    setText(card, "date", data.contract_date || "—");
    setText(card, "preview", data.preview_contract_date ? "预盘 " + data.preview_contract_date : "实时主合约");
    setText(card, "core", data.core_label || "—");
    setText(card, "pair", data.pair?.length ? data.pair.join(" + ") + " Yes" : "等待模型");
    setText(card, "model", percent(data.model_pair_probability));
    setText(card, "cityRate", percent(data.city_pair_hit_rate));
    setText(card, "decision", percent(data.decision_pair_probability));
    setText(card, "cost", percent(data.conservative_pair_cost));
    setText(card, "edge", percent(data.edge_after_cost, true));
    const edgeMetric = card.querySelector('[data-role="edgeMetric"]');
    if (edgeMetric) {
      edgeMetric.classList.toggle("good", Number(data.edge_after_cost) > 0);
      edgeMetric.classList.toggle("bad", Number(data.edge_after_cost) <= 0);
    }
    const blockers = (data.blockers || []).map(value => blockerText[value] || value);
    setText(card, "blocker", blockers.length ? blockers.join("；") : data.status === "live" ? "持仓已确认" : "无");
    const position = field(card, "position");
    const execution = data.execution;
    if (position) position.hidden = !execution;
    if (execution) {
      setText(card, "exposure", Number(execution.exposure || 0).toFixed(2) + "U");
      const positions = field(card, "positions");
      if (positions) {
        positions.replaceChildren(...(execution.positions || []).map(item => {
          const row = document.createElement("p");
          row.textContent = item.label + " " + item.side + " · " + Number(item.shares || 0).toFixed(4) + " 股 · " + Number(item.initial_value || 0).toFixed(2) + "U";
          return row;
        }));
      }
    }
  };
  const refresh = async (resolveLatest = false) => {
    const state = document.getElementById("feedState");
    try {
      let url = feedUrl + "?t=" + Date.now();
      if (resolveLatest) {
        const refResponse = await fetch(refUrl + "?t=" + Date.now(), { cache: "no-store" });
        if (refResponse.ok) {
          const ref = await refResponse.json();
          const sha = ref?.object?.sha;
          if (sha) {
            url = "https://raw.githubusercontent.com/ybshake91-bulin/polymarket-weather-dashboard/" + sha + "/status.json";
          }
        }
      }
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      if (payload.schema_version !== "weather_public_status/1.0") throw new Error("数据格式不匹配");
      const generatedAt = Date.parse(payload.generated_at) || 0;
      if (generatedAt < latestAppliedAt) return;
      latestAppliedAt = generatedAt;
      Object.entries(payload.cities || {}).forEach(([city, data]) => applyCity(city, data));
      const summary = payload.summary || {};
      document.getElementById("liveCount").textContent = String(summary.live_count ?? 0);
      document.getElementById("skipCount").textContent = String(summary.skip_count ?? 0);
      document.getElementById("totalExposure").textContent = Number(summary.exposure || 0).toFixed(2) + "U";
      const generated = new Date(payload.generated_at);
      document.getElementById("lastUpdated").textContent = generated.toLocaleString("zh-CN", { hour12: false });
      if (state) state.textContent = "实时数据已连接";
      document.body.dataset.feed = "connected";
    } catch (error) {
      if (state) state.textContent = "实时数据暂时中断";
      document.body.dataset.feed = "error";
    }
  };
  refresh(true);
  window.setInterval(refresh, 30000);
  window.setInterval(() => refresh(true), 300000);
})();
</script>`;

const pagesHtml = inlinedHtml.replace("</body>", `${liveFeedScript}</body>`);

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
writeFileSync("docs/index.html", pagesHtml, "utf8");
writeFileSync("docs/.nojekyll", "", "utf8");
