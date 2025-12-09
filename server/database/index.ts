import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema/index";

// You can specify any property from the libsql connection options
export const db = drizzle({
  connection: { url: process.env.DB_FILE_NAME! },
  schema,
});

export type db = typeof db;

export default db;
