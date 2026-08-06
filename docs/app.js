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
const poolLabel = (status, explanation) => explanation?.label || ({COLLECT_FULL:"完整采集",COLLECT_LITE:"轻量采集",MODEL_ELIGIBLE:"模型合格",SHADOW_ELIGIBLE:"影子合格",CASH_ELIGIBLE:"现金合格",BLOCKED_RULE:"规则阻断",BLOCKED_DATA:"数据阻断",BLOCKED_SKILL:"模型阻断",BLOCKED_LIQUIDITY:"流动性阻断",SUSPENDED_RISK:"风险暂停",UNIVERSE:"候选全集"}[status] || status);
const dispositionLabel = status => ({EXECUTE_NOW:"可立即执行",POST_MAKER:"可挂限价单",WAIT:"等待更新",SKIP:"暂不操作",HOLD:"持有观察",REDUCE:"减仓",EXIT:"退出",REBALANCE:"调仓",BLOCKED:"被硬性阻断"}[status] || status || "等待数据");
const windowStageLabel = stage => ({BEFORE_WATCH:"观察前",WATCHING:"观察中",DECISION_OPEN:"决策打开(非正式)",TARGET_WINDOW:"正式决策窗口",RISK_ONLY:"仅风控",CLOSED:"已关闭",BLOCKED:"阻断"}[stage] || stage || "未评估");
const blockerLabel = (code, explanation) => explanation?.label || ({DAILY_NEW_RISK_LIMIT:"今日新增风险额度已满",DAILY_PACKAGE_COUNT_LIMIT:"今日计划名额已满",CLIMATE_SUBCATEGORY_DAILY_PLAN_LIMIT:"气候子类当日计划已占用",CITY_NOT_SHADOW_ELIGIBLE:"城市未获策略准入",CITY_BLOCKED_RULE:"城市规则禁止",WEATHER_DATA_STALE:"天气数据已过期",MARKET_BOOK_STALE:"盘口快照已过期",MARKET_BOOK_SEQUENCE_GAP:"盘口序列不连续",MARKET_BUCKET_MAPPING_MISMATCH:"合约档位映射异常",CONTRACT_RULES_UNVERIFIED:"合约规则未验证",VALUATION_INPUT_INVALID:"估值输入不合法",RISK_LIMIT_BLOCKED:"风险规则阻断",NO_POSITIVE_EXECUTABLE_ACTION:"没有可成交的正期望机会"}[code] || code || "无阻断");

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
  // 今日生成计划 = 今日评估中曾生成计划记录的唯一合约数；台账名额是持久化占用。
  byId("metricPlans").textContent = num(s.plannedOrders);
  byId("metricAuthorized").textContent = `台账名额 ${occupied} / ${maxPlans}${s.executionAuthorized ? ` · 影子授权 ${s.executionAuthorized}` : ""}`;
  byId("metricFillRate").textContent = pct(s.fillRate);
  byId("metricFilled").textContent = `成交 ${s.filledOrders} / 提交 ${s.submittedOrders}`;
  byId("metricRisk").textContent = money(s.openRiskU);
  byId("metricStake").textContent = `今日成交额 ${num(s.filledStakeU, 2)} U`;
  byId("metricPnl").textContent = money(s.realizedPnlU);
  byId("metricPnl").className = Number(s.realizedPnlU) > 0 ? "positive" : Number(s.realizedPnlU) < 0 ? "negative" : "";
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
  byId("slotUsage").textContent = `${num(occupied)} 个名额已占用 · 按合约本地日期分组`;
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
          <div class="slot-stats"><div><small>计划仓位</small><b>${num(r.requestedStakeU,2)}U</b></div><div><small>实际风险</small><b>${num(r.worstCaseRiskU,2)}U</b></div></div>
          <div class="slot-ids"><small title="${esc(r.decisionId)}">决策 ${esc(compactId(r.decisionId))}</small><small title="${esc(r.planId)}">计划 ${esc(compactId(r.planId))}</small>${window.stage ? `<small>窗口 ${esc(window.stage)} / ${esc(window.status || "—")}</small>` : ""}</div>` : `<div class="slot-main"><strong>空闲</strong><small>等待符合既有策略与风控的计划</small></div>`}
      </article>`;
    }).join("")}</div>
  </section>`).join("") || `<div class="empty-detail slot-empty"><p>等待名额目录</p></div>`;
}

function renderFunnel(funnel) {
  const steps = [["决策重估(今日唯一)",funnel.decisionEvents],["策略通过(累计)",funnel.strategyQualified],["生成计划(累计)",funnel.planned],["提交执行",funnel.submitted],["完整成交",funnel.filled]];
  byId("funnel").innerHTML = steps.map((step, index) => {
    const base = index ? Number(steps[index-1][1]) : Number(step[1]);
    const rate = index ? (base ? Number(step[1]) / base : 0) : 1;
    return `<div class="funnel-step"><span>${esc(step[0])}</span><strong>${num(step[1])}</strong><small>${index ? `阶段转化 ${pct(rate)}` : "有效重估事件"}</small></div>`;
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
}

function cityRows() {
  const query = byId("citySearch").value.trim().toLowerCase();
  const pool = byId("poolFilter").value;
  return payload.cities.filter(city => {
    const text = `${city.name} ${city.cityId} ${city.station || ""} ${city.timezoneGroup || city.correlationGroup}`.toLowerCase();
    return (!query || text.includes(query)) && (pool === "ALL" || city.poolStatus === pool);
  });
}

function renderCities() {
  const rows = cityRows();
  byId("cityRows").innerHTML = rows.map(city => `<tr data-city="${esc(city.cityId)}" class="${city.cityId === selectedCityId ? "selected" : ""}">
    <td class="city-name"><b>${esc(city.name)}</b><small>${esc(city.cityId)}</small></td>
    <td><span class="status-badge ${statusClass(city.poolStatus)}">${esc(poolLabel(city.poolStatus, city.poolExplanation))}</span></td>
    <td><span>${esc(city.station)}</span><small class="sub">${esc(city.timezone)}</small></td>
    <td>${esc(city.timezoneGroupLabel || city.timezoneGroup || city.correlationGroup)}</td><td><b>${num(city.todayDecisions)}</b><small class="sub">通过 ${num(city.todayQualified)} · 计划 ${num(city.todayPlans)}</small></td>
    <td><div class="dimension-badges"><span class="status-badge ${statusClass(city.poolStatus)}">治理：${esc(poolLabel(city.poolStatus, city.poolExplanation))}</span><span class="status-badge">窗口：${esc(windowStageLabel(city.window?.stage))}</span><span class="disposition ${esc(city.latestDisposition || "")}">${esc(city.operationalStatus?.label || "等待评估")}</span></div><small class="sub">${esc(city.latestEvaluation?.blocker ? blockerLabel(city.latestEvaluation.blocker, city.latestEvaluation.blockerExplanation) : "无评估阻断")} · 下次 ${shortTime(city.window?.nextCheckAt || city.window?.nextTransitionAt)}</small></td>
  </tr>`).join("") || `<tr class="empty-row"><td colspan="6">没有符合筛选条件的城市</td></tr>`;
  byId("cityRows").querySelectorAll("tr[data-city]").forEach(row => row.addEventListener("click", () => selectCity(row.dataset.city)));
}

function metricValue(metrics, key, fallback = null) { const value = metrics?.[key]; return value == null ? fallback : Number(value); }
function selectCity(cityId) {
  selectedCityId = cityId;
  const city = payload.cities.find(item => item.cityId === cityId);
  if (!city) return;
  byId("cityRows").querySelectorAll("tr").forEach(row => row.classList.toggle("selected", row.dataset.city === cityId));
  const m = city.metrics || {};
  const evidence = [
    ["时间点完整率", metricValue(m,"point_in_time_completeness"), v => pct(v)],
    ["盘口完整率", metricValue(m,"book_completeness"), v => pct(v)],
    ["模型技能改善", metricValue(m,"proper_score_improvement"), v => pct(v)],
    ["校准质量 (1-ECE)", m.ece == null ? null : Math.max(0,1-Number(m.ece)), v => pct(v)],
  ];
  const evidenceHtml = evidence.map(([label,value,format]) => `<div class="evidence-row"><div><span>${label}</span><b>${value == null ? "未采集" : format(value)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${value == null ? 0 : Math.max(0,Math.min(1,value))*100}%"></div></div></div>`).join("");
  byId("cityDetail").innerHTML = `<div class="detail-top"><div><h3>${esc(city.name)}</h3><p>${esc(city.cityId)} · ${esc(city.timezoneGroupLabel || city.timezoneGroup || city.correlationGroup)}</p></div><span class="status-badge ${statusClass(city.poolStatus)}">${esc(poolLabel(city.poolStatus, city.poolExplanation))}</span></div>
    <div class="detail-grid"><div><span>结算站</span><b>${esc(city.station)}</b></div><div><span>本地时区</span><b>${esc(city.timezone)}</b></div><div><span>主时区组</span><b>${esc(city.timezoneGroupLabel || city.timezoneGroup)}</b></div><div><span>气候子类</span><b>${esc(city.climateSubcategoryLabel || city.climateSubcategory)}</b></div><div><span>UTC 主时区组名额</span><b>${num(city.timezoneGroupUsage?.plansReserved)} / 1</b></div><div><span>UTC 全局名额</span><b>${num(payload.paperRisk?.globalUsage?.plansReserved)} / ${num(payload.paperRisk?.globalUsage?.maxPlans)}</b></div><div><span>训练日</span><b>${num(m.training_days)}</b></div><div><span>未触碰评估日</span><b>${num(m.untouched_days)}</b></div><div><span>影子候选</span><b>${num(m.executable_candidates)}</b></div><div><span>今日策略通过</span><b>${num(city.todayQualified)}</b></div></div>
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
  const city = selectedCity();
  const label = city ? `${city.name} / ${city.cityId}` : "全部城市";
  byId("linkedFilterLabel").textContent = `当前筛选：${label}`;
  byId("clearCityFilter").hidden = !city;
  const decisions = cityScoped(payload.decisions);
  const orders = cityScoped(payload.orders);
  renderDecisions(decisions); renderOrders(orders);
  renderDistribution("dispositions", countBy(decisions, "disposition"));
  renderDistribution("executionStates", countBy(orders, "state"));
  const blockers = Object.entries(countBy(decisions.filter(d => d.primaryBlocker), "primaryBlocker"))
    .map(([code, count]) => ({code, count}))
    .sort((a, b) => b.count - a.count);
  renderBlockers(blockers);
}

function clearCityFilter() {
  selectedCityId = null;
  renderCities();
  renderLinkedPanels();
}

function renderDecisions(decisions) {
  byId("decisionRows").innerHTML = decisions.map(d => `<tr><td>${shortTime(d.emittedAt)}<small class="sub">${esc(d.decisionId)}</small></td><td><b>${esc(d.cityId)}</b><small class="sub">${esc(d.contractDate)}</small></td><td><span class="disposition ${esc(d.disposition)}">${esc(d.dispositionLabel || dispositionLabel(d.disposition))}</span><small class="sub">${esc(d.disposition)}</small></td><td>${esc(d.strategyAction)}<small class="sub">${esc((d.labels || []).join(" + ") || "—")}</small></td><td>${d.pCons == null ? "—" : pct(d.pCons)}<small class="sub">包价 ${d.packageCost == null ? "—" : num(d.packageCost,4)}</small></td><td class="${Number(d.expectedRoi) > 0 ? "positive" : Number(d.expectedRoi) < 0 ? "negative" : ""}">${pct(d.expectedRoi)}</td><td><div class="auth-stack" title="左：策略通过；右：实盘授权"><i class="auth-chip strategy ${d.strategyQualified ? "on" : ""}"></i><i class="auth-chip live ${d.executionAuthorized ? "on" : ""}"></i></div></td><td title="${esc(d.primaryBlockerExplanation?.condition || d.primaryBlocker || "")}">${esc(blockerLabel(d.primaryBlocker, d.primaryBlockerExplanation))}<small class="sub">${esc(d.primaryBlocker || "—")}</small></td></tr>`).join("") || `<tr class="empty-row"><td colspan="8">今日尚无决策。通过 CLI 或运行服务写入 monitoring.db 后会自动展示。</td></tr>`;
}

function renderOrders(orders) {
  byId("orderGrid").innerHTML = orders.map(order => `<article class="order-card"><header><div><h3>${esc(order.cityId)} · ${esc(order.strategyAction)}</h3><p>${esc(order.planId)}</p></div><span class="status-badge status-${esc(order.state)}">${esc(order.state)}</span></header><div class="order-main"><div><span>计划仓位</span><b>${num(order.requestedStake,2)} U</b></div><div><span>执行方式</span><b>${esc(order.executionStyle)}</b></div></div><div class="legs">${(order.legs || []).map(leg => `<div class="leg"><span>${esc(leg.side)} ${esc(leg.label)}</span><span>@ ${num(leg.limit_price,4)}</span><span>${num(leg.shares,2)} 股</span></div>`).join("") || `<div class="leg empty">无腿详情（台账保留记录）</div>`}</div><div class="order-foot"><span>${order.executionAuthorized ? "影子已授权" : "仅影子 / Paper"}${order.stillQualified ? ` · <b class="still-text">策略仍有效</b>` : ""}</span><span>到期 ${shortTime(order.expiresAt)}</span></div></article>`).join("") || `<div class="empty-detail"><span>⌁</span><p>今日尚无可执行订单计划</p></div>`;
}

function renderDistribution(targetId, values) {
  const entries = Object.entries(values || {}).sort((a,b) => Number(b[1])-Number(a[1]));
  const max = Math.max(1,...entries.map(([,value]) => Number(value)));
  byId(targetId).innerHTML = entries.map(([label,value]) => `<div class="distribution-row"><label>${esc(label)}</label><div class="bar-track"><div class="bar-fill" style="width:${Number(value)/max*100}%"></div></div><b>${num(value)}</b></div>`).join("") || `<div class="empty-detail"><p>等待当日数据</p></div>`;
}

function renderBlockers(blockers) {
  byId("blockers").innerHTML = blockers.map(item => `<div class="blocker"><span title="${esc(item.code)}">${esc(blockerLabel(item.code))}<small>${esc(item.code)}</small></span><b>${num(item.count)}</b></div>`).join("") || `<div class="empty-detail"><p>今日没有结构化阻断记录</p></div>`;
}

function render(data) {
  payload = data;
  renderSummary(data); renderAlerts(data.alerts || []); renderReservedPlans(data.reservedPlans || [], data.paperRisk); renderFunnel(data.funnel); renderPools(data.pools);
  if (selectedCityId && !data.cities.some(city => city.cityId === selectedCityId)) selectedCityId = null;
  renderCities(); renderLinkedPanels();
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

async function refresh() {
  try {
    render(await loadDashboardPayload());
  } catch (error) {
    byId("healthLabel").textContent = "OFFLINE";
    byId("freshness").textContent = error.message;
    byId("systemState").classList.remove("online");
  }
}

if (typeof document !== "undefined") {
  byId("citySearch").addEventListener("input", renderCities);
  byId("poolFilter").addEventListener("change", renderCities);
  byId("clearCityFilter").addEventListener("click", clearCityFilter);
  setInterval(() => byId("clock").textContent = new Date().toLocaleTimeString("zh-CN", {hour12:false}), 1000);
  refresh(); setInterval(refresh, 15000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {fetchDashboardJson, isDashboardPayload, loadDashboardPayload, refresh, renderReservedPlans};
}
