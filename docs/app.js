const byId = id => document.getElementById(id);
let payload = null;
let selectedCityId = null;

const esc = value => String(value ?? "—").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const num = (value, digits = 0) => value == null ? "—" : Number(value).toLocaleString("zh-CN", {minimumFractionDigits: digits, maximumFractionDigits: digits});
const pct = value => value == null ? "—" : `${num(Number(value) * 100, 1)}%`;
const money = value => value == null ? "—" : `${Number(value) >= 0 ? "+" : ""}${num(value, 2)} U`;
const shortTime = value => value ? new Date(value).toLocaleTimeString("zh-CN", {hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false}) : "—";
const shortClock = value => value ? new Date(value).toLocaleTimeString("zh-CN", {hour:"2-digit", minute:"2-digit", hour12:false}) : "—";
const freshness = seconds => seconds == null ? "等待首条运行数据" : seconds < 60 ? `${seconds} 秒前更新` : seconds < 3600 ? `${Math.floor(seconds/60)} 分钟前更新` : `${Math.floor(seconds/3600)} 小时前更新`;
const statusClass = status => `status-${esc(status)}`;
const poolLabel = (status, explanation) => explanation?.label || ({COLLECT_FULL:"完整采集",COLLECT_LITE:"轻量采集",MODEL_ELIGIBLE:"模型合格",SHADOW_ELIGIBLE:"影子合格",FORMAL_ELIGIBLE:"正式推行",CASH_ELIGIBLE:"现金合格",BLOCKED_RULE:"规则阻断",BLOCKED_DATA:"数据阻断",BLOCKED_SKILL:"模型阻断",BLOCKED_LIQUIDITY:"流动性阻断",SUSPENDED_RISK:"风险暂停",UNIVERSE:"候选全集"}[status] || status);
const dispositionLabel = status => ({EXECUTE_NOW:"可立即执行",POST_MAKER:"可挂限价单",WAIT:"等待更新",SKIP:"暂不操作",HOLD:"持有观察",REDUCE:"减仓",EXIT:"退出",REBALANCE:"调仓",BLOCKED:"被硬性阻断"}[status] || status || "等待数据");
const windowStageLabel = stage => ({BEFORE_WATCH:"观察前",WATCHING:"观察中",DECISION_OPEN:"决策打开(非正式)",TARGET_WINDOW:"正式决策窗口",RISK_ONLY:"仅风控",CLOSED:"已关闭",BLOCKED:"阻断"}[stage] || stage || "未评估");
const blockerLabel = (code, explanation) => explanation?.label || ({DAILY_NEW_RISK_LIMIT:"今日新增风险额度已满",DAILY_PACKAGE_COUNT_LIMIT:"今日计划名额已满",CLIMATE_SUBCATEGORY_DAILY_PLAN_LIMIT:"气候子类当日计划已占用",TIMEZONE_GROUP_DAILY_PLAN_LIMIT:"主时区组当日名额已满",CITY_NOT_SHADOW_ELIGIBLE:"城市未获策略准入",CITY_BLOCKED_RULE:"城市规则禁止",WEATHER_DATA_STALE:"天气数据已过期",MARKET_BOOK_STALE:"盘口快照已过期",MARKET_BOOK_SEQUENCE_GAP:"盘口序列不连续",MARKET_BUCKET_MAPPING_MISMATCH:"合约档位映射异常",CONTRACT_RULES_UNVERIFIED:"合约规则未验证",VALUATION_INPUT_INVALID:"估值输入不合法",RISK_LIMIT_BLOCKED:"风险规则阻断",NO_POSITIVE_EXECUTABLE_ACTION:"没有可成交的正期望机会"}[code] || code || "无阻断");

function renderSummary(data) {
  const s = data.summary;
  const paperRisk = data.paperRisk || {};
  const maxPlans = paperRisk.globalUsage?.maxPlans ?? "—";
  const rosters = paperRisk.slotRosters || [];
  const occupied = rosters.flatMap(group => group.slots || []).filter(slot => slot.state === "OCCUPIED").length;
  byId("metricCities").textContent = num(s.cities);
  // 副标题按实际非零城市池分布展示，保证各池加总 = 治理城市总数；
  // 不能只写死 完整/轻量/阻断 三类，否则会漏掉 影子准入 等当前主池。
  const poolParts = Object.entries(data.pools || {})
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([status, count]) => `${poolLabel(status)} ${num(count)}`);
  byId("metricPools").textContent = poolParts.length ? poolParts.join(" · ") : "等待城市注册表";
  byId("metricDecisions").textContent = num(s.todayDecisions);
  // 策略通过 = 今日所有评估中曾通过策略的唯一城市/合约数（累计口径，与漏斗一致）。
  byId("metricQualified").textContent = `策略通过 ${s.strategyQualified}（今日累计）· 影子授权 ${s.executionAuthorized}`;
  // 当前占用计划、标准纸面决策名额、可执行订单统一使用台账占用投影。
  // plannedOrders 仅保留给“今日生成计划（累计）”漏斗使用。
  byId("metricPlans").textContent = num(s.occupiedPlans ?? occupied);
  byId("metricAuthorized").textContent = `已占名额 ${occupied} / ${maxPlans}${s.executionAuthorized ? ` · 影子授权 ${s.executionAuthorized}` : ""}`;
  byId("metricFillRate").textContent = pct(s.fillRate);
  byId("metricFilled").textContent = `成交 ${s.filledOrders} / 提交 ${s.submittedOrders}`;
  byId("metricRisk").textContent = money(s.openRiskU);
  byId("metricStake").textContent = `今日成交额 ${num(s.filledStakeU, 2)} U`;
  byId("metricPnl").textContent = money(s.realizedPnlU);
  byId("metricPnl").className = Number(s.realizedPnlU) > 0 ? "positive" : Number(s.realizedPnlU) < 0 ? "negative" : "";
  // 预期已实现 PnL：按完整成交率折算的纸面计划期望收益，与真实成交口径
  // 分开展示，避免把建模收益冒充为真实账户回报。
  if (s.expectedRealizedPnlU != null && Number(s.expectedRealizedPnlU) !== 0) {
    const expected = Number(s.expectedRealizedPnlU);
    byId("metricPnl").textContent = `${money(s.realizedPnlU)}（预期 ${money(expected)}）`;
  }
  byId("businessDate").textContent = `业务日期 / ${data.businessDate}`;
  byId("modePill").textContent = data.health.mode;
  byId("livePill").textContent = data.health.liveEnabled ? "影子运行 · 实盘开启" : "影子运行 · 实盘关闭";
  const pipeline = data.health.pipeline || {};
  const pipelineText = pipeline.status && pipeline.status !== "OK" ? ` · 数据链路 ${pipeline.status}${pipeline.error?.code ? ` (${pipeline.error.code})` : ""}` : "";
  byId("healthLabel").textContent = `${data.health.status}${pipelineText}`;
  byId("freshness").textContent = freshness(data.health.freshnessSeconds);
  byId("systemState").classList.toggle("online", data.health.status === "ONLINE");
  byId("generatedAt").textContent = `SNAPSHOT ${new Date(data.generatedAt).toLocaleString("zh-CN", {hour12:false})}`;
}

