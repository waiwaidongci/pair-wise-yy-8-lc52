import { layout } from "./layout.js";

// 复检记录页：复检放行单。登记冲洗遍数、残水酸碱度、霉点，三项通过才放行；放行超半天未投料须重新复检。
export function inspectionPage() {
  return layout({
    active: "/inspections",
    title: "空缸复检放行单",
    subtitle: "空缸交下一批料前，逐项登记冲洗、残水与霉点；三项通过缸位才放行",
    body: `
  <main class="two-col">
    <section>
      <form id="inspectForm" class="panel">
        <h2>复检放行单</h2>
        <label>缸位</label>
        <select name="vatId" id="vatSelect"><option value="">请选择缸位</option></select>
        <div id="vatContext" class="meta" style="margin-top:6px"></div>
        <label>冲洗遍数（不少于3遍合格）</label>
        <input name="rinseTimes" type="number" min="0" step="1" required placeholder="例：3">
        <label>残水酸碱度 pH（6.5～7.5 合格）</label>
        <input name="residualPh" type="number" min="0" max="14" step="0.1" required placeholder="例：7.0">
        <label>缸壁霉点（无霉点合格）</label>
        <select name="moldResult" required>
          <option value="">请选择</option>
          <option value="无">无霉点</option>
          <option value="有">有霉点（需处理后复检）</option>
        </select>
        <label>上次异常备注（残料、异味等风险交代）</label>
        <textarea name="note" placeholder="口头交接的风险在此留底，例如缸壁残料、上次异常观察情况"></textarea>
        <div style="margin-top:10px">
          <span class="pill">冲洗≥3遍</span> <span class="pill">pH 6.5–7.5</span> <span class="pill">无霉点</span>
          <div class="meta" style="margin-top:6px">三项全部通过才放行；放行后超过半天（12小时）未投料建档，须重新复检。</div>
        </div>
        <button style="margin-top:12px">提交复检</button>
        <div id="formError"></div>
      </form>
    </section>
    <section>
      <div class="panel">
        <h2>复检记录</h2>
        <table>
          <thead><tr><th>时间</th><th>缸位</th><th>冲洗遍数</th><th>残水pH</th><th>霉点</th><th>结果</th><th>未过项 / 备注</th></tr></thead>
          <tbody id="rows"><tr><td colspan="7" class="meta">加载中…</td></tr></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const checkLabels = { rinse:"冲洗遍数", ph:"残水酸碱度", mold:"霉点" };
    const form = document.querySelector('#inspectForm');
    const vatSelect = document.querySelector('#vatSelect');
    const vatContext = document.querySelector('#vatContext');
    const rows = document.querySelector('#rows');
    const formError = document.querySelector('#formError');
    let vats = [], inspections = [], vatMap = {}, statusMap = {};
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ 'Content-Type':'application/json' } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }
    function fmtAt(v){ const d=new Date(v),p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
    function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function failedOf(rec){ return Object.keys(checkLabels).filter(k => !rec.checks[k]).map(k => checkLabels[k]); }
    function renderVats() {
      const current = vatSelect.value;
      vatSelect.innerHTML = '<option value="">请选择缸位</option>' + vats.map(v => '<option value="'+v.id+'">'+esc(v.name)+' · '+esc(v.location||'')+' · '+esc(statusMap[v.id].label)+'</option>').join('');
      if ([...vatSelect.options].some(o => o.value === current)) vatSelect.value = current;
      renderContext();
    }
    function renderContext() {
      const st = statusMap[vatSelect.value];
      vatContext.textContent = st ? ('当前：' + st.label + (st.inspection ? '（最近复检 ' + fmtAt(st.inspection.at) + '）' : '')) : '';
    }
    function renderRows() {
      if (!inspections.length) { rows.innerHTML = '<tr><td colspan="7" class="meta">暂无复检记录</td></tr>'; return; }
      rows.innerHTML = inspections.map(rec => {
        const vat = vatMap[rec.vatId];
        const failed = failedOf(rec);
        return '<tr><td>'+fmtAt(rec.at)+'</td><td>'+esc(vat ? vat.name : rec.vatId)+'</td>'+
          '<td class="'+(rec.checks.rinse?'tag-pass':'tag-fail')+'">'+esc(rec.rinseTimes)+' 遍</td>'+
          '<td class="'+(rec.checks.ph?'tag-pass':'tag-fail')+'">'+esc(rec.residualPh)+'</td>'+
          '<td class="'+(rec.checks.mold?'tag-pass':'tag-fail')+'">'+esc(rec.moldResult)+'</td>'+
          '<td>'+(rec.passed ? '<span class="pill ok">放行</span>' : '<span class="pill bad">未放行</span>')+'</td>'+
          '<td class="meta">'+(failed.length ? '未过：'+failed.join('、') : '三项通过')+(rec.note ? '；'+esc(rec.note) : '')+'</td></tr>';
      }).join('');
    }
    async function load() {
      [vats, inspections] = await Promise.all([api('/api/vats'), api('/api/inspections')]);
      vatMap = Object.fromEntries(vats.map(v => [v.id, v]));
      statusMap = Object.fromEntries(vats.map(v => [v.id, v.statusInfo]));
      renderVats(); renderRows();
    }
    vatSelect.onchange = renderContext;
    form.onsubmit = async event => {
      event.preventDefault();
      formError.textContent = '';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        await api('/api/inspections', { method:'POST', body: JSON.stringify(data) });
        form.reset();
        await load();
      } catch (err) { formError.textContent = err.message; }
    };
    load();
  </script>` });
}
