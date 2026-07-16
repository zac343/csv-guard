import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const productMetrics = sqliteTable(
  "product_metrics",
  {
    day: text("day").notNull(),
    event: text("event").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.event] })],
);
