const navItems = [
  ["", "发酵批次"],
  ["/inspections", "复检记录"],
  ["/vats", "缸位放行"],
];

export function layout({ active, title, subtitle, body, head = "" }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; --ok:#3f6e4c; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:26px; } h2 { margin:0 0 12px; font-size:18px; } h3 { margin:0; font-size:16px; }
    nav { display:flex; gap:8px; padding:12px 28px 0; flex-wrap:wrap; } nav a { text-decoration:none; color:var(--muted); border:1px solid var(--line); border-bottom:0; border-radius:8px 8px 0 0; padding:8px 14px; background:#f7f9f5; font-size:14px; }
    nav a.active { color:var(--ink); background:var(--bg); font-weight:700; }
    main { padding:22px 28px; } main.two-col { display:grid; grid-template-columns:380px 1fr; gap:22px; }
    form,.panel,.card,.stat,.banner { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:68px; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; } button.secondary { background:#69736a; } button:disabled { background:#a9b0a7; cursor:not-allowed; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:160px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; } .card { display:grid; gap:8px; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.ok { color:var(--ok); border-color:var(--ok); } .pill.bad { color:var(--warn); border-color:var(--warn); }
    .logs { border-top:1px solid var(--line); padding-top:8px; max-height:90px; overflow:auto; } .warn { color:var(--warn); font-weight:700; }
    .banner { margin-bottom:14px; } .banner.ok { border-color:var(--ok); } .banner.bad { border-color:var(--warn); } .banner.warnline { border-color:#b5842f; }
    .banner p { margin:6px 0 0; font-size:14px; }
    table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; } th,td { border-bottom:1px solid var(--line); padding:9px 10px; text-align:left; font-size:14px; } th { background:#f7f9f5; color:var(--muted); font-weight:700; }
    .tag-pass { color:var(--ok); font-weight:700; } .tag-fail { color:var(--warn); font-weight:700; }
    .rowline { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    #formError { color:var(--warn); font-size:13px; margin-top:8px; min-height:18px; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main.two-col{grid-template-columns:1fr;padding:16px;} main{padding:16px;} nav{padding:12px 16px 0;} }
  </style>
  ${head}
</head>
<body>
  <header>
    <div><h1>${title}</h1><div class="meta">${subtitle}</div></div>
    <button id="reload">刷新</button>
  </header>
  <nav>
    ${navItems
      .map(
        ([href, label]) =>
          `<a href="${href || "/"}" class="${href === active ? "active" : ""}">${label}</a>`
      )
      .join("")}
  </nav>
  ${body}
  <script>document.querySelector('#reload').onclick = () => location.reload();</script>
</body>
</html>`;
}
