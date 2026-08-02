import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 4000);
const app = buildApp();

await app.listen({ port, host: "127.0.0.1" });
