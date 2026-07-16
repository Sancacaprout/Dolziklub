import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DOL ZIKLUB — Archives musicales",
    short_name: "DOL ZIKLUB",
    description: "Le club privé où l’on impose des albums et où l’on rend des comptes.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#f5f1e8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}