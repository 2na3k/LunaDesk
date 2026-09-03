// Assemble the Next.js "standalone" output into a self-contained app directory
// that Electron packages as `resources/app` and runs via `server.js`.
//
// Next's standalone bundle omits static assets and the public/ dir by design,
// so we copy them into place next to the server.
import { cp, rm, mkdir, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const out = path.join(root, "dist-electron", "app");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standalone))) {
    throw new Error(
      "Missing .next/standalone — run `next build` with output:'standalone' first (npm run build).",
    );
  }
  await rm(out, { recursive: true, force: true });
  await mkdir(path.dirname(out), { recursive: true });

  // 1. The standalone server + its trimmed node_modules + server chunks.
  await cp(standalone, out, { recursive: true });

  // 2. Client static assets → served from <app>/.next/static.
  await cp(path.join(root, ".next", "static"), path.join(out, ".next", "static"), {
    recursive: true,
  });

  // Pi deliberately loads provider OAuth implementations through variable
  // dynamic imports. Next's file tracer cannot see those modules, so replace
  // its partial copy with the complete package for packaged sign-in flows.
  const piAiSource = path.join(root, "node_modules", "@earendil-works", "pi-ai");
  const piAiTarget = path.join(out, "node_modules", "@earendil-works", "pi-ai");
  await rm(piAiTarget, { recursive: true, force: true });
  await mkdir(path.dirname(piAiTarget), { recursive: true });
  await cp(piAiSource, piAiTarget, { recursive: true });

  // 4. Optional public/ dir.
  if (await exists(path.join(root, "public"))) {
    await cp(path.join(root, "public"), path.join(out, "public"), { recursive: true });
  }

  console.log(`[prepare-standalone] assembled -> ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
