import type {MetadataRoute} from "next";
import {products} from "@/lib/products";

const origin="https://otto-druck.de";

export default function sitemap():MetadataRoute.Sitemap{
  const updated=new Date("2026-09-23");
  const pages=[
    ["",1],
    ["/produkte",0.9],
    ["/gestaltung",0.8],
    ["/webdesign",0.8],
    ["/ueber-uns",0.7],
    ["/referenzen",0.7],
    ["/kontakt",0.7],
    ["/anfrage",0.6],
    ["/druckdaten",0.5],
    ["/impressum",0.2],
    ["/datenschutz",0.2],
    ["/agb",0.2],
  ] as const;

  return [
    ...pages.map(([path,priority])=>({url:`${origin}${path}`,lastModified:updated,changeFrequency:"monthly" as const,priority})),
    ...products.map(product=>({url:`${origin}/produkte/${product.slug}`,lastModified:updated,changeFrequency:"monthly" as const,priority:0.8})),
  ];
}
