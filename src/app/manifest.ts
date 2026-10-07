import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
return { name: "MyFarm", short_name: "MyFarm", description: "Your farm, clearly recorded.", start_url: "/", display: "standalone", background_color: "#f7f8f3", theme_color: "#245c3a", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
