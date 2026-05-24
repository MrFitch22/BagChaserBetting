// Re-export from the canonical schema in services/api
// The web app only needs users + affiliate_clicks for webhooks
export { users, affiliateClicks } from "../../../../services/api/src/db/schema.js";
