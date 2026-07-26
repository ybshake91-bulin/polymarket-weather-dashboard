type CityStatus = "live" | "skip" | "waiting";

type City = {
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
    <article className={`card ${city.status}`}>
      <div className="cardTop">
        <div>
          <p className="eyebrow">{city.code}</p>
          <h2>{city.name}</h2>
        </div>
        <span className="badge">{city.badge}</span>
      </div>

      <div className="contract">
        <span>合约日</span>
        <b>{city.date}</b>
        <i />
        <span>初盘阶段</span>
        <b>上限 9U</b>
      </div>

      <div className="selection">
        <div>
          <span>核心档</span>
          <strong>{city.core}</strong>
        </div>
        <div>
          <span>双档组合</span>
          <strong>{city.pair}</strong>
        </div>
      </div>

      <div className="metrics">
        <Metric label="模型双档概率" value={`${city.model.toFixed(1)}%`} />
        <Metric label="城市收缩命中率" value={`${city.cityRate.toFixed(1)}%`} />
        <Metric label="综合决策概率" value={`${city.decision.toFixed(1)}%`} />
        <Metric label="保守成交成本" value={`${city.cost.toFixed(1)}%`} />
        <Metric label="成本后边际" value={`${city.edge > 0 ? "+" : ""}${city.edge.toFixed(1)}%`} tone={city.edge > 0 ? "good" : "bad"} />
        <Metric label="每城总敞口" value="≤ 30U" />
      </div>

      {city.status === "live" && (
        <div className="position">
          <div className="positionTitle">
            <span className="pulse" />
            <b>账户已成交</b>
            <strong>{city.exposure?.toFixed(2)}U</strong>
          </div>
          {city.positions?.map((position) => <p key={position}>{position}</p>)}
        </div>
      )}

      <div className="blocker">
        <span>决策说明</span>
        <p>{city.blocker}</p>
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
          已发布快照
          <b>2026-07-27 01:23 CST</b>
        </div>
      </header>

      <section className="summary">
        <div>
          <p className="eyebrow">LIVE DECISION MONITOR</p>
          <h3>三城天气策略总览</h3>
          <p>核心温度由天气模型确定；第二档综合城市历史命中率、方向信号和实时成交成本。</p>
        </div>
        <div className="summaryStats">
          <div><strong>1</strong><span>真实持仓</span></div>
          <div><strong>2</strong><span>当前跳过</span></div>
          <div><strong>4.80U</strong><span>组合敞口</span></div>
        </div>
      </section>

      <div className="notice">
        <b>执行边界</b>
        <span>初始盘实仓已启用；动态减仓与换档仍在影子验证。页面仅展示监控结果，不提供交易操作。</span>
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
