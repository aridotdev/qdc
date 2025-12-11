import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const category = sqliteTable("category", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  createdAt: integer()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: integer()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const InsertCategory = createInsertSchema() 

function createInsertSchema() {
  throw new Error("Function not implemented.");
}
