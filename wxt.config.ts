import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "CPBase - Solves to GitHub",
    description: "Automatically syncs accepted Codeforces and TLX Toki solutions to GitHub.",
    version: "1.0.0",
    permissions: ["storage", "notifications"],
    host_permissions: [
      "https://codeforces.com/*",
      "https://*.codeforces.com/*",
      "https://tlx.toki.id/*",
      "https://*.tlx.toki.id/*",
      "https://api.github.com/*",
    ],
    browser_specific_settings: {
      gecko: {
        id: "cpbase@local",
        strict_min_version: "115.0",
      },
    },
    icons: {
      16: "/icon/16.png",
      32: "/icon/32.png",
      48: "/icon/48.png",
      128: "/icon/128.png",
    },
    action: {
      default_title: "CPBase Settings",
      default_popup: "popup.html",
      default_icon: {
        16: "/icon/16.png",
        32: "/icon/32.png",
        48: "/icon/48.png",
      },
    },
  },
});
