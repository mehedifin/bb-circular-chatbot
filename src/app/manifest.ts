import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BB Circular Assistant",
    short_name: "BB Circulars",
    description:
      "Ask about Bangladesh Bank circulars for banks and NBFIs — bilingual answers with cited sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#065f46",
    lang: "en",
    categories: ["finance", "business", "reference"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
