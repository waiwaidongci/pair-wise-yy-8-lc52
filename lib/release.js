// 缸位复检放行规则：三项全部通过才放行；放行超过半天（12小时）未投料需重新复检。
export const RELEASE_TTL_MS = 12 * 60 * 60 * 1000;

export const checkLabels = {
  rinse: "冲洗遍数",
  ph: "残水酸碱度",
  mold: "霉点",
};

// 合格标准：冲洗不少于3遍；残水pH在6.5~7.5之间；缸壁无霉点。
export function evaluateChecks(input) {
  const rinseTimes = Number(input.rinseTimes || 0);
  const ph = Number(input.residualPh);
  const moldResult = String(input.moldResult || "").trim();
  return {
    rinse: Number.isFinite(rinseTimes) && rinseTimes >= 3,
    ph: Number.isFinite(ph) && ph >= 6.5 && ph <= 7.5,
    mold: moldResult === "无",
  };
}

export function checksPass(checks) {
  return Boolean(checks && checks.rinse && checks.ph && checks.mold);
}

export function failedLabels(checks) {
  return Object.keys(checkLabels)
    .filter((key) => checks && !checks[key])
    .map((key) => checkLabels[key]);
}

export function latestInspection(inspections, vatId) {
  const list = (inspections || [])
    .filter((rec) => rec.vatId === vatId)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  return list[0] || null;
}

export function isUsable(inspection, now = new Date()) {
  return Boolean(
    inspection &&
      inspection.passed &&
      now - new Date(inspection.at) <= RELEASE_TTL_MS
  );
}

// 缸位状态：released 已放行可投料；expired 放行超半天未投料需复检；
// rejected 复检未过（附未过项）；occupied 放行已被批次占用；idle 从未复检。
export function vatStatus(vat, inspections, items, now = new Date()) {
  const inspection = latestInspection(inspections, vat.id);
  if (!inspection) return { key: "idle", label: "未复检", inspection: null, usable: false };
  const occupied = (items || []).some(
    (item) => item.vatId === vat.id && item.inspectionId === inspection.id
  );
  if (occupied) return { key: "occupied", label: "使用中", inspection, usable: false };
  if (!inspection.passed) {
    return {
      key: "rejected",
      label: "未放行",
      inspection,
      usable: false,
      failed: failedLabels(inspection.checks),
    };
  }
  const age = now - new Date(inspection.at);
  if (age > RELEASE_TTL_MS) {
    return { key: "expired", label: "放行已过期", inspection, usable: false };
  }
  return {
    key: "released",
    label: "已放行",
    inspection,
    usable: true,
    expiresAt: new Date(new Date(inspection.at).getTime() + RELEASE_TTL_MS).toISOString(),
  };
}

export function describeVat(status) {
  if (status.key === "released") return "复检三项通过，缸位可投料，放行有效期至 " + formatAt(status.expiresAt);
  if (status.key === "expired") return "放行已超过半天仍未投料，建档前需重新复检";
  if (status.key === "rejected") return "复检未通过项：" + (status.failed.join("、") || "—");
  if (status.key === "occupied") return "放行已被新批次占用";
  return "尚无复检记录，投料前须先做复检";
}

export function formatAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
