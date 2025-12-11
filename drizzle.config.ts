import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./server/database/migration",
  schema: "./server/database/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_FILE_NAME!,
  },
});
