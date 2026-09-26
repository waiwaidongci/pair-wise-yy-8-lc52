import { latestReinspection } from "./reinspection.js";

// 缸位放行：复检合格即放行；放行超过半天（12小时）仍未投料则失效，
// 建档前必须重新复检；放行一旦被投料占用即告用完。
export const RELEASE_VALID_MS = 12 * 60 * 60 * 1000;

export function findRelease(db, vat) {
  return (db.vatReleases || []).find(r => r.vat === vat) || null;
}

export function releaseVat(db, inspection) {
  db.vatReleases ||= [];
  const existing = findRelease(db, inspection.vat);
  const release = { vat: inspection.vat, releasedAt: inspection.at, inspectionId: inspection.id, usedAt: null };
  if (existing) {
    Object.assign(existing, release);
    return existing;
  }
  db.vatReleases.push(release);
  return release;
}

export function vatReleaseStatus(db, vat, now = Date.now()) {
  const inspection = latestReinspection(db, vat);
  const release = findRelease(db, vat);
  if (!release) {
    const failed = inspection && !inspection.passed;
    return {
      vat,
      state: failed ? "复检未过" : "未复检",
      released: false,
      failures: failed ? inspection.failures : ["该缸尚未提交复检放行单"],
      inspection,
      release: null,
    };
  }
  if (release.usedAt) {
    return { vat, state: "已投料", released: false, failures: ["上次放行已随投料用完，空缸需重新复检放行"], inspection, release };
  }
  const expiresAtMs = new Date(release.releasedAt).getTime() + RELEASE_VALID_MS;
  if (now > expiresAtMs) {
    return { vat, state: "放行过期", released: false, failures: ["放行已超过半天未投料，建档前需重新复检"], inspection, release };
  }
  return { vat, state: "放行中", released: true, failures: [], inspection, release, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function listVatStatuses(db) {
  const names = new Set();
  for (const item of db.items || []) if (item.vat) names.add(item.vat);
  for (const r of db.reinspections || []) if (r.vat) names.add(r.vat);
  for (const r of db.vatReleases || []) if (r.vat) names.add(r.vat);
  return [...names].map(vat => vatReleaseStatus(db, vat));
}