function renderAlerts(alerts) {
  byId("alerts").innerHTML = alerts.map(a => `<div class="alert ${esc(a.level)}"><b>${esc(a.code)}</b><span>${esc(a.message)}</span></div>`).join("");
}

function compactId(value) {
  const text = String(value || "—");
  return text.length > 20 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text;
}

function renderReservedPlans(plans, paperRisk, decisions = payload?.decisions || []) {
  const maximum = paperRisk?.globalUsage?.maxPlans;
  const rosters = paperRisk?.slotRosters || [];
  const occupied = rosters.flatMap(group => group.slots || []).filter(slot => slot.state === "OCCUPIED").length;
  const plansById = new Map((plans || []).map(plan => [plan.planId, plan]));
  byId("slotUsage").textContent = `${num(occupied)} / ${num(maximum)} 个名额已占用 · 按合约本地日期分组 · 每主时区组默认 1 个名额（东亚 2 个）`;
  byId("reservedPlanGrid").innerHTML = rosters.map(group => `<section class="slot-date-group">
    <h3>合约日 ${esc(group.contractDate)} <small>${(group.slots || []).filter(s => s.state === "OCCUPIED").length} / ${num(maximum)}</small></h3>
    <div class="slot-grid">${(group.slots || []).map(slot => {
      const r = slot.reservation;
      const plan = r ? plansById.get(r.planId) : null;
      const decision = r ? decisions.find(d => d.decisionId === r.decisionId) : null;
      const window = decision?.decisionWindow || {};
      const labels = (plan?.labels || decision?.labels || []).join(" + ") || "档位待同步";
      const action = plan?.strategyAction || decision?.strategyAction || "策略待同步";
      return `<article class="slot-card ${r ? "occupied" : "empty"}">
        <div class="slot-card-head">
          <div class="slot-number">${num(slot.order)}</div>
          <div class="slot-title"><b>${esc(slot.displayName)}</b><small>${esc(slot.slotType)} · 参考 ${num(slot.referenceStakeU)}U</small></div>
          <span class="status-badge ${r ? "status-SHADOW_ELIGIBLE" : ""}">${r ? "已分配" : "未分配"}</span>
        </div>
        ${r ? `<div class="slot-main">
            <strong>${esc(r.cityId)}</strong>
            ${r.stillQualified ? `<span class="still-badge">策略仍有效</span>` : ""}
            <div class="slot-target" title="${esc(labels)}">${esc(labels)}</div>
            <small>${esc(action)} · 合约日 ${esc(r.contractDate)}</small>
          </div>
          <div class="slot-stats"><div><small>计划仓位</small><b>${num(r.requestedStakeU,2)}U</b></div><div><small>实际风险</small><b>${num(r.worstCaseRiskU,2)}U</b></div>${r.expectedFillRatio != null ? `<div><small>预期成交率</small><b>${pct(r.expectedFillRatio)}</b></div>` : ""}</div>
          <div class="slot-ids"><small title="${esc(r.decisionId)}">决策 ${esc(compactId(r.decisionId))}</small><small title="${esc(r.planId)}">计划 ${esc(compactId(r.planId))}</small>${window.stage ? `<small>窗口 ${esc(window.stage)} / ${esc(window.status || "—")}</small>` : ""}</div>` : `<div class="slot-main"><strong>空闲</strong><small>等待符合既有策略与风控的计划</small></div>`}
      </article>`;
    }).join("")}</div>
  </section>`).join("") || `<div class="empty-detail slot-empty"><p>等待名额目录</p></div>`;
}

function renderFunnel(funnel) {
  const steps = [
    ["决策重估(今日唯一)", funnel.decisionEvents, "按城市、合约日、合约去重的今日评估"],
    ["策略通过(累计)", funnel.strategyQualified, "今日任一轮评估曾满足策略条件"],
    ["生成计划(累计)", funnel.planned, "今日曾生成带计划编号的执行计划"],
    ["提交执行", funnel.submitted, "同一批当日计划已进入提交状态或提交后的终态；预检和纸面预留不算提交"],
    ["完整成交（全腿）", funnel.filled, "订单包所有腿完成成交（FILLED_ALL）或其确认、结算后继态；部分成交不计入"],
  ];
  byId("funnel").innerHTML = steps.map((step, index) => {
    const base = index ? Number(steps[index-1][1]) : Number(step[1]);
    const rate = index ? (base ? Number(step[1]) / base : 0) : 1;
    return `<div class="funnel-step" title="${esc(step[2])}"><span>${esc(step[0])}</span><strong>${num(step[1])}</strong><small>${index ? `阶段转化 ${pct(rate)}` : "有效重估事件"}</small></div>`;
  }).join("");
}

