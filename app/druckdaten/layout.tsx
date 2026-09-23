import type {Metadata} from "next";

export const metadata:Metadata={
  title:"Druckdaten hochladen",
  description:"Druckdaten sicher und projektbezogen an OTTO-Druck übermitteln.",
  alternates:{canonical:"/druckdaten"},
};

export default function PrintDataLayout({children}:{children:React.ReactNode}){return children;}
