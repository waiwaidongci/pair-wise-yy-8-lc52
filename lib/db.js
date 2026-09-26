import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const dbPath = join(__dirname, "..", "data", "paper-pulp-fermentation.json");

const seed = {
  items: [
    {
      code: "PF-001",
      source: "构树皮",
      vat: "三号缸",
      days: 5,
      owner: "林素",
      status: "发酵中",
      logs: [
        {
          at: "2026-06-15",
          step: "观察",
          note: "温度24.6，气味微酸，纤维开始松散",
          abnormal: false,
        },
      ],
    },
  ],
};

// 默认缸位：历史批次只靠口头交代，先把现有缸位登记下来，放行状态一律为空。
const defaultVats = [
  { id: "vat-1", name: "一号缸", location: "东一排" },
  { id: "vat-2", name: "二号缸", location: "东一排" },
  { id: "vat-3", name: "三号缸", location: "东二排" },
];

function migrate(db) {
  if (!Array.isArray(db.vats)) {
    const vats = defaultVats.map((v) => ({ ...v }));
    for (const item of db.items || []) {
      const vat = vats.find((v) => v.name === item.vat);
      if (vat) item.vatId = vat.id;
    }
    db.vats = vats;
  }
  if (!Array.isArray(db.inspections)) db.inspections = [];
  if (!Array.isArray(db.items)) db.items = [];
  return db;
}

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(migrate(seed), null, 2));
  }
  return migrate(JSON.parse(await readFile(dbPath, "utf8")));
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}
