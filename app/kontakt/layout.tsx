import type {Metadata} from "next";

export const metadata:Metadata={
  title:"Kontakt",
  description:"Kontaktieren Sie OTTO-Druck in Dresden für Druckprodukte, Gestaltung und Webprojekte.",
  alternates:{canonical:"/kontakt"},
};

export default function ContactLayout({children}:{children:React.ReactNode}){return children;}