function renderPools(pools) {
  const entries = Object.entries(pools);
  const max = Math.max(1, ...entries.map(([,count]) => Number(count)));
  byId("poolTotal").textContent = `${entries.reduce((sum,[,count]) => sum + Number(count), 0)} CITY REGISTRY`;
  byId("poolBars").innerHTML = entries.map(([status,count]) => `<div class="bar-row"><span>${esc(poolLabel(status))}</span><div class="bar-track"><div class="bar-fill" style="width:${Number(count)/max*100}%"></div></div><b>${num(count)}</b></div>`).join("");
  const select = byId("poolFilter");
  const selected = select.value;
  select.innerHTML = `<option value="ALL">全部城市池</option>` + entries.map(([status]) => `<option value="${esc(status)}">${esc(poolLabel(status))}</option>`).join("");
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
  // 主时区组筛选：从城市数据动态收集唯一组，保留当前选中值
  const tzSelect = byId("tzFilter");
  const tzSelected = tzSelect.value;
  const tzGroups = [...new Set((payload.cities || []).map(c => c.timezoneGroup || c.correlationGroup || "").filter(Boolean))].sort();
  tzSelect.innerHTML = `<option value="ALL">全部主时区组</option>` + tzGroups.map(group => `<option value="${esc(group)}">${esc((payload.cities.find(c => (c.timezoneGroup || c.correlationGroup) === group) || {}).timezoneGroupLabel || group)}</option>`).join("");
  if ([...tzSelect.options].some(option => option.value === tzSelected)) tzSelect.value = tzSelected;
}

function cityRows() {
  const query = byId("citySearch").value.trim().toLowerCase();
  const pool = byId("poolFilter").value;
  const tz = byId("tzFilter").value;
  return payload.cities.filter(city => {
    const tzGroup = city.timezoneGroup || city.correlationGroup || "";
    const text = `${city.name} ${city.cityId} ${city.station || ""} ${tzGroup}`.toLowerCase();
    return (!query || text.includes(query)) && (pool === "ALL" || city.poolStatus === pool) && (tz === "ALL" || tzGroup === tz);
  }).sort(compareCityWindowOrder);
}

// 按当地决策窗口的“绝对时刻”由东向西排列：惠灵顿最早，其后亚洲、欧洲、美洲，无窗口的香港最后。
//
// 不能直接对 window.targetStartLocal 排序：它是“最新一条评估”的窗口，而引擎每 tick
// 会滚出 今天/明天/后天 三条前瞻决策，最新那条往往是后天，导致同一时刻的城市
// 有的停在今天、有的跳到后天，顺序被完全打乱（所有城市本地时分都是 10:45，
// 字符串比较实际只比 UTC 偏移）。
//
// 正确做法：用城市当前本地时间（window.nowLocal 提供城市自身时区）把窗口
// 归一到“城市当地今天”，再取当天的 10:45 转绝对时刻比较。
function cityWindowSortKey(city) {
  const startClock = cityLocalWallClock(city.window?.targetStartLocal);
  const nowIso = city.window?.nowLocal;
  const nowClock = cityLocalWallClock(nowIso);
  if (!startClock || !nowClock) {
    const raw = city.window?.targetStartLocal || city.window?.nextTransitionAt || "";
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }
  // nowLocal 形如 2026-09-17T19:24:07+09:00，取其日期与偏移，
  // 拼出“该城市当地今天 10:45”的绝对时刻。
  const offset = /([+-]\d{2}:\d{2})$/.exec(String(nowIso || ""));
  const today = cityLocalDate(nowIso);
  if (!offset || today === "—") {
    const parsed = Date.parse(city.window?.targetStartLocal || "");
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }
  const stamped = Date.parse(`${today}T${startClock.hm}:00${offset[1]}`);
  return Number.isFinite(stamped) ? stamped : Number.POSITIVE_INFINITY;
}

function compareCityWindowOrder(a, b) {
  const ka = cityWindowSortKey(a);
  const kb = cityWindowSortKey(b);
  // 两座城市都没有窗口时间时 Infinity-Infinity=NaN，必须先按相等处理，
  // 否则会落到名称比较，让缺窗口的城市插到最前面。
  if (ka === kb) {
    return String(a.name || a.cityId).localeCompare(String(b.name || b.cityId), "zh-CN");
  }
  if (ka === Number.POSITIVE_INFINITY) return 1;
  if (kb === Number.POSITIVE_INFINITY) return -1;
  return ka - kb;
}

// 格子状态：灰=已执行(窗口已过) 蓝=未开始 绿=进行中 红=异常 金=已推送决策
//
// 关键语义：
// 1) “已推送”优先于一切。窗口走完后 runner 会把 stage 收尾成 RISK_ONLY，
//    那是正常结束而非故障；若先判异常，当天成功推送过的城市会全被涂红。
// 2) WEATHER_DATA_STALE / CITY_NOT_SHADOW_ELIGIBLE 这类 blocker 会出现在
//    几乎所有窗口已过的城市上（东京、伊斯坦布尔、莫斯科、惠灵顿都是），
//    它们是每日正常收尾的残留，不是异常。
// 3) 因此：窗口一旦走完，未推送就是灰色“已执行” —— 不再看 blocker。
//    红色只留给“本应交易却出现硬故障”的情形：窗口内硬阻断，或正式可交易
//    城市（FORMAL_ELIGIBLE）在窗口关闭时没能产出决策。
const HARD_BLOCKER_CODES = new Set([
  "MARKET_BOOK_STALE", "MARKET_BOOK_SEQUENCE_GAP",
  "MARKET_BUCKET_MAPPING_MISMATCH", "CONTRACT_RULES_UNVERIFIED",
  "VALUATION_INPUT_INVALID", "MARKET_SNAPSHOT_AFTER_EVALUATION_TIME",
  "MARKET_SNAPSHOT_BEFORE_1045_LOCK", "FORMAL_SNAPSHOT_AFTER_1045_CUTOFF",
  "FORMAL_WEATHER_FREEZE_UNAVAILABLE", "WEATHER_RECEIVED_IN_FUTURE",
  "DECISION_WINDOW_TARGET_LOCK_MISSING",
]);

