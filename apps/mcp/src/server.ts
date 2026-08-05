import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { prisma } from "./db/prisma.js";
import { createHookLensMcpServer } from "./hooklens-mcp.server.js";

const DEFAULT_PORT = 4001;

function parsePort(value: string | undefined) {
  const port = Number(value ?? DEFAULT_PORT);

  return Number.isInteger(port) && port > 0 && port < 65_536
    ? port
    : DEFAULT_PORT;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function requestPath(request: IncomingMessage) {
  return new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  ).pathname;
}

export function buildMcpHttpServer() {
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const handleMcpRequest = toNodeHandler(
    createMcpHandler(() => createHookLensMcpServer()),
    {
      onerror: (error) => {
        console.error("MCP request adapter failed", error);
      },
    },
  );

  return createServer((request, response) => {
    const path = requestPath(request);

    if (path === "/health" && request.method === "GET") {
      return sendJson(response, 200, {
        status: "ok",
        service: "hooklens-mcp",
        transport: "streamable-http",
        mode: "read-only",
      });
    }

    if (path !== "/mcp") {
      return sendJson(response, 404, {
        error: { code: "NOT_FOUND", message: "Route not found." },
      });
    }

    if (
      !validateHost(request, response) ||
      !validateOrigin(request, response)
    ) {
      return;
    }

    void handleMcpRequest(request, response).catch((error: unknown) => {
      console.error("MCP request failed", error);

      if (!response.headersSent) {
        sendJson(response, 500, {
          error: { code: "MCP_REQUEST_FAILED", message: "MCP request failed." },
        });
      }
    });
  });
}

async function main() {
  const port = parsePort(process.env.MCP_PORT);
  const server = buildMcpHttpServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`HookLens MCP server listening at http://127.0.0.1:${port}/mcp`);

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main();
