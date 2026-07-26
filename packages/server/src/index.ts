import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.CONSILIUM_PORT || 4337);
serve({ fetch: createApp().fetch, hostname: "127.0.0.1", port });
console.log(`Consilium API listening on http://127.0.0.1:${port}`);
