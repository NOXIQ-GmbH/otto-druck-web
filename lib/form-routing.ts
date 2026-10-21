/** Website-form delivery and deliberately conservative application filtering. */
export const WEBSITE_INBOX = 'webkontakt@otto-druck.de';
export const PUBLIC_REPLY_EMAIL = 'webkontakt@otto-druck.de';

export function isUnwantedJobApplication(email: string, ...fields: string[]): boolean {
  if (email.trim().toLowerCase().split('@')[1] !== 'firemail.de') return false;
  const message = fields.join(' ').normalize('NFKC').toLowerCase();
  const patterns = [
    /\binitiativbewerb(?:ung|ungen)?\b/u,
    /\bbewerbe\s+mich\b/u,
    /\bmeine\s+bewerbung\b/u,
    /\bbewerbung\s+(?:als|um|bei\s+(?:ihnen|euch))\b/u,
    /\b(?:ich\s+)?(?:suche|bin\s+auf\s+der\s+suche\s+nach)\s+(?:einer\s+)?(?:arbeit|stelle|anstellung|job)\b/u,
    /\b(?:offene|freie)\s+stelle\b/u,
    /\b(?:lebenslauf|cv)\s+(?:im\s+anhang|anbei)\b/u,
    /\b(?:ich\s+)?(?:möchte|würde|will)\s+mich\s+(?:bei\s+ihnen\s+)?bewerben\b/u,
    /\b(?:ausbildungsplatz|praktikumsplatz)\s+(?:bei\s+ihnen|gesucht)\b/u,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

export function contactCategory(message: string): 'Reklamation' | 'Kontakt' {
  return /\b(?:reklamation|beanstandung|fehllieferung|druckfehler)\b/iu.test(message)
    ? 'Reklamation' : 'Kontakt';
}

export const APPLICATION_REJECTION =
  'OTTO-Druck nimmt derzeit keine Bewerbungen entgegen. Für eine geschäftliche Druckanfrage beschreiben Sie bitte Ihr konkretes Anliegen.';
