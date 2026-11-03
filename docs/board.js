'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=x=>x==null?'—':Math.round(x*100)+'%';
  const u=(x,d=0)=>x==null?'—':(x>0?'+':'')+Number(x).toFixed(d);
  const k=(name,val,note,cls='')=>`<div class="k"><small>${e(name)}</small><strong class="${cls}">${val}</strong><i>${e(note)}</i></div>`;
  let last;
  function render(x){
    const t=x.today||{},a=x.account||{},h=x.hitRate||{},s=x.shadows||{};
    $('meta').textContent=`${x.businessDate||''} · 模拟盘 · 规则 ${x.rule||'—'}`;
    $('age').textContent='更新 '+new Date(x.generatedAt).toLocaleTimeString('zh-CN',{hour12:false});
    const mp=a.monthPnlU||0;
    $('kpis').innerHTML=[
      k('今日进度',`${t.done||0}/${t.cities||0}`,`进行中 ${t.live||0} · 未开始 ${t.waiting||0}`),
      k('今日下单',`${t.orders||0}`,`有正收益未下 ${t.positiveBlocked||0}`+(t.anomalies?` · 异常 ${t.anomalies}`:''),t.orders?'pos':''),
      k('本月盈亏',`${u(mp,1)}u`,`目标 ${a.monthTargetU||500}u · ${a.monthTrades||0} 笔`,mp>0?'pos':mp<0?'neg':''),
      k('近7天双档命中',pct(h.d7&&h.d7.rate),`正式城 ${pct(h.d7Formal&&h.d7Formal.rate)} · 30天 ${pct(h.d30&&h.d30.rate)}`),
      k('影子(认可允许分歧)',`${(s.agree||{}).n||0} 笔`,`盈亏 ${u((s.agree||{}).pnlU,1)}u · 待结算 ${(s.agree||{}).pending||0}`),
    ].join('');
    $('grid').innerHTML=(x.rows||[]).map(r=>{
      const pair=r.pair&&r.pair.length?r.pair.join('/')+r.unit:'—';
      const obs=r.observed==null?'—':r.observed+r.unit;
      const llm=r.llm?(r.llm.action+(r.llm.divergence?'·分歧':'')):'—';
      const hit=r.yesterday==null?'':`<span class="hit ${r.yesterday?'y':'n'}">昨${r.yesterday?'中':'未中'}</span>`;
      const dc=r.tone==='push'?'p':(r.decision==='—'||r.decision==='无正收益')?'x':'';
      const pnl=r.pnl!=null?` <span class="${r.pnl>=0?'pos':'neg'}">${u(r.pnl,1)}u</span>`:'';
      return `<div class="c ${e(r.tone)}"><div class="h"><b>${e(r.name)}<span class="tag ${r.pool==='正式'?'f':''}">${e(r.pool)}</span></b><span>${e(r.windowBj)} ${hit}</span></div>`+
        `<div class="r"><span>预测</span>${e(pair)} ${r.prob!=null?'<span>'+pct(r.prob)+'</span>':''}</div>`+
        `<div class="r"><span>实测</span>${e(obs)}<span>LLM</span>${e(llm)}</div>`+
        `<div class="d ${dc}">${e(r.decision)}${pnl}</div></div>`;
    }).join('');
  }
  async function refresh(){
    try{
      let x;
      try{const r=await fetch('/api/board',{cache:'no-store'});if(!r.ok)throw 0;x=await r.json();}
      catch{const r=await fetch('./data/board-current.json?v='+Date.now(),{cache:'no-store'});x=await r.json();}
      if(!x||!Array.isArray(x.rows)||x.status==='UNAVAILABLE')throw 0;
      last=x;render(x);
    }catch{ $('age').textContent=last?'读取失败，显示上次数据':'数据暂不可读'; if(last)render(last); }
  }
  refresh();setInterval(refresh,30000);
})();
