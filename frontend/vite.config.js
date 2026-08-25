import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build writes straight into Spring Boot's static folder, and the output is
// committed. That is deliberate: it keeps `mvn spring-boot:run` working for
// anyone who clones this without Node installed. Only rebuilding the front end
// needs npm.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../src/main/resources/static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Content-hashed filenames. The previous front end used a hand-edited
        // ?v= token, which had to be remembered on every change - and when it
        // was missed, people kept seeing a stale page and no amount of
        // no-store on the response could evict a copy already cached under the
        // old headers. A new hash is a new URL, so there is nothing to evict.
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/app-[name]-[hash].js",
        // The stylesheet would otherwise be named after index.html.
        assetFileNames: (info) =>
          info.name && info.name.endsWith(".css")
            ? "assets/app-[hash][extname]"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    // `npm run dev` proxies the API to the running Spring app, so the front end
    // can be developed with hot reload against real data.
    proxy: { "/api": "http://localhost:8080" },
  },
});
