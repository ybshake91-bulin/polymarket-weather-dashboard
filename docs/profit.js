/* Saved evidence only: this UI never constructs a trade or sends an order. */
(function () {
  'use strict';
  let current, shown, account, selected = '', query = '', requestedDate = '', generation = 0;
  const $ = id => document.getElementById(id);
  const e = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = (x, digits = 2) => x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('zh-CN', {maximumFractionDigits:digits, minimumFractionDigits:digits});
  const p = x => x == null ? '—' : n(x * 100, 1) + '%';
  const stamp = x => x ? e(String(x).replace('T',' ').replace('+00:00',' UTC')) : '未记录';
  const key = r => [r.city,r.date,r.session].join('|');
  const session = s => s.slice(0,2) + ':' + s.slice(2);
  const names = {WAITING:'待窗口',COLLECTING:'采集中',NO_SIGNAL:'未采得',SIGNAL_RECORDED:'等待后续盘口',SIMULATED_FILL:'模拟成交',ABSTAIN:'不交易',NO_FILL:'未成交',EVIDENCE_INVALID:'证据异常',PRE_ACTIVATION:'尚未启用'};
  const status = r => names[r.status] || '状态待核验';
  const tone = r => ({SIMULATED_FILL:'good',EVIDENCE_INVALID:'bad',NO_SIGNAL:'warn',COLLECTING:'active',SIGNAL_RECORDED:'active'}[r.status] || 'quiet');
  const box = (name,value,note,cls='') => `<article class="pf-card ${cls}"><span>${e(name)}</span><strong>${e(value)}</strong><small>${e(note)}</small></article>`;
  const field = (name,value) => `<div><dt>${e(name)}</dt><dd>${e(value ?? '未记录')}</dd></div>`;
  const stale = view => !view?.generatedAt || !Number.isFinite(Date.parse(view.generatedAt)) || Date.now()-Date.parse(view.generatedAt)>600000 || Date.parse(view.generatedAt)-Date.now()>60000;
  function paint() {
    if (!$('profitOverview')) return;
    const v = current, r = shown || v;
    if (!v || v.status === 'UNAVAILABLE' || !Array.isArray(v.rows)) {
      $('profitOverview').innerHTML = '<div class="pf-warning">新策略证据暂不可读。收益、验证进度与采集状态暂不判断。</div>';
      $('profitMatrix').innerHTML=''; $('profitDetail').innerHTML=''; return;
    }
    const ev = v.evaluation || {}, risk = v.risk || {}, note = v.notifications || {};
    const outdated = stale(v), ready = !outdated && ev.reviewReady === true;
    const hasSettlements = Number(ev.settled_session_observations)>0;
    $('profitOverview').innerHTML = `<div class="pf-state"><b>${ready?'证据达到人工复核门槛':'新策略 · 前向模拟验证中'}</b><span>原策略新增仓位：${v.legacyHold?'已暂停':'状态待核验'}</span><span>真实交易：关闭</span></div>
      <div class="pf-money">${box('旧系统 · 历史模拟累计收益',account?.available ? n(account.cumPnlU)+'u':'待账户数据','独立账本；包含历史不同版本','legacy')}${box('新策略 · 模拟净收益',hasSettlements?n(ev.net_pnl)+'u':'尚无已结算样本',ev.fresh&&!outdated?'已计手续费与滑点压力':'报告或网页快照已过期，请勿视为当前结果','candidate')}${box('真实资金交易','未启用','本页没有下单入口；不会自动升级')}</div>
      ${outdated?'<div class="pf-warning">网页快照已超过 10 分钟或时间异常。以下是最后可见记录，不能据此判断当前运行状态。</div>':''}
      ${(v.issues||[]).length?`<div class="pf-warning">${v.issues.map(x=>e(x.message)).join('；')}</div>`:''}
      ${v.storageRepair?.repairedAt?`<div class="pf-note">已修复记录目录权限：${stamp(v.storageRepair.repairedAt)}。修复前错过的窗口保留为缺失，不补写前向样本。</div>`:''}
      <div class="pf-two"><div><h3>盈利验证门槛 <span>${ready?'待人工复核':'尚未通过'}</span></h3><div class="pf-progress">${(ev.progress||[]).map(x=>`<div><label>${e(x.label)} <b>${e(x.current??'—')} / ${e(x.required)}</b></label><progress max="${e(x.required)}" value="${e(x.current||0)}"></progress></div>`).join('')}</div><ul class="pf-checks">${(ev.conditions||[]).map(x=>`<li class="${x.pass&&!outdated?'good':'quiet'}">${x.pass&&!outdated?'✓':'○'} ${e(x.label)}</li>`).join('')}</ul><p class="pf-note">压力净收益 ${n(ev.pair_failure_stressed_net_pnl)}u · 日期重采样 95% 下界 ${n(ev.day_cluster_95pct_lower_pnl)}u · 日末压力回撤 ${n(ev.drawdown_u)}u。样本与门槛均为累计值，不随下方日期筛选变化。</p></div>
      <div><h3>模拟风险预算与运行状态</h3><dl class="pf-facts">${field('UTC 日预算',`${risk.utcDate||'—'} · 已用 ${n(risk.spent)} / ${n(risk.limit)}u`)}${field('UTC 日剩余',risk.verified&&!outdated?n(risk.remaining)+'u':'待核验')}${field('城市当地日上限',`${n(risk.cityDayLimit)}u；最多一次模拟成交`)}${field('采集状态',outdated?'快照过期':v.collector?.status==='RUNNING'&&v.collector?.ageSeconds>=0&&v.collector?.ageSeconds<=600?'正在上报': '上报缺失或异常')}${field('采集最近上报',v.collector?.at)}${field('验证报告时间',ev.evaluated_at)}${field('网页数据时间',v.generatedAt)}</dl></div></div>
      <details class="pf-fold"><summary>策略规则、各时段验证成绩与飞书通知</summary><p>09:30、12:00 使用独立时段的市场相对概率模型；15:00、17:00 尚未训练天气模型，先采集市场基线，不产生候选交易。候选包括单档 YES、NO 和相邻两档 YES。只读取保存下来的动作。</p><p>概率扣减 ${p(v.policy?.probability_haircut)}；最低净优势 ${p(v.policy?.minimum_edge)}；最低预期收益率 ${p(v.policy?.minimum_roi)}；价差上限 ${p(v.policy?.max_spread)}；最少 ${e(v.policy?.min_shares)} 股。费用压力率至少 ${p(v.policy?.fee_rate_floor)}，按每腿 p×(1−p) 计费；滑点压力每股每腿 ${n(v.policy?.slippage_per_share,3)}u。后续盘口须在 5–120 秒内，沿用原限价与数量。</p>
      <div class="pf-scroll"><table><thead><tr><th>时段</th><th>结算观察数</th><th>模拟净收益</th><th>新模型 Brier</th><th>市场 Brier</th><th>原 V6 Brier</th></tr></thead><tbody>${v.sessions.map(s=>{const z=ev.by_session?.[s];return `<tr><td>${session(s)}</td><td>${e(z?.observations??0)}</td><td>${z?n(z.net_pnl)+'u':'待结算'}</td><td>${n(z?.scores?.brier,4)}</td><td>${n(z?.market_scores?.brier,4)}</td><td>${n(z?.baseline_scores?.brier,4)}</td></tr>`;}).join('')}</tbody></table></div><p class="pf-note">Brier 越低越好。按时段独立比较；下午市场基线不代表已训练好新模型。</p>
      <dl class="pf-facts">${field('飞书验证通知',note.status==='ACTIVE'?'已接入；状态变化时通知':note.status==='RETRY_PENDING'?'发送待确认／重试中':note.status==='DELIVERY_UNCONFIRMED'?'有通知未获平台确认；已停止自动重试':'尚未接入或状态不可读')}${field('已确认通知',note.acked??0)}${field('最近确认',note.lastAckAt||'暂无平台确认')}${field('通知状态更新时间',note.checkedAt||'尚未记录')}</dl><p class="pf-note">首次启动只记录基线；采集异常、官方结算变化、达到复核门槛才通知。去重并限制频率。发送失败不会显示为“已送达”。</p></details>`;
    if (!Array.isArray(r?.rows)) { $('profitMatrix').innerHTML='<p class="pf-warning">历史日期数据不可读。</p>';return; }
    const rows = r.rows.filter(x=>(x.city+' '+x.cityName+' '+x.station+' '+x.timezone).toLowerCase().includes(query.toLowerCase()));
    const groups = new Map(); for(const row of rows){if(!groups.has(row.city))groups.set(row.city,[]);groups.get(row.city).push(row);}
    $('profitDateLabel').textContent = requestedDate ? `合约当地日 ${requestedDate} · ${groups.size} 个城市` : `各城市当地今天 · ${groups.size} 个城市`;
    $('profitMatrix').innerHTML = `<div class="pf-scroll"><table class="pf-matrix"><thead><tr><th>城市 / 合约当地日</th>${v.sessions.map(s=>`<th>${session(s)}<small>${['0930','1200'].includes(s)?'候选模型':'采集评分'}</small></th>`).join('')}</tr></thead><tbody>${[...groups.values()].map(group=>`<tr><th>${e(group[0].cityName)}<small>${e(group[0].station)} · ${e(group[0].date)}</small></th>${v.sessions.map(s=>{const row=group.find(x=>x.session===s);return `<td>${row?`<button type="button" class="pf-cell ${tone(row)} ${key(row)===selected?'selected':''}" data-profit-row="${e(key(row))}" aria-pressed="${key(row)===selected}"><b>${e(status(row))}</b><small>${e(row.reasonText)}</small></button>`:'—'}</td>`;}).join('')}</tr>`).join('') || '<tr><td colspan="5">没有匹配城市。</td></tr>'}</tbody></table></div>`;
    const row = r.rows.find(x=>key(x)===selected) || rows.find(x=>x.probabilities?.length) || rows[0];
    if(row){selected=key(row);detail(row,r);}else $('profitDetail').innerHTML='<p>请选择城市与时段。</p>';
  }
  function detail(r,v) {
    const a=r.action,ex=r.execution,ev=r.evidence||{},s=r.settlement,spent=v.risk?.cityDaySpent?.[r.city+'|'+r.date]??v.cityDaySpent?.[r.city+'|'+r.date];
    $('profitDetail').innerHTML=`<header><p class="kicker">SAVED EVIDENCE</p><h3>${e(r.cityName)} · ${session(r.session)}</h3><p>${e(r.date)} · ${e(r.timezone)} · ${e(r.station)}</p><span class="pf-tag ${tone(r)}">${e(status(r))}</span></header><p>${e(r.reasonText)}</p>
      <dl class="pf-facts">${field('本时段模型',r.family||'尚未可用')}${field('动作权限',r.tradeEnabled?'允许候选模拟动作':'仅采集评分')}${field('该城市日已模拟使用',spent==null?'无已核验成交':n(spent)+'u / 10.00u')}${field('最近采集尝试',r.lastAttemptAt)}${field('天气生成时间',ev.weatherGeneratedAt)}${field('天气接收时间',r.weatherReceivedAt)}${field('信号时间',r.signalAt)}${field('行情时间',ev.marketCapturedAt)}</dl>
      <h4>档位概率对照</h4>${r.probabilities?.length?`<div class="pf-scroll"><table><thead><tr><th>档位</th><th>原 V6</th><th>市场</th><th>${r.tradeEnabled?'新模型':'市场基线'}</th></tr></thead><tbody>${r.probabilities.map(x=>`<tr><td>${e(x.bucket)}</td><td>${p(x.weather)}</td><td>${p(x.market)}</td><td><b>${p(x.candidate)}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="pf-note">没有合格保存记录；不使用当前行情补算历史概率。</p>'}
      <h4>候选动作与成本</h4>${a?`<p>${a.legs.map(([b,side])=>e(b)+' '+e(side)).join(' + ')}</p><dl class="pf-facts">${field('原始 / 保守获胜概率',p(a.probability)+' / '+p(a.conservative_probability))}${field('每股净优势 / 预期收益率',p(a.edge)+' / '+p(a.roi))}${field('拟模拟数量',n(a.shares,4)+' 股')}${field('含费用与滑点的拟成本',n(a.cost,4)+'u')}${field('费用 / 滑点压力',n(a.fee,4)+'u / '+n(a.slippage,4)+'u')}${field('各腿限价',(a.limits||[]).map(x=>n(x,4)).join(' / '))}</dl>`:'<p class="pf-note">未保存候选动作。本时段未满足交易条件或尚无合格信号。</p>'}
      <h4>后续盘口与模拟成交</h4>${ex?`<dl class="pf-facts">${field('后续盘口延迟',n(ex.delay_seconds,1)+' 秒')}${field('模拟数量 / 总成本',n(ex.shares,4)+' 股 / '+n(ex.cost,4)+'u')}${field('费用 / 滑点压力',n(ex.fee,4)+'u / '+n(ex.slippage,4)+'u')}${field('后续盘口时间',ev.delayedMarketAt)}</dl>${(r.books||[]).map(b=>`<details class="pf-fold"><summary>${e(b.bucket)} ${e(b.side)} · 保存的卖盘深度</summary><p class="pf-note">初始：${stamp(b.initialAt)}<br>后续：${stamp(b.delayedAt)}；最多显示各 20 档。</p><div class="pf-scroll"><table><thead><tr><th>初始价格</th><th>股数</th><th>后续价格</th><th>股数</th></tr></thead><tbody>${Array.from({length:Math.max(b.initialAsks.length,b.delayedAsks.length)},(_,i)=>`<tr><td>${n(b.initialAsks[i]?.price,4)}</td><td>${n(b.initialAsks[i]?.shares,2)}</td><td>${n(b.delayedAsks[i]?.price,4)}</td><td>${n(b.delayedAsks[i]?.shares,2)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}`:'<p class="pf-note">没有已核验模拟成交；不会记作真实成交。</p>'}
      <h4>官方结算与收益</h4>${s?`<dl class="pf-facts">${field('获胜档位',s.official?.bucket||'官方凭据待核验')}${field('模拟净收益 / 双腿失败压力',n(s.net_pnl)+'u / '+n(s.net_pnl_pair_failure_stress)+'u')}${field('结算来源',s.official?.authority)}${field('官方证据时间',s.official?.capturedAt)}${field('新模型 / 市场 Brier',n(s.scores?.brier,4)+' / '+n(s.market_scores?.brier,4))}</dl>`:'<p class="pf-note">尚未进入官方结算报告；没有结算收益结论。</p>'}
      <details class="pf-fold"><summary>证据身份与校验摘要</summary><dl class="pf-facts pf-hashes">${field('事件 ID',ev.eventId)}${field('合约 ID',ev.conditionId)}${field('规则摘要',ev.rulesHash)}${field('信号摘要',ev.signalHash)}${field('模型文件摘要',ev.modelHash)}${field('代码摘要 · 模型',ev.codeIdentity?.model)}${field('代码摘要 · 采集',ev.codeIdentity?.capture)}${field('持久化回执时间',ev.durableAt)}${field('成交记录摘要',ev.fillHash)}${field('官方结算摘要',s?.official?.sha256)}</dl></details>`;
  }
  async function json(url) { const res=await fetch(url,{cache:'no-store'});if(!res.ok||!(/json/i.test(res.headers.get('content-type')||'')))throw Error('unavailable');return res.json(); }
  async function loadDate() {
    const ticket=++generation;
    if(!requestedDate){shown=current;paint();return;}
    $('profitMatrix').innerHTML='<p class="pf-note">正在读取指定日期的保存证据…</p>';
    $('profitDetail').innerHTML='';
    try {
      let result;
      try { result=await json(`./data/profit/${encodeURIComponent(requestedDate)}.json?v=${Date.now()}`); }
      catch { result=await json(`/api/profit?date=${encodeURIComponent(requestedDate)}`); }
      if(ticket!==generation)return;
      if(result.selectedDate!==requestedDate || !Array.isArray(result.rows))throw Error('identity');
      shown=result;paint();
    } catch {if(ticket===generation){shown={rows:[]};$('profitMatrix').innerHTML='<div class="pf-warning">该日期没有可用的已发布证据，或数据暂不可读。未计作零收益。</div>';}}
  }
  window.WapProfit={render(view,oldAccount){account=oldAccount;current=view;if(!requestedDate){shown=view;paint();}else loadDate();},delivery(city,view){const key=city.latestEvaluation?.decisionKey;return key&&view?.legacyNotifications?.acknowledgements?.[key]?.status==='ACKED';}};
  document.addEventListener('click',event=>{const button=event.target.closest('[data-profit-row]');if(button){selected=button.dataset.profitRow;paint();}if(event.target.closest('#profitToday')){$('profitDate').value='';requestedDate='';loadDate();}});
  document.addEventListener('input',event=>{if(event.target.id==='profitSearch'){query=event.target.value;paint();}});
  document.addEventListener('change',event=>{if(event.target.id==='profitDate'){requestedDate=event.target.value;selected='';loadDate();}});
})();
