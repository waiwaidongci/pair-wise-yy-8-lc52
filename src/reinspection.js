// 复检记录：空缸交给下一批料前，登记冲洗遍数、残水酸碱度、霉点，
// 三项全部通过才算复检合格，任一不过都要写明原因。
export const REINSPECTION_RULES = [
  { key: "rinse", label: "冲洗遍数", pass: v => Number.isFinite(Number(v)) && Number(v) >= 3, fail: "冲洗遍数不足（需不少于3遍）" },
  { key: "ph", label: "残水酸碱度", pass: v => Number.isFinite(Number(v)) && Number(v) >= 6 && Number(v) <= 8, fail: "残水酸碱度超出 6.0-8.0" },
  { key: "mold", label: "霉点", pass: v => String(v ?? "").trim() === "无", fail: "缸壁仍有霉点" },
];

export function evaluateReinspection(input) {
  const checks = REINSPECTION_RULES.map(rule => ({
    key: rule.key,
    label: rule.label,
    value: input[rule.key],
    passed: rule.pass(input[rule.key]),
    failReason: rule.fail,
  }));
  const failures = checks.filter(c => !c.passed).map(c => c.failReason);
  return { checks, passed: failures.length === 0, failures };
}

export function createReinspection(db, input) {
  const result = evaluateReinspection(input);
  const record = {
    id: "RI-" + Date.now(),
    vat: String(input.vat || "").trim(),
    rinse: Number(input.rinse),
    ph: Number(input.ph),
    mold: String(input.mold || "").trim(),
    inspector: String(input.inspector || "").trim(),
    checks: result.checks,
    passed: result.passed,
    failures: result.failures,
    at: new Date().toISOString(),
  };
  db.reinspections ||= [];
  db.reinspections.unshift(record);
  return record;
}

export function latestReinspection(db, vat) {
  return (db.reinspections || []).find(r => r.vat === vat) || null;
}
