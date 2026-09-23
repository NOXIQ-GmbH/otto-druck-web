"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "otto-cookie-choice";
const CONSENT_VERSION = 3;
const CONSENT_LIFETIME = 365 * 24 * 60 * 60 * 1000;

type ConsentChoice = {
  version: number;
  necessary: true;
  preferences: false;
  statistics: false;
  marketing: false;
  savedAt: string;
  expiresAt: string;
};

const categories = [
  {
    key: "necessary",
    title: "Notwendig",
    description: "Speichert ausschließlich Ihre Datenschutzauswahl in diesem Browser.",
    status: "Immer aktiv",
    active: true,
  },
  {
    key: "preferences",
    title: "Präferenzen",
    description: "Derzeit sind keine Präferenzdienste eingebunden.",
    status: "Nicht eingesetzt",
    active: false,
  },
  {
    key: "statistics",
    title: "Statistik",
    description: "Derzeit findet keine Besucheranalyse statt.",
    status: "Nicht eingesetzt",
    active: false,
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Derzeit sind keine Werbe- oder Trackingdienste eingebunden.",
    status: "Nicht eingesetzt",
    active: false,
  },
] as const;

function readStoredChoice(): ConsentChoice | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<ConsentChoice> | null;
    if (
      !stored ||
      stored.version !== CONSENT_VERSION ||
      stored.necessary !== true ||
      stored.preferences !== false ||
      stored.statistics !== false ||
      stored.marketing !== false ||
      !stored.savedAt ||
      !Number.isFinite(Date.parse(stored.savedAt)) ||
      !stored.expiresAt ||
      !Number.isFinite(Date.parse(stored.expiresAt)) ||
      Date.parse(stored.expiresAt) <= Date.now()
    ) {
      return null;
    }
    return stored as ConsentChoice;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      setChoice(readStoredChoice());
      setReady(true);
    }, 0);
    const open = () => setSettings(true);
    window.addEventListener("otto:privacy", open);
    return () => {
      window.clearTimeout(hydrate);
      window.removeEventListener("otto:privacy", open);
    };
  }, []);

  function saveNecessary() {
    const now = new Date();
    const nextChoice: ConsentChoice = {
      version: CONSENT_VERSION,
      necessary: true,
      preferences: false,
      statistics: false,
      marketing: false,
      savedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + CONSENT_LIFETIME).toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextChoice));
    } catch {
      // The choice still applies for this page view when browser storage is unavailable.
    }
    setChoice(nextChoice);
    setSettings(false);
  }

  const showBanner = ready && !choice && !settings;
  const savedDate = choice
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(choice.savedAt))
    : null;

  return (
    <>
      {showBanner && (
        <aside className="cookie-banner" aria-label="Cookie- und Datenschutzeinstellungen">
          <div className="cookie-banner-heading">
            <span className="cookie-shield" aria-hidden="true"><ShieldCheck size={22} /></span>
            <div>
              <p className="cookie-kicker">Datenschutz</p>
              <h2>Ihre Privatsphäre hat Vorrang.</h2>
            </div>
          </div>
          <p>
            OTTO-Druck setzt aktuell keine Analyse-, Marketing- oder Trackingdienste ein.
            Wir speichern nur Ihre Auswahl lokal in diesem Browser.
          </p>
          <div className="cookie-actions">
            <button className="cookie-primary" onClick={saveNecessary}>Nur notwendige verwenden</button>
            <button className="cookie-secondary" onClick={() => setSettings(true)}>Einstellungen ansehen</button>
          </div>
          <div className="cookie-links">
            <a href="/datenschutz">Datenschutzerklärung</a>
            <span aria-hidden="true">·</span>
            <a href="/impressum">Impressum</a>
          </div>
        </aside>
      )}

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="privacy-dialog" showCloseButton={false}>
          <div className="privacy-dialog-head">
            <div>
              <p className="cookie-kicker">Datenschutz</p>
              <DialogTitle>Cookie-Einstellungen</DialogTitle>
            </div>
            <button className="privacy-close" type="button" onClick={() => setSettings(false)} aria-label="Cookie-Einstellungen schließen">
              <X size={21} />
            </button>
          </div>
          <DialogDescription>
            Hier sehen Sie alle Kategorien und ihren aktuellen Status. Ihre Auswahl können Sie
            jederzeit über „Cookie-Einstellungen“ im Fußbereich erneut öffnen.
          </DialogDescription>

          <div className="privacy-categories">
            {categories.map((category) => (
              <section className={`privacy-category${category.active ? " is-active" : ""}`} key={category.key}>
                <div className="privacy-category-title">
                  <h3>{category.title}</h3>
                  <span className="privacy-switch" aria-label={`${category.title}: ${category.status}`} role="img">
                    <span>{category.active && <Check size={15} />}</span>
                  </span>
                </div>
                <p>{category.description}</p>
                <strong>{category.status}</strong>
              </section>
            ))}
          </div>

          <div className="privacy-notice">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>Es werden keine optionalen Cookies gesetzt. Deshalb gibt es derzeit nichts zusätzlich zu aktivieren.</p>
          </div>

          <div className="privacy-actions">
            <button className="cookie-primary" onClick={saveNecessary}>Auswahl speichern</button>
            <a className="cookie-secondary" href="/datenschutz">Datenschutzerklärung</a>
          </div>
          {savedDate && <p className="privacy-saved" role="status">Aktuelle Auswahl gespeichert am {savedDate}.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
