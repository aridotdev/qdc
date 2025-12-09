import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const category = sqliteTable("category", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export default category;
