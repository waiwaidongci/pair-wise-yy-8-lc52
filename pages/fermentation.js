import { layout } from "./layout.js";

// 发酵批次页：建档入口。选缸必须持有效放行单（三项通过且未超半天），未放行时保留原批次内容并说明未过项。
export function fermentationPage() {
  return layout({
    active: "",
    title: "古法纸浆发酵记录",
    subtitle: "纸浆批次、浸泡缸、换水和异常观察；空缸凭复检放行单接下一批料",
    body: `
  <main class="two-col">
    <section>
      <form id="createForm" class="panel">
        <h2>新增纸浆批次（建档）</h2>
        <div id="fields"></div>
        <label>浸泡缸（凭有效放行单）</label>
        <select name="vatId" id="vatSelect"><option value="">请选择缸位</option></select>
        <div id="vatBanner"></div>
        <label>初始状态</label>
        <select name="status"><option>入缸</option><option>发酵中</option><option>可抄纸</option><option>异常观察</option></select>
        <button id="submitBtn" disabled>保存纸浆批次</button>
        <div id="formError"></div>
      </form>
      <form id="actionForm" class="panel" style="margin-top:14px">
        <h2>每日观察记录</h2>
        <label>选择纸浆批次</label>
        <select name="id" id="itemSelect"></select>
        <div id="extraFields"></div>
        <button>提交记录</button>
      </form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar">
        <select id="statusFilter"><option value="">全部状态</option><option>入缸</option><option>发酵中</option><option>可抄纸</option><option>异常观察</option></select>
        <input id="search" placeholder="搜索编号或关键词">
      </div>
      <div class="panel">
        <h2>每天记录温度、气味、纤维状态和换水情况，系统统计发酵进度与异常次数。</h2>
        <div class="grid" id="cards"></div>
      </div>
    </section>
  </main>
  <script>
    const fields = [["code","批次编号","text"],["source","原料来源","text"],["days","发酵天数","number"],["owner","负责人","text"]];
    const stages = ["入缸","发酵中","可抄纸","异常观察"];
    const extraFields = [["temperature","温度"],["smell","气味状态"],["fiber","纤维松散度"],["changedWater","是否换水"],["abnormal","异味或霉点"]];
    const checkLabels = { rinse:"冲洗遍数", ph:"残水酸碱度", mold:"霉点" };
    const createForm = document.querySelector('#createForm');
    const actionForm = document.querySelector('#actionForm');
    const cards = document.querySelector('#cards');
    const statsEl = document.querySelector('#stats');
    const itemSelect = document.querySelector('#itemSelect');
    const vatSelect = document.querySelector('#vatSelect');
    const vatBanner = document.querySelector('#vatBanner');
    const submitBtn = document.querySelector('#submitBtn');
    const formError = document.querySelector('#formError');
    let items = [], vats = [], vatMap = {}, statusMap = {};
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ 'Content-Type':'application/json' } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }
    function fmtAt(v){ if(!v) return '—'; const d=new Date(v),p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
    function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function renderForms() {
      document.querySelector('#fields').innerHTML = fields.map(([key,label,type]) => '<label>'+label+'</label><input name="'+key+'" type="'+type+'" '+(key==='code'?'required':'')+'>').join('');
      document.querySelector('#extraFields').innerHTML = extraFields.map(([key,label]) => '<label>'+label+'</label><input name="'+key+'">').join('');
    }
    function renderVatOptions() {
      const current = vatSelect.value;
      vatSelect.innerHTML = '<option value="">请选择缸位</option>' + vats.map(v => '<option value="'+v.id+'">'+esc(v.name)+' · '+esc(v.location||'')+' · '+esc(statusMap[v.id].label)+'</option>').join('');
      if ([...vatSelect.options].some(o => o.value === current)) vatSelect.value = current;
      renderVatBanner();
    }
    function describe(st) {
      if (st.key === 'released') return '复检三项通过，缸位可投料；放行有效期至 ' + fmtAt(st.expiresAt) + '，超半天未投料须重新复检。';
      if (st.key === 'expired') return '放行已超过半天仍未投料，建档前须到「复检记录」重新复检。';
      if (st.key === 'rejected') return '复检未通过项：' + (st.failed.length ? st.failed.join('、') : '—') + '。未放行，缸内原批次内容照旧保留。';
      if (st.key === 'occupied') return '该放行单已被新批次占用。';
      return '尚无复检记录，投料前须先到「复检记录」做复检放行。';
    }
    function renderVatBanner() {
      const id = vatSelect.value;
      if (!id) { vatBanner.innerHTML = ''; submitBtn.disabled = true; return; }
      const st = statusMap[id];
      const cls = st.key === 'released' ? 'ok' : (st.key === 'rejected' ? 'bad' : 'warnline');
      const checks = st.inspection && st.inspection.checks;
      const rows = checks ? '<div class="meta">最近复检 ' + fmtAt(st.inspection.at) + '：' +
        Object.keys(checkLabels).map(k => esc(checkLabels[k]) + (checks[k] ? '<span class="tag-pass"> 合格</span>' : '<span class="tag-fail"> 未过</span>')).join('　') + '</div>' : '';
      vatBanner.innerHTML = '<div class="banner ' + cls + '"><span class="pill ' + (st.usable ? 'ok' : 'bad') + '">' + esc(st.label) + '</span><p>' + describe(st) + '</p>' + rows + '</div>';
      submitBtn.disabled = !st.usable;
    }
    function render() {
      itemSelect.innerHTML = items.map(item => '<option value="'+(item.id || item.code)+'">'+esc(item.code || item.id)+' · '+esc(item.source || '')+'</option>').join('');
      const stats = Object.fromEntries(stages.map(s => [s, items.filter(i => i.status === s).length]));
      statsEl.innerHTML = Object.entries(stats).map(([k,v]) => '<div class="stat"><span>'+k+'</span><strong>'+v+'</strong></div>').join('');
      const status = document.querySelector('#statusFilter').value;
      const q = document.querySelector('#search').value.trim();
      const visible = items.filter(item => (!status || item.status === status) && (!q || JSON.stringify(item).includes(q)));
      cards.innerHTML = visible.map(item => cardHtml(item)).join('');
      document.querySelectorAll('[data-status]').forEach(sel => sel.onchange = async () => { await api('/api/items/'+sel.dataset.status, { method:'PATCH', body: JSON.stringify({ status: sel.value }) }); await load(); });
      document.querySelectorAll('[data-note]').forEach(btn => btn.onclick = async () => { const id = btn.dataset.note; const note = prompt('记录备注'); if (note) { await api('/api/items/'+id+'/logs', { method:'POST', body: JSON.stringify({ step:'备注', note }) }); await load(); } });
    }
    function cardHtml(item) {
      const main = fields.slice(0,3).map(([key,label]) => '<div><b>'+label+'</b> '+esc(item[key])+'</div>').join('');
      const vat = vatMap[item.vatId];
      const vatLine = '<div><b>浸泡缸</b> ' + esc(vat ? vat.name : (item.vat || '—')) + '</div>';
      const logs = (item.logs || []).slice(-4).map(l => '<div>'+esc(l.step)+'：'+esc(l.note)+'</div>').join('');
      return '<article class="card"><h3>'+esc(item.code || item.id)+'</h3><span class="pill">'+esc(item.status)+'</span>'+main+vatLine+'<label>状态</label><select data-status="'+(item.id || item.code)+'">'+stages.map(s => '<option '+(s===item.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="secondary" data-note="'+(item.id || item.code)+'">追加备注</button><div class="logs meta">'+(logs || '暂无记录')+'</div></article>';
    }
    async function load() {
      [items, vats] = await Promise.all([api('/api/items'), api('/api/vats')]);
      vatMap = Object.fromEntries(vats.map(v => [v.id, v]));
      statusMap = Object.fromEntries(vats.map(v => [v.id, v.statusInfo]));
      renderVatOptions();
      render();
    }
    vatSelect.onchange = renderVatBanner;
    createForm.onsubmit = async event => {
      event.preventDefault();
      formError.textContent = '';
      const data = Object.fromEntries(new FormData(createForm).entries());
      try {
        await api('/api/items', { method:'POST', body: JSON.stringify(data) });
        createForm.reset();
        await load();
      } catch (err) {
        formError.textContent = err.message === 'vat_not_released' ? '该缸未放行或放行已过期，不能建档，原批次内容保留。' : err.message;
      }
    };
    actionForm.onsubmit = async event => { event.preventDefault(); await api('/api/items/'+itemSelect.value+'/action', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(actionForm).entries())) }); actionForm.reset(); await load(); };
    document.querySelector('#statusFilter').onchange = render; document.querySelector('#search').oninput = render;
    renderForms(); load();
  </script>` });
}
