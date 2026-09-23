import type {MetadataRoute} from "next";

export default function robots():MetadataRoute.Robots{
  return {
    rules:{
      userAgent:"*",
      allow:"/",
      disallow:["/verwaltung","/api/"],
    },
    sitemap:"https://otto-druck.de/sitemap.xml",
    host:"https://otto-druck.de",
  };
}
