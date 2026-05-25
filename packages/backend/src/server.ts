import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { openDatabase } from "./db.js";

const config = readConfig();
const db = openDatabase(config.databasePath);
const app = createApp({ db, config });
const port = Number(process.env.PORT ?? 8787);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`Poetry events API listening on http://localhost:${info.port}`);
  }
);
