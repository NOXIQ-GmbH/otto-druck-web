import type { Metadata } from "next";
import "./globals.css";
import BackToTop from "@/components/back-to-top";
import CookieConsent from "@/components/cookie-consent";
export const metadata: Metadata = { title: { default: "OTTO-Druck | Druck & Medien aus Dresden", template: "%s | OTTO-Druck" }, description: "Druckprodukte, Gestaltung und personalisierte Mailings – persönlich betreut von OTTO-Druck in Dresden.", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}<BackToTop/><CookieConsent/></body></html>; }
