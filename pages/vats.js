import { layout } from "./layout.js";

// 缸位放行页：展示各缸位的放行状态、三项复检明细与上一批次信息。
export function vatsPage() {
  return layout({
    active: "/vats",
    title: "缸位放行状态",
    subtitle: "三项通过才放行；放行超过半天没投料建档须重新复检",
    body: `
  <main>
    <div class="panel" style="margin-bottom:14px">
      <h2>放行口径</h2>
      <div class="meta">
        复检放行单三项：冲洗不少于 3 遍、残水 pH 在 6.5～7.5 之间、缸壁无霉点。三项全过缸位方可接料；
        放行后半天（12 小时）内未在「发酵批次」建档投料，放行自动失效，需重新复检；建档后放行单即被占用。
      </div>
    </div>
    <div class="grid" id="cards"><div class="meta">加载中…</div></div>
  </main>
  <script>
    const checkLabels = { rinse:"冲洗遍数", ph:"残水酸碱度", mold:"霉点" };
    const cards = document.querySelector('#cards');
    async function api(path){ const res = await fetch(path); const data = await res.json(); if(!res.ok) throw new Error(data.error||'请求失败'); return data; }
    function fmtAt(v){ if(!v) return '—'; const d=new Date(v),p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
    function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function describe(st) {
      if (st.key === 'released') return '缸位可投料，放行有效期至 ' + fmtAt(st.expiresAt) + '；超半天未投料须重新复检。';
      if (st.key === 'expired') return '放行已超过半天仍未投料，建档前须重新复检。';
      if (st.key === 'rejected') return '未通过项：' + (st.failed.length ? st.failed.join('、') : '—') + '；原批次内容照旧保留。';
      if (st.key === 'occupied') return '放行单已被新批次占用。';
      return '尚无复检记录，投料前须先复检。';
    }
    function cardHtml(vat) {
      const st = vat.statusInfo;
      const rec = st.inspection;
      const checksHtml = rec ? Object.keys(checkLabels).map(k =>
        '<div class="rowline"><span>'+checkLabels[k]+'</span><span class="'+(rec.checks[k]?'tag-pass':'tag-fail')+'">'+
        (k==='rinse' ? esc(rec.rinseTimes)+' 遍' : k==='ph' ? 'pH '+esc(rec.residualPh) : esc(rec.moldResult)+'霉点') +
        (rec.checks[k] ? ' 合格' : ' 未过') + '</span></div>').join('') : '<div class="meta">尚无复检记录</div>';
      const cls = st.key === 'released' ? 'ok' : (st.key === 'rejected' ? 'bad' : (st.key === 'expired' ? 'warnline' : ''));
      const last = vat.lastItem ? '<div class="meta">上一批次：'+esc(vat.lastItem.code)+' · '+esc(vat.lastItem.source||'')+' · '+esc(vat.lastItem.status||'')+'</div>' : '<div class="meta">上一批次：无登记记录</div>';
      return '<article class="card"><div class="rowline"><h3>'+esc(vat.name)+'</h3><span class="pill '+(st.usable?'ok':'bad')+'">'+esc(st.label)+'</span></div>'+
        '<div class="meta">'+esc(vat.location||'')+'</div>'+last+
        '<div class="banner '+cls+'" style="padding:10px"><p>'+describe(st)+'</p>'+(rec?'<div class="meta" style="margin-top:6px">复检时间：'+fmtAt(rec.at)+(rec.note?'；备注：'+esc(rec.note):'')+'</div>':'')+'</div>'+
        checksHtml+
        '<a href="/inspections"><button type="button" class="secondary" style="width:100%">'+(rec?'重新复检':'去复检')+'</button></a>'+
        '<a href="/"><button type="button" style="width:100%">去建档投料</button></a></article>';
    }
    async function load(){
      const vats = await api('/api/vats');
      cards.innerHTML = vats.map(cardHtml).join('');
    }
    load();
    setInterval(load, 60000);
  </script>` });
}
