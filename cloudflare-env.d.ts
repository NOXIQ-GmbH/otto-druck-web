declare namespace Cloudflare {
  interface Env {
    BREVO_API_KEY?: string;
    MAIL_FROM?: string;
    MAIL_TO?: string;
    PUBLIC_SITE_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
