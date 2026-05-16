// Side-effect barrel: importing this registers every domain's items
// (feed, production) into the shared engine registry. Server query
// paths import this so domain items resolve in runQuery/derive. Core
// (engine.ts/query.ts) stays clean — it never imports domains.
import "./feed.ts";
import "./production.ts";
import "./health.ts";
import "./flags.ts";
