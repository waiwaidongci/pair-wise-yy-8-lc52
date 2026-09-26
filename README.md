# 古法纸浆发酵记录

运行：

```bash
npm start
```

访问`http://localhost:3039`。数据保存在`data/paper-pulp-fermentation.json`。

空缸交给下一批料前需走复检放行：登记冲洗遍数（≥3遍）、残水酸碱度（pH 6.0-8.0）、霉点（无），三项全部通过缸位才放行；放行超过半天（12小时）未投料，建档前需重新复检。缸未放行时建档不会改动原有批次，页面会说明哪一项没过。

业务文件：

- `src/reinspection.js` — 复检记录（三项判定与存档）
- `src/vat-release.js` — 缸位放行（放行、占用、半天过期）
- `src/batch-intake.js` — 建档入口（投料前校验缸位放行）
