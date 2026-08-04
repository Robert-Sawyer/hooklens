import Fastify from "fastify";
import { deliveryRoutes } from "./modules/deliveries/delivery.routes.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "hooklens-api",
  }));

  app.register(deliveryRoutes);

  return app;
}
