import http from "node:http";
import { loadDb, saveDb } from "./lib/db.js";
import {
  RELEASE_TTL_MS,
  evaluateChecks,
  checksPass,
  failedLabels,
  latestInspection,
  vatStatus,
} from "./lib/release.js";
import { fermentationPage } from "./pages/fermentation.js";
import { inspectionPage } from "./pages/inspection.js";
import { vatsPage } from "./pages/vats.js";

const port = Number(process.env.PORT || 3039);
const statLabels = ["入缸", "发酵中", "可抄纸", "异常观察"];

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}
function html(res, text) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(text);
}
function newId(prefix) { return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000); }
function computeStats(items) {
  const stats = Object.fromEntries(statLabels.map((label) => [label, 0]));
  for (const item of items) if (stats[item.status] !== undefined) stats[item.status] += 1;
  return stats;
}
function summarize(item) {
  const logCount = (item.logs || []).length + (item.tasks || []).reduce((n, t) => n + (t.logs || []).length, 0);
  return { ...item, logCount };
}

function decorateVat(vat, db, now = new Date()) {
  const statusInfo = vatStatus(vat, db.inspections, db.items, now);
  const lastItem = db.items.find((item) => item.vatId === vat.id);
  return { ...vat, statusInfo, lastItem: lastItem || null };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();
    const now = new Date();

    if (req.method === "GET" && url.pathname === "/") return html(res, fermentationPage());
    if (req.method === "GET" && url.pathname === "/inspections") return html(res, inspectionPage());
    if (req.method === "GET" && url.pathname === "/vats") return html(res, vatsPage());

    if (req.method === "GET" && url.pathname === "/api/vats") {
      return send(res, 200, db.vats.map((vat) => decorateVat(vat, db, now)));
    }

    if (req.method === "GET" && url.pathname === "/api/inspections") {
      const list = [...db.inspections]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .map((rec) => ({
          ...rec,
          vatName: (db.vats.find((v) => v.id === rec.vatId) || {}).name || rec.vatId,
        }));
      return send(res, 200, list);
    }

    // 复检放行单：登记冲洗遍数、残水酸碱度、霉点，三项通过才放行。
    if (req.method === "POST" && url.pathname === "/api/inspections") {
      const input = await body(req);
      const vat = db.vats.find((v) => v.id === input.vatId);
      if (!vat) return send(res, 400, { error: "请选择缸位" });
      const rinseTimes = Number(input.rinseTimes);
      const residualPh = Number(input.residualPh);
      const moldResult = String(input.moldResult || "").trim();
      if (!Number.isFinite(rinseTimes) || rinseTimes < 0) return send(res, 400, { error: "请填写冲洗遍数" });
      if (!Number.isFinite(residualPh)) return send(res, 400, { error: "请填写残水酸碱度" });
      if (moldResult !== "无" && moldResult !== "有") return send(res, 400, { error: "请选择霉点情况" });

      const checks = evaluateChecks({ rinseTimes, residualPh, moldResult });
      const passed = checksPass(checks);
      const record = {
        id: newId("INS"),
        vatId: vat.id,
        at: now.toISOString(),
        rinseTimes,
        residualPh,
        moldResult,
        note: String(input.note || "").trim(),
        checks,
        passed,
      };
      db.inspections.push(record);
      await saveDb(db);
      return send(res, 201, {
        ...record,
        vatName: vat.name,
        failed: failedLabels(checks),
        expiresAt: new Date(now.getTime() + RELEASE_TTL_MS).toISOString(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/items") {
      return send(res, 200, db.items.map(summarize));
    }

    // 建档入口：未持有效放行单的缸位不能投料，原批次记录保留不动。
    if (req.method === "POST" && url.pathname === "/api/items") {
      const input = await body(req);
      const vat = db.vats.find((v) => v.id === input.vatId);
      if (!vat) return send(res, 400, { error: "请选择已放行的缸位" });

      const inspection = latestInspection(db.inspections, vat.id);
      const statusInfo = vatStatus(vat, db.inspections, db.items, now);
      if (!statusInfo.usable) {
        return send(res, 409, {
          error: "vat_not_released",
          reason: statusInfo.key,
          failed: statusInfo.failed || [],
          message:
            statusInfo.key === "expired"
              ? "放行已超过半天未投料，须重新复检"
              : statusInfo.key === "rejected"
                ? "复检未通过：" + (statusInfo.failed.join("、") || "—")
                : "缸位未放行",
        });
      }

      const item = {
        id: newId("PF"),
        ...input,
        vat: vat.name,
        vatId: vat.id,
        inspectionId: inspection.id,
        logs: [
          {
            at: now.toISOString(),
            step: "建档",
            note: "创建纸浆批次；凭复检单 " + inspection.id + " 占用 " + vat.name,
          },
        ],
      };
      db.items.unshift(item);
      await saveDb(db);
      return send(res, 201, item);
    }

    const patch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
    if (patch && req.method === "PATCH") {
      const item = db.items.find((x) => x.id === patch[1] || x.code === patch[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      Object.assign(item, await body(req));
      item.logs ||= [];
      item.logs.push({ at: now.toISOString(), step: "状态", note: "更新为" + item.status });
      await saveDb(db);
      return send(res, 200, item);
    }

    const log = url.pathname.match(/^\/api\/items\/([^/]+)\/logs$/);
    if (log && req.method === "POST") {
      const item = db.items.find((x) => x.id === log[1] || x.code === log[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      const input = await body(req);
      item.logs ||= [];
      item.logs.push({ at: now.toISOString(), step: input.step || "记录", note: input.note || "" });
      await saveDb(db);
      return send(res, 201, item);
    }

    const action = url.pathname.match(/^\/api\/items\/([^/]+)\/action$/);
    if (action && req.method === "POST") {
      const item = db.items.find((x) => x.id === action[1] || x.code === action[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      const input = await body(req);
      item.logs ||= [];
      const abnormal = String(input.abnormal || "").includes("是") || String(input.abnormal || "").includes("有");
      item.observations ||= [];
      item.observations.push({ at: now.toISOString(), ...input, abnormal });
      item.days = Number(item.days || 0) + 1;
      item.status = abnormal ? "异常观察" : Number(item.days) >= 7 ? "可抄纸" : "发酵中";
      item.logs.push({
        at: now.toISOString(),
        step: "观察",
        note: "温度" + (input.temperature || "") + "，" + (input.smell || "") + "，" + (input.fiber || ""),
      });
      await saveDb(db);
      return send(res, 201, item);
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      return send(res, 200, computeStats(db.items));
    }
    send(res, 404, { error: "not_found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log("古法纸浆发酵记录 listening on http://localhost:" + port));
