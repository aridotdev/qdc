import db from "../database";
import { category } from "../database/schema";

export default defineEventHandler(async () => {
  const getCategory = await db.select().from(category).all();
  return getCategory;
});
