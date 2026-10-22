import type { Env } from "../worker-configuration";
import { handleRequest } from "./router";

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
