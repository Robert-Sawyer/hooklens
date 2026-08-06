import cors from "@fastify/cors";
import Fastify from "fastify";
import { deliveryRoutes } from "./modules/deliveries/delivery.routes.js";
import { knowledgeRoutes } from "./modules/knowledge/knowledge.routes.js";

export function buildApp() {
  const app = Fastify({ logger: true });
  const allowedOrigins = (
    process.env.WEB_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.register(cors, {
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "hooklens-api",
  }));

  app.register(deliveryRoutes);
  app.register(knowledgeRoutes);

  return app;
}