// 可交易城市：只有这些城市“没产出决策”才算问题；轻量采集城市本来就只观察。
const TRADEABLE_POOLS = new Set(["FORMAL_ELIGIBLE", "SHADOW_ELIGIBLE"]);

function cityTileState(city) {
  // 用“城市当地今天”的阶段，而不是最新评估（可能是后天前瞻）的阶段。
  const stage = cityTodayStage(city);
  const opCode = city.operationalStatus?.code || "";
  const pool = city.poolStatus || "";
  const pushed = Number(city.todayPlans || 0) > 0 || city.hasReservedPlan === true;
  const inWindow = stage === "DECISION_OPEN" || stage === "WATCHING";
  const beforeWindow = stage === "BEFORE_WATCH";

  // 1) 已推送决策 —— 最高优先级
  if (pushed) {
    return {cls: "tile-pushed", label: "已推送决策"};
  }
  // 2) 规则阻断（香港 HKO 结算源未适配）—— 结构性阻断，与当日窗口无关
  if (opCode === "BLOCKED_GOVERNANCE" || pool === "BLOCKED_RULE") {
    return {cls: "tile-error", label: "规则阻断"};
  }
  // 3) 窗口内硬阻断 —— 真正的异常
  const blocker = city.latestEvaluation?.blocker || city.primaryBlocker || "";
  if (inWindow && HARD_BLOCKER_CODES.has(blocker)) {
    return {cls: "tile-error", label: "异常"};
  }
  // 4) 窗口进行中
  if (inWindow) {
    return {cls: "tile-active", label: "决策进行中"};
  }
  // 5) 尚未到窗口
  if (beforeWindow) {
    return {cls: "tile-upcoming", label: "未开始"};
  }
  // 6) 窗口已走完、未推送 —— 正式可交易城市仍无决策才算异常，其余为正常“已执行”
  if (TRADEABLE_POOLS.has(pool) && HARD_BLOCKER_CODES.has(blocker)) {
    return {cls: "tile-error", label: "异常"};
  }
  return {cls: "tile-pending", label: "已执行"};
}

// 城市本地时钟：targetStartLocal 形如 2026-09-17T10:45:00+12:00。
// 不能用 shortClock()，那会按浏览器时区换算（惠灵顿 10:45 会显示成 06:45）。
// 这里直接取 ISO 字符串里的当地 wall-clock 时分。
function cityLocalClock(iso) {
  const match = /T(\d{2}):(\d{2})/.exec(String(iso || ""));
  return match ? `${match[1]}:${match[2]}` : "—";
}

// 取 ISO 里的当地日期部分（2026-09-17T10:45:00+12:00 → 2026-09-17）。
function cityLocalDate(iso) {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(String(iso || ""));
  return match ? match[1] : "—";
}

// 取 ISO 里的当地 wall-clock 时分（含秒），返回 {hm, minutes}。
function cityLocalWallClock(iso) {
  const match = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(iso || ""));
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return {hm: `${match[1]}:${match[2]}`, minutes: h * 60 + m};
}

// 判断“该城市当地今天”的决策窗口处于哪个阶段。
//
// 为什么不能直接用 window.stage：它是“最新一条评估”的阶段，而引擎每 tick 会
// 滚出 今天/明天/后天 三条前瞻决策，最新那条几乎总是后天的 BEFORE_WATCH。
// 于是窗口早已走完的城市也会显示成“未开始”，且格子上的日期会和合约日打架。
//
// 这里改用窗口自身的时刻 + 城市当前本地时间推算今天的阶段（窗口日程固定为
// 当地 10:30 观察 / 10:45 锁定 / 11:00 关闭），与城市治理规则同源。
function cityTodayStage(city) {
  const startClock = cityLocalWallClock(city.window?.targetStartLocal);
  const endClock = cityLocalWallClock(city.window?.targetEndLocal);
  const nowClock = cityLocalWallClock(city.window?.nowLocal);
  if (!startClock || !nowClock) return city.window?.stage || "";
  const windowDate = cityLocalDate(city.window?.targetStartLocal);
  const nowDate = cityLocalDate(city.window?.nowLocal);
  const lockMinutes = startClock.minutes - 15;   // 当地 10:30 观察起点
  const closeMinutes = (endClock ? endClock.minutes : startClock.minutes + 15);
  // 前瞻窗口（窗口日期晚于城市当地今天）→ 今天的窗口尚未到来
  if (windowDate !== "—" && nowDate !== "—" && windowDate > nowDate) return "BEFORE_WATCH";
  // 窗口日期早于今天 → 今天的窗口早已结束
  if (windowDate !== "—" && nowDate !== "—" && windowDate < nowDate) return "CLOSED";
  const now = nowClock.minutes;
  if (now < lockMinutes) return "BEFORE_WATCH";
  if (now < startClock.minutes) return "WATCHING";
  if (now < closeMinutes) return "DECISION_OPEN";
  return "CLOSED";
}

function cityWeatherText(weather = {}) {
  const labels = Array.isArray(weather.forecastLabels) ? weather.forecastLabels.slice(0, 2) : [];
  const probability = weather.forecastProbability == null ? "" : `（${pct(weather.forecastProbability)}）`;
  const unit = String(weather.observedHighUnit || "").replace(/^°/, "");
  return {
    forecast: labels.length === 2 ? `${labels.join(" + ")}${probability}` : "等待V6预测",
    observed: weather.observedHigh == null ? "等待实测" : `${num(weather.observedHigh, 1)}°${unit}`,
    date: weather.contractDate || "—",
    updatedAt: weather.forecastUpdatedAt || weather.observedHighUpdatedAt || null,
  };
}

