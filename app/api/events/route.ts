import { getD1 } from "../../../db";

const EVENTS = new Set(["page_view", "sample_loaded", "analyze", "download"]);

export async function POST(request: Request) {
  let event: string | undefined;
  try {
    const body = (await request.json()) as { event?: unknown };
    event = typeof body.event === "string" ? body.event : undefined;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!event || !EVENTS.has(event)) {
    return Response.json({ error: "Unknown event" }, { status: 400 });
  }

  const db = getD1();
  if (!db) return new Response(null, { status: 204 });

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS product_metrics (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, event)
    ) WITHOUT ROWID`,
  ).run();
  const day = new Date().toISOString().slice(0, 10);
  await db.prepare(
    `INSERT INTO product_metrics (day, event, count)
     VALUES (?, ?, 1)
     ON CONFLICT(day, event) DO UPDATE SET count = count + 1`,
  ).bind(day, event).run();

  return new Response(null, { status: 204 });
}

export async function GET() {
  const db = getD1();
  if (!db) return Response.json({ totals: {}, days: [] });

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS product_metrics (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, event)
    ) WITHOUT ROWID`,
  ).run();
  const result = await db.prepare(
    `SELECT day, event, count
     FROM product_metrics
     ORDER BY day DESC, event ASC
     LIMIT 120`,
  ).all<{ day: string; event: string; count: number }>();
  const rows = result.results ?? [];
  const totals = rows.reduce<Record<string, number>>((summary, row) => {
    summary[row.event] = (summary[row.event] ?? 0) + row.count;
    return summary;
  }, {});

  return Response.json(
    { totals, days: rows },
    { headers: { "cache-control": "no-store" } },
  );
}
