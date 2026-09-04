/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle so Electron can spawn it in the
  // packaged .app without needing the full node_modules tree.
  output: "standalone",
  outputFileTracingIncludes: { "/api/chat": ["./skills/lunadesk-delegation/SKILL.md"] },
  // pi-ai / pi-coding-agent are heavy Node-only packages; keep them external to
  // the server bundle so their lazy provider SDKs resolve at runtime.
  serverExternalPackages: ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"],
};

export default nextConfig;
