import { vatReleaseStatus } from "./vat-release.js";

// 建档入口：新批次投料必须落在已放行的缸位上。
// 缸未放行时不创建、不改动任何现有批次，只回告哪一项没过。
export function createBatch(db, input) {
  const vat = String(input.vat || "").trim();
  if (!vat) return { ok: false, status: 400, error: "vat_required", vat, failures: ["请选择浸泡缸"] };
  const release = vatReleaseStatus(db, vat);
  if (!release.released) {
    return { ok: false, status: 409, error: "vat_not_released", vat, failures: release.failures };
  }
  const at = new Date().toISOString();
  const item = {
    id: "PF-" + Date.now(),
    ...input,
    vat,
    createdAt: at,
    logs: [{ at, step: "建档", note: "创建纸浆批次（缸位放行单 " + release.release.inspectionId + "）" }],
  };
  db.items.unshift(item);
  release.release.usedAt = at;
  return { ok: true, item };
}
