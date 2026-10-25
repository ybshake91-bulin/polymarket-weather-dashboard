'use strict';
(function(){
  let lastGood,loading=false;
  const byId=id=>document.getElementById(id);
  const valid=x=>x?.schemaVersion==='wap.profit-view/1.0' && Array.isArray(x.rows) && Array.isArray(x.sessions) && x.evaluation && x.risk;
  async function read(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok||!/json/i.test(r.headers.get('content-type')||''))throw Error('unavailable');const x=await r.json();if(!valid(x))throw Error('shape');return x;}
  async function refresh(){
    if(loading)return;loading=true;
    try{
      let x;try{x=await read(`./data/profit-current.json?v=${Date.now()}`);}catch{x=await read('/api/profit');}
      lastGood=x;byId('loadError').textContent='';window.WapProfit.render(x);
      const age=(Date.now()-Date.parse(x.generatedAt))/1000;
      byId('dataHealth').textContent=age<0||age>600?'数据快照已过期':x.collector?.status==='RUNNING'&&x.collector?.ageSeconds>=0&&x.collector?.ageSeconds<=600?'新策略采集正在上报':'采集状态待核验';
      byId('snapshotTime').textContent='快照 '+new Date(x.generatedAt).toLocaleString('zh-CN',{hour12:false});
    }catch{
      byId('loadError').textContent='新策略数据读取失败。'+(lastGood?'保留最后可见记录，请核对快照时间。':'暂不判断收益与运行状态。');
      byId('dataHealth').textContent='新策略数据暂不可读';window.WapProfit.render(lastGood||{status:'UNAVAILABLE',rows:[]});
    }finally{loading=false;}
  }
  refresh();setInterval(refresh,30000);
})();