function renderCities() {
  const rows = cityRows();
  byId("cityRows").innerHTML = rows.map(city => {
    const weather = cityWeatherText(city);
    const state = cityTileState(city);
    // 格子显示该城市“当地今天”的窗口时刻，而不是最新一条评估的合约日。
    // 引擎每次 tick 会为同一城市滚出 今天/明天/后天 三条前瞻决策，
    // latestEvaluation 指向前瞻窗口（这是刻意设计，用于匹配明天的名额），
    // 但格子上显示的必须是今天 —— 否则日期会显示成后天。
    const todayDate = weather.date && weather.date !== "—" ? weather.date : null;
    const windowDate = cityLocalDate(city.window?.targetStartLocal);
    const windowIsLookahead = Boolean(todayDate && windowDate !== "—" && windowDate !== todayDate);
    return `<article class="city-tile ${state.cls} ${city.cityId === selectedCityId ? "selected" : ""}" data-city="${esc(city.cityId)}" title="${esc(city.name)} · ${esc(state.label)}${windowIsLookahead ? ` · 已前瞻评估 ${windowDate}` : ""}">
      <div class="city-tile-head">
        <b>${esc(city.name)}</b>
        <small>${cityLocalClock(city.window?.targetStartLocal)}</small>
      </div>
      <span class="city-tile-state"><i class="dot"></i>${esc(state.label)}</span>
      <div class="city-tile-body">
        <b>${esc(weather.forecast)}</b>
        <div>实测 ${esc(weather.observed)} · 合约日 ${esc(weather.date)}</div>
      </div>
      <div class="city-tile-foot">
        <span>决策 ${num(city.todayDecisions)} · 通过 ${num(city.todayQualified)} · 计划 ${num(city.todayPlans)}</span>
        <span>${esc(windowStageLabel(cityTodayStage(city)))}${windowIsLookahead ? " · 已前瞻明后天" : ""}</span>
      </div>
    </article>`;
  }).join("") || `<div class="empty-detail"><p>没有符合筛选条件的城市</p></div>`;
  byId("cityRows").querySelectorAll("article[data-city]").forEach(tile => tile.addEventListener("click", () => selectCity(tile.dataset.city)));
}

function metricValue(metrics, key, fallback = null) { const value = metrics?.[key]; return value == null ? fallback : Number(value); }
function selectCity(cityId) {
  selectedCityId = cityId;
  const city = payload.cities.find(item => item.cityId === cityId);
  if (!city) return;
  byId("cityRows").querySelectorAll("article[data-city]").forEach(tile => tile.classList.toggle("selected", tile.dataset.city === cityId));
  const m = city.metrics || {};
  const weather = cityWeatherText(city.weatherToday);
  const evidence = [
    ["时间点完整率", metricValue(m,"point_in_time_completeness"), v => pct(v)],
    ["盘口完整率", metricValue(m,"book_completeness"), v => pct(v)],
    ["模型技能改善", metricValue(m,"proper_score_improvement"), v => pct(v)],
    ["校准质量 (1-ECE)", m.ece == null ? null : Math.max(0,1-Number(m.ece)), v => pct(v)],
  ];
  const evidenceHtml = evidence.map(([label,value,format]) => `<div class="evidence-row"><div><span>${label}</span><b>${value == null ? "未采集" : format(value)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${value == null ? 0 : Math.max(0,Math.min(1,value))*100}%"></div></div></div>`).join("");
  byId("cityDetail").innerHTML = `<div class="detail-top"><div><h3>${esc(city.name)}</h3><p>${esc(city.cityId)} · ${esc(city.timezoneGroupLabel || city.timezoneGroup || city.correlationGroup)}</p></div><span class="status-badge ${statusClass(city.poolStatus)}">${esc(poolLabel(city.poolStatus, city.poolExplanation))}</span></div>
    <div class="detail-grid"><div><span>当日V6预测两档</span><b>${esc(weather.forecast)}</b></div><div><span>当日结算站最高温</span><b>${esc(weather.observed)}</b><small class="sub">10分钟刷新 · ${shortClock(city.weatherToday?.observedHighUpdatedAt)}</small></div><div><span>结算站</span><b>${esc(city.station)}</b></div><div><span>本地时区</span><b>${esc(city.timezone)}</b></div><div><span>主时区组</span><b>${esc(city.timezoneGroupLabel || city.timezoneGroup)}</b></div><div><span>气候子类</span><b>${esc(city.climateSubcategoryLabel || city.climateSubcategory)}</b></div><div><span>UTC 主时区组名额</span><b>${num(city.timezoneGroupUsage?.plansReserved)} / 1</b></div><div><span>UTC 全局名额</span><b>${num(payload.paperRisk?.globalUsage?.plansReserved)} / ${num(payload.paperRisk?.globalUsage?.maxPlans)}</b></div><div><span>训练日</span><b>${num(m.training_days)}</b></div><div><span>未触碰评估日</span><b>${num(m.untouched_days)}</b></div><div><span>影子候选</span><b>${num(m.executable_candidates)}</b></div><div><span>今日策略通过</span><b>${num(city.todayQualified)}</b></div></div>
    <div class="detail-note"><b>UTC 纸面风控：</b>${esc(city.timezoneGroupUsage?.reason || "每个主时区组当日最多一个计划。")} 当前主时区组预留 ${num(city.timezoneGroupUsage?.plansReserved)} 个；全局新增风险 ${num(payload.paperRisk?.globalUsage?.riskReservedU, 2)} / ${num(payload.paperRisk?.globalUsage?.maxDailyRiskU, 0)}U。</div>
    <div class="evidence"><h4>决策窗口</h4><div class="window-line">${esc(windowStageLabel(city.window?.stage))} · 正式窗口 ${city.window?.targetStartLocal ? esc(shortClock(city.window.targetStartLocal) + "–" + shortClock(city.window.targetEndLocal) + "（本地）") : "—"}</div></div>
    <div class="evidence"><h4>城市晋级证据</h4>${evidenceHtml}</div>
    <div class="detail-note">${city.hasReservedPlan ? `<b>纸面计划已预留：业务日 ${num(city.todayPlans)} 个 · 相关合约 ${num(city.activeReservations?.length)} 个</b><br>之后的阻断重估不会覆盖原计划。${city.latestEvaluation?.blocker ? `<br><b>当前评估阻断：${esc(blockerLabel(city.latestEvaluation.blocker, city.latestEvaluation.blockerExplanation))}</b>` : ""}` : city.latestEvaluation?.blocker ? `<b>当前主要阻断：${esc(blockerLabel(city.latestEvaluation.blocker, city.latestEvaluation.blockerExplanation))}</b><br>${esc(city.latestEvaluation.blockerExplanation?.description || "")}<br><small>判定：${esc(city.latestEvaluation.blockerExplanation?.condition || city.latestEvaluation.blocker)}｜解除：${esc(city.latestEvaluation.blockerExplanation?.recovery || "等待重新评估")}</small>` : city.latestDisposition ? `最新决策：${esc(city.latestDispositionLabel || dispositionLabel(city.latestDisposition))} · ${shortTime(city.latestDecisionAt)}` : `${esc(city.poolExplanation?.description || "尚无该城市今日决策。采集资格不等于交易资格。")}`}</div>`;
  renderLinkedPanels();
}

