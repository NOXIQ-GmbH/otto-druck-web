declare namespace Cloudflare {
  interface Env {
    SPAM_MODE?: 'production'|'test';
    SPAM_HMAC_SECRET?: string;
    TURNSTILE_SITEKEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_HOSTNAMES?: string;
    MAIL_FROM_VERIFIED?: string;
    BREVO_API_KEY?: string;
    MAIL_FROM?: string;
    MAIL_TO?: string;
    PUBLIC_SITE_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
