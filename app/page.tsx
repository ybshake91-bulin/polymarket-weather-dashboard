type CityStatus = "live" | "skip" | "waiting";

type City = {
  key: string;
  name: string;
  code: string;
  date: string;
  status: CityStatus;
  badge: string;
  core: string;
  pair: string;
  model: number;
  cityRate: number;
  decision: number;
  cost: number;
  edge: number;
  blocker: string;
  exposure?: number;
  positions?: string[];
};

const cities: City[] = [
  {
    key: "Milan",
    name: "米兰",
    code: "MILAN · LIMC",
    date: "2026-07-27",
    status: "skip",
    badge: "跳过",
    core: "33°C",
    pair: "33°C + 34°C Yes",
    model: 74.0,
    cityRate: 78.0,
    decision: 75.4,
    cost: 81.1,
    edge: -5.7,
    blocker: "综合概率低于保守成交成本",
  },
  {
    key: "Singapore",
    name: "新加坡",
    code: "SINGAPORE · WSSS",
    date: "2026-07-27",
    status: "live",
    badge: "真实持仓",
    core: "30°C",
    pair: "29°C + 30°C Yes",
    model: 63.8,
    cityRate: 72.0,
    decision: 66.6,
    cost: 35.6,
    edge: 31.0,
    blocker: "无",
    exposure: 4.8,
    positions: ["29°C Yes · 19.7428 股 · 1.19U", "30°C Yes · 16.4090 股 · 3.61U"],
  },
  {
    key: "Wellington",
    name: "惠灵顿",
    code: "WELLINGTON · NZWN",
    date: "2026-07-28",
    status: "waiting",
    badge: "等待",
    core: "12°C",
    pair: "11°C + 12°C Yes",
    model: 77.9,
    cityRate: 84.0,
    decision: 80.0,
    cost: 84.9,
    edge: -4.9,
    blocker: "尚未到 D-1 12:00；当前成本后边际为负",
  },
];

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "good" | "bad" }) {
  return (
    <div className={`metric ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CityCard({ city }: { city: City }) {
  return (
    <article className={`card ${city.status}`} data-city={city.key}>
      <div className="cardTop">
        <div>
          <p className="eyebrow">{city.code}</p>
          <h2>{city.name}</h2>
        </div>
        <span className="badge" data-field="badge">{city.badge}</span>
      </div>

      <div className="contract">
        <span>合约日</span>
        <b data-field="date">{city.date}</b>
        <i />
        <span data-field="preview">实时主合约</span>
        <b>上限 9U</b>
      </div>

      <div className="selection">
        <div>
          <span>核心档</span>
          <strong data-field="core">{city.core}</strong>
        </div>
        <div>
          <span>双档组合</span>
          <strong data-field="pair">{city.pair}</strong>
        </div>
      </div>

      <div className="metrics">
        <div className="metric"><strong data-field="model">{city.model.toFixed(1)}%</strong><span>模型双档概率</span></div>
        <div className="metric"><strong data-field="cityRate">{city.cityRate.toFixed(1)}%</strong><span>城市收缩命中率</span></div>
        <div className="metric"><strong data-field="decision">{city.decision.toFixed(1)}%</strong><span>综合决策概率</span></div>
        <div className="metric"><strong data-field="cost">{city.cost.toFixed(1)}%</strong><span>保守成交成本</span></div>
        <div className={`metric ${city.edge > 0 ? "good" : "bad"}`} data-role="edgeMetric"><strong data-field="edge">{city.edge > 0 ? "+" : ""}{city.edge.toFixed(1)}%</strong><span>成本后边际</span></div>
        <Metric label="每城总敞口" value="≤ 30U" />
      </div>

      <div className="position" data-field="position" hidden={city.status !== "live"}>
          <div className="positionTitle">
            <span className="pulse" />
            <b>账户已成交</b>
            <strong data-field="exposure">{city.exposure?.toFixed(2) ?? "0.00"}U</strong>
          </div>
          <div data-field="positions">
            {city.positions?.map((position) => <p key={position}>{position}</p>)}
          </div>
      </div>

      <div className="blocker">
        <span>决策说明</span>
        <p data-field="blocker">{city.blocker}</p>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <main>
      <header>
        <div className="brand">
          <div className="mark">W</div>
          <div>
            <p>POLYMARKET WEATHER</p>
            <h1>天气交易系统 <em>v2</em></h1>
          </div>
        </div>
        <div className="snapshot">
          <span className="dot" />
          <span id="feedState">实时数据连接中</span>
          <b id="lastUpdated">—</b>
        </div>
      </header>

      <section className="summary">
        <div>
          <p className="eyebrow">LIVE DECISION MONITOR</p>
          <h3>三城天气策略总览</h3>
          <p>核心温度由天气模型确定；第二档综合城市历史命中率、方向信号和实时成交成本。</p>
        </div>
        <div className="summaryStats">
          <div><strong id="liveCount">1</strong><span>真实持仓</span></div>
          <div><strong id="skipCount">2</strong><span>当前跳过</span></div>
          <div><strong id="totalExposure">4.80U</strong><span>组合敞口</span></div>
        </div>
      </section>

      <div className="notice">
        <b>执行边界</b>
        <span>初始盘实仓已启用；动态减仓与换档仍在影子验证。页面每 30 秒读取脱敏后台状态，不提供交易操作。</span>
      </div>

      <section className="grid">
        {cities.map((city) => <CityCard key={city.name} city={city} />)}
      </section>

      <footer>
        <span>数据来源：天气模型、Polymarket 订单簿与账户持仓</span>
        <span>风险控制：每城 30U · 组合 90U · 两档 Yes 策略</span>
      </footer>
    </main>
  );
}