function selectedCity() {
  return payload?.cities?.find(city => city.cityId === selectedCityId) || null;
}

function cityScoped(items) {
  return selectedCityId ? (items || []).filter(item => item.cityId === selectedCityId) : (items || []);
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const value = item[field];
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function renderLinkedPanels() {
  const orders = cityScoped(payload.orders);
  renderOrders(orders);
  const decisions = cityScoped(payload.decisions);
  renderDistribution("dispositions", countBy(decisions, "disposition"));
  renderDistribution("executionStates", countBy(orders, "state"));
  const blockers = Object.entries(countBy(decisions.filter(d => d.primaryBlocker), "primaryBlocker"))
    .map(([code, count]) => {
      const withExplanation = decisions.find(d => d.primaryBlocker === code && d.primaryBlockerExplanation);
      return {code, count, explanation: withExplanation ? withExplanation.primaryBlockerExplanation : null};
    })
    .sort((a, b) => b.count - a.count);
  renderBlockers(blockers);
}

function clearCityFilter() {
  selectedCityId = null;
  renderCities();
  renderLinkedPanels();
}

// ---- 模拟交易明细与统计（paper-account） ----
let accountFrom = "";
let accountTo = "";
let accountPeriodInitialized = false;

function initializeAccountPeriod(businessDate) {
  if (accountPeriodInitialized) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(businessDate || "")) ? String(businessDate) : "";
  accountFrom = date;
  accountTo = date;
  accountPeriodInitialized = true;
  if (typeof byId === "function" && byId("accountFrom")) byId("accountFrom").value = accountFrom;
  if (typeof byId === "function" && byId("accountTo")) byId("accountTo").value = accountTo;
}

function accountPeriodFiltered(account) {
  const trades = account?.trades || [];
  if (!accountFrom && !accountTo) return trades;
  return trades.filter(t => {
    const d = String(t.contractDate || "");
    if (accountFrom && d < accountFrom) return false;
    if (accountTo && d > accountTo) return false;
    return true;
  });
}

function accountPeriodStats(trades) {
  const settled = trades.filter(t => t.status === "SETTLED" && t.pnlU != null);
  // A multi-leg center package is one outcome for a city on its contract date.
  const unitPnl = new Map();
  settled.forEach(t => {
    const city = String(t.cityId || "");
    const date = String(t.contractDate || "");
    const key = city && date ? `${city}\u0000${date}` : `legacy:${String(t.tradeId || "")}`;
    unitPnl.set(key, (unitPnl.get(key) || 0) + Number(t.pnlU));
  });
  const unitValues = [...unitPnl.values()];
  const wins = unitValues.filter(pnl => pnl > 0);
  const losses = unitValues.filter(pnl => pnl <= 0);
  const pnl = settled.reduce((sum, t) => sum + Number(t.pnlU), 0);
  const stake = trades.reduce((sum, t) => sum + Number(t.stakeU || 0), 0);
  return {
    trades: trades.length,
    settled: settled.length,
    settledUnits: unitValues.length,
    open: trades.length - settled.length,
    winRate: unitValues.length ? wins.length / unitValues.length : null,
    pnlU: pnl,
    stakeU: stake,
    winCount: wins.length,
    lossCount: losses.length,
  };
}

