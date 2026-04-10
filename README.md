# restaurant-decision (Quickstart Build)

Minimal MCP app with exactly **one tool** that returns one direct restaurant decision for right now.

## What this build does
- Runs an MCP server over HTTP.
- Exposes fixed endpoint: `POST /mcp`.
- Exposes inspection endpoint: `GET /mcp`.
- Exposes health endpoint: `GET /health` -> `{ "status": "ok" }`.
- Provides one tool: `choose_best_restaurant_now`.
- Returns only final decision fields:
  - `recommended_restaurant`
  - `why_this_one`
  - `estimated_waiting_time`
  - `should_go_now`

## Local run
```bash
npm start
```

## Quick checks
```bash
curl http://localhost:3000/health
curl http://localhost:3000/mcp
```

## Connect in ChatGPT Developer Mode
1. Open ChatGPT Developer Mode.
2. Add a new MCP server.
3. Set server URL to:
   ```
   http://localhost:3000/mcp
   ```
4. Save and connect.
5. Call tool `choose_best_restaurant_now` with candidate restaurants.

## Example tool input
```json
{
  "candidates": [
    {
      "name": "Tasty Bowl",
      "cuisine": "Ramen",
      "rating": 4.7,
      "wait_minutes": 18,
      "eta_minutes": 10,
      "distance_km": 2.1,
      "open_now": true
    },
    {
      "name": "Pizza Corner",
      "cuisine": "Pizza",
      "rating": 4.5,
      "wait_minutes": 35,
      "eta_minutes": 8,
      "distance_km": 1.5,
      "open_now": true
    }
  ],
  "prioritize_fast_service": true
}
```

## Expected output format
```json
{
  "recommended_restaurant": "Tasty Bowl",
  "why_this_one": "Ramen, best balance of quality and speed right now",
  "estimated_waiting_time": "18 minutes",
  "should_go_now": "Yes"
}
```
