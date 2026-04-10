import http from "node:http";

const TOOL_NAME = "choose_best_restaurant_now";

function pickRestaurant({ candidates = [], prioritize_fast_service = true }) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("candidates must be a non-empty array");
  }

  const normalized = candidates.map((c) => ({
    name: String(c.name ?? "").trim(),
    cuisine: c.cuisine ? String(c.cuisine).trim() : "",
    rating: Number.isFinite(c.rating) ? Number(c.rating) : 4,
    wait_minutes: Number.isFinite(c.wait_minutes) ? Number(c.wait_minutes) : 20,
    eta_minutes: Number.isFinite(c.eta_minutes) ? Number(c.eta_minutes) : 15,
    distance_km: Number.isFinite(c.distance_km) ? Number(c.distance_km) : 3,
    open_now: c.open_now !== false
  })).filter((c) => c.name.length > 0);

  if (normalized.length === 0) {
    throw new Error("every candidate needs a valid name");
  }

  const openCandidates = normalized.filter((c) => c.open_now);
  const pool = openCandidates.length > 0 ? openCandidates : normalized;

  const speedWeight = prioritize_fast_service ? 0.28 : 0.18;
  pool.sort((a, b) => {
    const scoreA = a.rating * 2 - a.wait_minutes * speedWeight - a.eta_minutes * 0.12 - a.distance_km * 0.4;
    const scoreB = b.rating * 2 - b.wait_minutes * speedWeight - b.eta_minutes * 0.12 - b.distance_km * 0.4;
    return scoreB - scoreA;
  });

  const winner = pool[0];
  return {
    recommended_restaurant: winner.name,
    why_this_one: `${winner.cuisine ? `${winner.cuisine}, ` : ""}best balance of quality and speed right now`,
    estimated_waiting_time: `${Math.round(winner.wait_minutes)} minutes`,
    should_go_now: winner.wait_minutes + winner.eta_minutes <= 35 ? "Yes" : "No"
  };
}

function toolDefinition() {
  return {
    name: TOOL_NAME,
    title: "Choose the Best Restaurant Right Now",
    description:
      "Use this tool when the user is ready to eat now and wants one direct choice, not a list to compare. It returns one final decision only: recommended_restaurant, why_this_one, estimated_waiting_time, and should_go_now. ChatGPT should call this tool to eliminate decision fatigue by giving a single actionable restaurant decision instead of multiple options.",
    inputSchema: {
      type: "object",
      required: ["candidates"],
      properties: {
        candidates: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              cuisine: { type: "string" },
              rating: { type: "number" },
              wait_minutes: { type: "number" },
              eta_minutes: { type: "number" },
              distance_km: { type: "number" },
              open_now: { type: "boolean" }
            },
            additionalProperties: true
          }
        },
        prioritize_fast_service: { type: "boolean", default: true }
      },
      additionalProperties: false
    }
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, mcp-session-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  });
  res.end(body);
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
    });
    return res.end();
  }

  if (req.method === "GET" && req.url === "/") {
    return sendJson(res, 200, {
      name: "restaurant-decision",
      status: "ok",
      endpoint: "/mcp"
    });
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (req.method === "GET" && req.url === "/mcp") {
    return sendJson(res, 200, {
      name: "restaurant-decision",
      endpoint: "/mcp",
      transport: "http-jsonrpc",
      tool_count: 1,
      tools: [
        {
          name: TOOL_NAME,
          description: toolDefinition().description
        }
      ]
    });
  }

  if (req.method !== "POST" || req.url !== "/mcp") {
    return sendJson(res, 404, { error: "Not found" });
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });

  req.on("end", () => {
    try {
      const msg = JSON.parse(raw || "{}");
      const { id, method, params } = msg;

      if (!method) {
        return sendJson(res, 400, rpcError(id, -32600, "Invalid Request"));
      }

      if (method === "initialize") {
        return sendJson(
          res,
          200,
          rpcResult(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "restaurant-decision", version: "0.1.0" }
          })
        );
      }

      if (method === "notifications/initialized") {
        return sendJson(res, 200, rpcResult(id, {}));
      }

      if (method === "tools/list") {
        return sendJson(res, 200, rpcResult(id, { tools: [toolDefinition()] }));
      }

      if (method === "tools/call") {
        const name = params?.name;
        if (name !== TOOL_NAME) {
          return sendJson(res, 200, rpcError(id, -32602, "Unknown tool"));
        }

        const decision = pickRestaurant(params?.arguments || {});
        return sendJson(
          res,
          200,
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(decision) }],
            structuredContent: decision
          })
        );
      }

      return sendJson(res, 200, rpcError(id, -32601, "Method not found"));
    } catch (error) {
      return sendJson(res, 200, rpcError(null, -32603, error.message || "Internal error"));
    }
  });
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log(`restaurant-decision MCP server running at http://localhost:${PORT}/mcp`);
});
