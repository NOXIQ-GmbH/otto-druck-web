export interface Env {
  PORTAL_DB: D1Database;
  PORTAL_UPLOADS: R2Bucket;
  BREVO_API_KEY: string;
  PORTAL_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        service: "otto-druck-kundenportal",
        status: "development",
        databaseBound: Boolean(env.PORTAL_DB),
        uploadsBound: Boolean(env.PORTAL_UPLOADS),
      });
    }

    return new Response("OTTO-Druck Kundenportal – Entwicklungsstand", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