function accountStatCard(label, value, sub = "", cls = "") {
  return `<div class="account-stat ${cls}"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
}

function renderPaperAccount(account) {
  const available = account && account.available;
  const filtered = accountPeriodFiltered(account);
  const period = accountPeriodStats(filtered);
  if (!available) {
    byId("accountStats").innerHTML = `<div class="empty-detail account-empty"><span>⌁</span><p>模拟账户尚未初始化（等待每日结算账本写入 paper-account.json）</p></div>`;
    byId("accountPeriodStats").innerHTML = "";
    byId("accountRows").innerHTML = "";
    return;
  }
  const winRate = account.winRate == null ? "—" : pct(account.winRate);
  const current = account.currentVersionPerformance;
  const cohortRate = (metric, emptyLabel) => Number(metric?.sampleN || 0) > 0
    ? pct(metric.hitRate ?? metric.winRate)
    : emptyLabel;
  const cohortSub = (metric, detail = "") => `样本 N=${num(metric?.sampleN || 0)}${detail ? ` · ${detail}` : ""}`;
  const currentCards = current ? [
    accountStatCard("当前版本 · 全部正式中心两档", cohortRate(current.allFormalCenterPair, "待正式评分"), cohortSub(current.allFormalCenterPair, `命中 ${num(current.allFormalCenterPair?.hitCount || 0)}`)),
    accountStatCard(
      "当前版本 · 决策执行统一包胜率",
      cohortRate(current.verifiedDecisionExecutionPackages, "暂无官方结算样本"),
      cohortSub(
        current.verifiedDecisionExecutionPackages,
        `盈利 ${num(current.verifiedDecisionExecutionPackages?.winCount || 0)} / 亏损 ${num(current.verifiedDecisionExecutionPackages?.lossCount || 0)} · 身份不一致 ${num(current.verifiedDecisionExecutionPackages?.identityMismatchCount || 0)} 包已隔离 · 未验证结算腿 ${num(current.excludedUnverifiedSettlementLegs || 0)} 条已隔离`,
      ),
    ),
  ] : [];
  byId("accountStats").innerHTML = [
    accountStatCard("账户净值", money(account.equityU), `期初 ${num(account.startBalanceU,2)}U`),
    accountStatCard("累计 PnL", money(account.cumPnlU), `累计 ROI ${pct(account.roiCumPct/100)}`, Number(account.cumPnlU) > 0 ? "positive" : Number(account.cumPnlU) < 0 ? "negative" : ""),
    accountStatCard("现金余额", money(account.cashU), "可用 USDC 等价"),
    accountStatCard("历史混合账户胜率", winRate, `盈利 ${num(account.winCount)} / 亏损 ${num(account.lossCount)}`),
    ...currentCards,
    accountStatCard("已结算交易腿", num(account.tradesSettled), `结算城市日 ${num(account.settledCityDateCount)}｜未结算 ${num(account.tradesOpen)}`),
    accountStatCard("总交易腿数", num(account.tradesTotal), `盈利额 ${money(account.sumWinPnlU)} / 亏损额 ${money(account.sumLossPnlU)}`),
  ].join("");
  const rangeLabel = accountFrom || accountTo ? `${accountFrom || "起始"} → ${accountTo || "至今"}` : "全部账期";
  const periodWin = period.winRate == null ? "—" : pct(period.winRate);
  byId("accountPeriodStats").innerHTML = `<div class="period-stats-inner"><span class="period-chip">账期：${esc(rangeLabel)}</span><span>区间交易 ${num(period.trades)} 腿</span><span>区间结算 ${num(period.settled)} 腿 / ${num(period.settledUnits)} 城市日</span><span>区间胜率（城市·日期） ${periodWin}</span><span class="${period.pnlU > 0 ? "positive" : period.pnlU < 0 ? "negative" : ""}">区间已实现 PnL ${money(period.pnlU)}</span></div>`;
  byId("accountRows").innerHTML = filtered.slice().sort((a, b) => String(b.contractDate || "").localeCompare(String(a.contractDate || ""))).map(t => {
    const pnl = t.pnlU == null ? "—" : money(t.pnlU);
    const pnlCls = t.pnlU == null ? "" : Number(t.pnlU) > 0 ? "positive" : Number(t.pnlU) < 0 ? "negative" : "";
    const ledger = t.ledgerStatus === "ACTIVE"
      ? `<span class="status-badge status-SHADOW_ELIGIBLE">已占名额</span>`
      : `<span class="status-badge ledger-released" title="该计划当时已生成正式执行清单，但名额后被他更优计划替换或到期释放；模拟账户仍按决策价入账结算">名额已释放</span>`;
    const finalBucket = t.status === "SETTLED" ? (t.finalBucket || "—") : (t.finalBucket || "—");
    const observedHigh = t.observedHigh == null
      ? "—"
      : `${num(t.observedHigh, 1)}${esc(t.observedHighUnit || "")}`;
    const observedTitle = t.observedHighUpdatedAt
      ? `结算站 METAR 实测累计最高；数据源更新 ${shortTime(t.observedHighUpdatedAt)}`
      : "结算站 METAR 实测累计最高";
    const executionSource = t.executionMode === "PAPER_SIMULATED"
      ? `${t.executionProvenance === "DEPLOYMENT_BACKFILL" ? "部署前回填 · " : ""}模拟 ${t.executionState || "成交"}${t.noExchangeOrder ? " · 未向交易所下单" : ""}`
      : "";
    const settlement = t.settlementStatus === "POLYMARKET_OFFICIAL_SETTLED"
      ? `<small class="sub" title="事件 ${esc(t.settlementEventId || "—")}">Polymarket 官方已结算</small>`
      : t.settlementStatus === "POLYMARKET_AWAITING_VERIFIED_MAPPING"
        ? `<small class="sub">官方映射待核验 · 不计当前版本官方胜率</small>`
        : "";
    const accountingStatus = t.status === "SETTLED" ? "模拟账本已结算" : (t.status || "—");
    return `<tr class="${t.status === "OPEN" ? "account-open" : ""}">
      <td><b>${esc(t.contractDate || "—")}</b></td>
      <td><b>${esc(t.cityId)}</b><small class="sub">${esc(String(t.tradeId || "").slice(0, 12))}</small>${executionSource ? `<small class="sub">${esc(executionSource)}</small>` : ""}</td>
      <td>${esc(t.bucketLabel || "—")}</td>
      <td title="${esc(observedTitle)}"><b class="observed-high">${observedHigh}</b><small class="sub">实测</small></td>
      <td><span class="account-side ${esc(t.side)}">${esc(t.side || "—")}</span></td>
      <td>${num(t.entryPrice, 4)}</td>
      <td>${num(t.shares, 2)}</td>
      <td>${num(t.stakeU, 2)} U</td>
      <td>${ledger}</td>
      <td><span class="status-badge status-${esc(t.status)}" title="账本状态 ${esc(t.status)}">${esc(accountingStatus)}</span>${settlement}</td>
      <td>${esc(finalBucket)}</td>
      <td class="${pnlCls}">${pnl}</td>
    </tr>`;
  }).join("") || `<tr class="empty-row"><td colspan="12">当前账期没有交易记录。调整账期筛选或等待每日入账。</td></tr>`;
}

function resetAccountPeriod() {
  accountPeriodInitialized = true;
  accountFrom = "";
  accountTo = "";
  byId("accountFrom").value = "";
  byId("accountTo").value = "";
  renderPaperAccount(payload?.paperAccount);
}

function setAccountPeriod(from, to, render = true) {
  accountPeriodInitialized = true;
  accountFrom = from || "";
  accountTo = to || "";
  if (render && typeof byId === "function" && byId("accountFrom")) byId("accountFrom").value = accountFrom;
  if (render && typeof byId === "function" && byId("accountTo")) byId("accountTo").value = accountTo;
  if (render && payload) renderPaperAccount(payload.paperAccount);
}

function renderOrders(orders) {
  byId("orderGrid").innerHTML = orders.map(order => {
    const paperSimulated = order.executionMode === "PAPER_SIMULATED";
    const stateLabel = paperSimulated ? `模拟 ${order.state}` : order.state;
    return `<article class="order-card"><header><div><h3>${esc(order.cityId)} · ${esc(order.strategyAction)}</h3><p>${esc(order.planId)}</p></div><span class="status-badge status-${esc(order.state)}">${esc(stateLabel)}</span></header><div class="order-main"><div><span>计划仓位</span><b>${num(order.requestedStake,2)} U</b></div><div><span>执行方式</span><b>${esc(order.executionStyle)}</b></div></div><div class="legs">${(order.legs || []).map(leg => `<div class="leg"><span>${esc(leg.side)} ${esc(leg.label)}</span><span>@ ${num(leg.vwap ?? leg.limit_price,4)}${leg.vwap != null && Math.abs(Number(leg.vwap)-Number(leg.limit_price)) > 1e-9 ? ` <small>限 ${num(leg.limit_price,4)}</small>` : ""}</span><span>${num(leg.shares,2)} 股</span></div>`).join("") || `<div class="leg empty">无腿详情（台账保留记录）</div>`}</div><div class="order-foot"><span>${paperSimulated ? "模拟盘：未向交易所下单" : order.executionAuthorized ? "影子已授权" : "仅影子 / Paper"}${order.stillQualified ? ` · <b class="still-text">策略仍有效</b>` : ""}</span><span>到期 ${shortTime(order.expiresAt)}</span></div></article>`;
  }).join("") || `<div class="empty-detail"><span>⌁</span><p>今日尚无可执行订单计划</p></div>`;
}

function renderDistribution(targetId, values) {
  const entries = Object.entries(values || {}).sort((a,b) => Number(b[1])-Number(a[1]));
  const max = Math.max(1,...entries.map(([,value]) => Number(value)));
  byId(targetId).innerHTML = entries.map(([label,value]) => `<div class="distribution-row"><label>${esc(label)}</label><div class="bar-track"><div class="bar-fill" style="width:${Number(value)/max*100}%"></div></div><b>${num(value)}</b></div>`).join("") || `<div class="empty-detail"><p>等待当日数据</p></div>`;
}

function renderBlockers(blockers) {
  byId("blockers").innerHTML = blockers.map(item => `<div class="blocker"><span title="${esc(item.code)}">${esc(blockerLabel(item.code, item.explanation))}<small>${esc(item.code)}</small></span><b>${num(item.count)}</b></div>`).join("") || `<div class="empty-detail"><p>今日没有结构化阻断记录</p></div>`;
}

function render(data) {
  payload = data;
  renderSummary(data); renderAlerts(data.alerts || []); renderReservedPlans(data.reservedPlans || [], data.paperRisk); renderFunnel(data.funnel); renderPools(data.pools);
  if (selectedCityId && !data.cities.some(city => city.cityId === selectedCityId)) selectedCityId = null;
  initializeAccountPeriod(data.businessDate);
  renderCities(); renderLinkedPanels(); renderPaperAccount(data.paperAccount);
}

function isDashboardPayload(data) {
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  return record(data)
    && record(data.summary)
    && record(data.health)
    && record(data.funnel)
    && record(data.pools)
    && Array.isArray(data.cities)
    && Array.isArray(data.decisions)
    && Array.isArray(data.orders);
}

async function fetchDashboardJson(url) {
  const response = await fetch(url, {cache:"no-store"});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers?.get("content-type") || "";
  if (!/^application\/(?:json\b|[^;]+\+json\b)/i.test(contentType)) {
    throw new Error(`Expected JSON but received ${contentType || "no Content-Type"}`);
  }
  const data = await response.json();
  if (!isDashboardPayload(data)) throw new Error("Invalid dashboard payload shape");
  return data;
}

async function loadDashboardPayload() {
  // Prefer the canonical snapshot so a built/offline site never needs an API.
  const staticSnapshot = `./data/dashboard-primary.json?v=${Date.now()}`;
  try {
    return await fetchDashboardJson(staticSnapshot);
  } catch (staticError) {
    try {
      return await fetchDashboardJson("/api/dashboard");
    } catch (apiError) {
      throw new Error(`Dashboard API failed: ${apiError.message} (static snapshot: ${staticError.message})`);
    }
  }
}

let refreshInFlight = false;
async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    render(await loadDashboardPayload());
  } catch (error) {
    byId("healthLabel").textContent = "OFFLINE";
    byId("freshness").textContent = error.message;
    byId("systemState").classList.remove("online");
  } finally {
    refreshInFlight = false;
  }
}

if (typeof document !== "undefined") {
  byId("citySearch").addEventListener("input", renderCities);
  byId("poolFilter").addEventListener("change", renderCities);
  byId("tzFilter").addEventListener("change", renderCities);
  byId("accountFrom").addEventListener("change", event => { accountFrom = event.target.value; renderPaperAccount(payload?.paperAccount); });
  byId("accountTo").addEventListener("change", event => { accountTo = event.target.value; renderPaperAccount(payload?.paperAccount); });
  byId("accountPeriodReset").addEventListener("click", resetAccountPeriod);
  setInterval(() => byId("clock").textContent = new Date().toLocaleTimeString("zh-CN", {hour12:false}), 1000);
  refresh(); setInterval(refresh, 15000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {cityWeatherText, fetchDashboardJson, isDashboardPayload, loadDashboardPayload, refresh, renderSummary, renderPools, renderReservedPlans, renderPaperAccount, initializeAccountPeriod, resetAccountPeriod, setAccountPeriod, cityTileState, cityTodayStage, compareCityWindowOrder, cityWindowSortKey, cityLocalClock, cityLocalDate};
}
