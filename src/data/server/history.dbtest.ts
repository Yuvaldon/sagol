import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import SHIM from "../../../scripts/db-shim.sql?raw";

// Every migration run over a database that already holds an organization (D-436, OI-300). `test:db` builds its
// database from nothing, where a migration that changes rows has none to change: the built-in group's migration (D-347)
// passed there and failed on staging. Here the migrations run one by one on a database of their own, the rows written
// at the step that brings their tables, so each later migration meets the rows a hosted database holds. A new
// migration joins by being in the folder; one that adds a table adds its rows to SEEDS. Sample rows, test file only.

const MIGRATIONS: Readonly<Record<string, string>> = import.meta.glob(
  "../../../supabase/migrations/*.sql",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const url = import.meta.env.DATABASE_URL as string | undefined;
if (url === undefined || url === "")
  throw new Error("test:db needs DATABASE_URL");

const main = postgres(url, { max: 1, onnotice: () => undefined });
const historyName = `${new URL(url).pathname.slice(1)}_history`;
const historyUrl = Object.assign(new URL(url), {
  pathname: `/${historyName}`,
}).toString();
let history: postgres.Sql;

type Sql = postgres.Sql;
type Row = Record<string, string | number | boolean | null>;

async function insert(sql: Sql, table: string, row: Row): Promise<string> {
  const [inserted] =
    await sql`INSERT INTO ${sql(table)} ${sql(row)} RETURNING *`;
  return String(inserted?.id ?? "");
}

/** One organization as the first schema in service held it: every table, rows in each. */
async function serviceBaseline(sql: Sql): Promise<void> {
  const org = await insert(sql, "organizations", {
    name: "Battalion",
    timezone: "Asia/Jerusalem",
  });
  const at = { organization_id: org };
  const level = await insert(sql, "unit_levels", {
    ...at,
    name: "Company",
    sort_order: 1,
  });
  // Two roots: the single-root migration (D-315) folds them under one.
  const company = await insert(sql, "units", {
    ...at,
    name: "A",
    unit_level_id: level,
  });
  const platoon = await insert(sql, "units", {
    ...at,
    name: "A1",
    parent_id: company,
  });
  const other = await insert(sql, "units", { ...at, name: "B" });
  const rank = await insert(sql, "command_ranks", {
    ...at,
    title: "Commander",
    seniority: 10,
  });
  const commander = await insert(sql, "soldiers", {
    ...at,
    first_name: "Dana",
    last_name: "Levi",
    command_rank_id: rank,
  });
  const soldier = await insert(sql, "soldiers", {
    ...at,
    first_name: "Noa",
    last_name: "Cohen",
  });
  // Placed nowhere: the root-units migration (D-315) places them.
  await insert(sql, "soldiers", {
    ...at,
    first_name: "Omer",
    last_name: "Bar",
  });
  await insert(sql, "soldiers", {
    ...at,
    first_name: "Gil",
    last_name: "Tal",
    archived_at: "2026-01-01T00:00:00Z",
  });
  await insert(sql, "soldier_private", {
    ...at,
    soldier_id: soldier,
    personal_id: "1234567",
  });
  await insert(sql, "soldier_preferences", { ...at, soldier_id: soldier });
  await insert(sql, "seniority_overrides", {
    ...at,
    soldier_id: soldier,
    seniority: 3,
    valid_from: "2026-01-01",
  });
  await insert(sql, "unit_memberships", {
    ...at,
    soldier_id: commander,
    unit_id: company,
    valid_from: "2026-01-01",
  });
  await insert(sql, "unit_memberships", {
    ...at,
    soldier_id: soldier,
    unit_id: platoon,
    valid_from: "2026-01-01",
  });
  await insert(sql, "unit_memberships", {
    ...at,
    soldier_id: soldier,
    unit_id: other,
    membership_type: "attached",
    valid_from: "2026-02-01",
    valid_to: "2026-03-01",
  });
  await insert(sql, "soldier_accounts", {
    ...at,
    soldier_id: commander,
    auth_user_id: "00000000-0000-4000-8000-000000000001",
    provider: "google",
    email: "commander@example.org",
  });
  await insert(sql, "account_link_requests", {
    ...at,
    auth_user_id: "00000000-0000-4000-8000-000000000002",
    email: "requester@example.org",
    first_name: "Omer",
    last_name: "Bar",
  });
  const role = await insert(sql, "roles", { ...at, name: "Commander" });
  await insert(sql, "role_permissions", {
    ...at,
    role_id: role,
    resource: "leaves",
    action: "approve",
  });
  await sql`UPDATE organizations SET baseline_role_id = ${role}, version = version + 1 WHERE id = ${org}`;
  await insert(sql, "rank_role_bindings", {
    ...at,
    command_rank_id: rank,
    role_id: role,
    anchor_type: "home_unit",
    include_descendants: true,
  });
  await insert(sql, "access_grants", {
    ...at,
    grantee_soldier_id: commander,
    role_id: role,
    anchor_type: "unit",
    anchor_unit_id: other,
  });
  const category = await insert(sql, "tag_categories", {
    ...at,
    name: "Role",
    color_key: "blue",
    selection_mode: "single",
  });
  const tag = await insert(sql, "tags", {
    ...at,
    category_id: category,
    name: "Driver",
  });
  await insert(sql, "soldier_tags", {
    ...at,
    soldier_id: soldier,
    tag_id: tag,
  });
  await insert(sql, "property_definitions", {
    ...at,
    entity_type: "soldier",
    label: "Shirt size",
    data_type: "text",
  });
  // Two groups and an ungrouped type: the built-in group's migration (D-347) moves the groups down.
  const home = await insert(sql, "leave_type_groups", {
    ...at,
    name: "Home",
    sort_order: 0,
  });
  await insert(sql, "leave_type_groups", {
    ...at,
    name: "Courses",
    sort_order: 1,
  });
  await insert(sql, "leave_types", {
    ...at,
    group_id: home,
    name: "Home",
    color_key: "green",
  });
  await insert(sql, "leave_types", {
    ...at,
    name: "Medical",
    color_key: "red",
    requires_reason: true,
  });
  const deployment = await insert(sql, "deployments", {
    ...at,
    name: "Exercise",
    unit_id: company,
    start_date: "2026-10-01",
  });
  await insert(sql, "deployment_members", {
    ...at,
    deployment_id: deployment,
    soldier_id: soldier,
  });
  await insert(sql, "availability_rules", {
    ...at,
    name: "Half present",
    metric: "percent",
    min_value: 50,
    scope_unit_id: company,
  });
}

/**
 * Leaves, from the step on which each leave names its rotation (D-216). That migration fills the column without raising
 * the version (D-012), so it cannot run over leaves; it ran on every hosted database before any leave was written, and
 * a migration that ran is never edited (D-436).
 */
async function leavesInRotation(sql: Sql): Promise<void> {
  const [ids] = await sql`
    SELECT o.id AS org, (SELECT id FROM soldiers WHERE first_name = 'Noa') AS soldier,
      (SELECT id FROM soldiers WHERE first_name = 'Dana') AS commander,
      (SELECT id FROM leave_types WHERE name = 'Home') AS leave_type, (SELECT id FROM deployments) AS deployment
    FROM organizations o`;
  const at = { organization_id: String(ids?.org) };
  const [soldier, commander] = [String(ids?.soldier), String(ids?.commander)];
  const batch = await insert(sql, "leave_batches", { ...at, name: "Weekend" });
  for (const [status, start] of [
    ["pending", "2026-11-20"],
    ["approved", "2026-11-10"],
  ] as const) {
    const leave = await insert(sql, "leaves", {
      ...at,
      soldier_id: soldier,
      leave_type_id: String(ids?.leave_type),
      deployment_id: String(ids?.deployment),
      batch_id: batch,
      start_date: start,
      end_date: start,
      status,
    });
    await insert(sql, "leave_events", {
      ...at,
      leave_id: leave,
      actor_id: soldier,
      event_type: "created",
      to_status: "pending",
    });
    if (status === "approved") {
      await insert(sql, "leave_events", {
        ...at,
        leave_id: leave,
        actor_id: commander,
        event_type: "approved",
        from_status: "pending",
        to_status: "approved",
      });
    }
    await insert(sql, "leave_comments", {
      ...at,
      leave_id: leave,
      author_id: commander,
      body: "Noted",
    });
  }
}

/** After a migration that brings tables, their rows: the migrations after it meet them. */
const SEEDS: Readonly<Record<string, (sql: Sql) => Promise<void>>> = {
  "20261111000200_rls.sql": serviceBaseline,
  "20261112000200_leave_deployment.sql": leavesInRotation,
  "20261112000500_day_report.sql": async (sql) => {
    await sql`
      INSERT INTO report_confirmations (organization_id, unit_id, report_date, confirmed_by)
      SELECT organization_id, id, '2026-11-10', (SELECT id FROM soldiers WHERE first_name = 'Dana')
      FROM units WHERE name = 'A'`;
  },
  "20261114001000_push_subscriptions.sql": async (sql) => {
    await sql`
      INSERT INTO push_subscriptions (organization_id, soldier_id, endpoint, p256dh, auth)
      SELECT organization_id, id, 'https://push.example/install-1', 'key', 'secret'
      FROM soldiers WHERE first_name = 'Dana'`;
  },
};

const fileOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const files = Object.keys(MIGRATIONS).sort();

/** Every column of `public`, as `table.column type nullable`, to set the two databases side by side. */
async function columnsOf(sql: Sql): Promise<string[]> {
  const rows = await sql`
    SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, column_name`;
  return rows.map(
    (row) =>
      `${String(row.table_name)}.${String(row.column_name)} ${String(row.data_type)} ${String(row.is_nullable)}`,
  );
}

beforeAll(async () => {
  await main.unsafe(`DROP DATABASE IF EXISTS "${historyName}" WITH (FORCE)`);
  await main.unsafe(`CREATE DATABASE "${historyName}"`);
  history = postgres(historyUrl, {
    max: 1,
    onnotice: () => undefined,
    connection: { TimeZone: "UTC" },
  });
  await history.unsafe(SHIM);
});

afterAll(async () => {
  await history.end();
  await main.unsafe(`DROP DATABASE IF EXISTS "${historyName}" WITH (FORCE)`);
  await main.end();
});

describe("every migration over a database that holds an organization (D-436)", () => {
  it("has the seeds keyed by migrations that exist", () => {
    const names = new Set(files.map(fileOf));
    for (const seeded of Object.keys(SEEDS)) expect(names).toContain(seeded);
  });

  it("applies each migration, in order, over the rows of the ones before it", async () => {
    for (const path of files) {
      const file = fileOf(path);
      await history.unsafe(MIGRATIONS[path] ?? "").catch((error: unknown) => {
        throw new Error(`${file} failed over existing rows: ${String(error)}`);
      });
      await SEEDS[file]?.(history);
    }
    expect(await columnsOf(history)).toEqual(await columnsOf(main));
  });

  it("leaves the rows it found consistent with what the migrations say", async () => {
    const groups =
      await history`SELECT name, sort_order, version, is_rotation_leave FROM leave_type_groups ORDER BY sort_order`;
    expect(
      groups.map((group) => [group.name, group.is_rotation_leave]),
    ).toEqual([
      ["סבב יציאות", true],
      ["Home", false],
      ["Courses", false],
    ]);
    // A row a migration moves is a new version of it (D-012).
    expect(groups.slice(1).every((group) => Number(group.version) > 1)).toBe(
      true,
    );
    const roots =
      await history`SELECT id FROM units WHERE parent_id IS NULL AND archived_at IS NULL`;
    expect(roots).toHaveLength(1);
    const counters = await history`SELECT 1 FROM change_counters`;
    expect(counters).toHaveLength(1);
  });
});
