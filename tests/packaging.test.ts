import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(__dirname, "..");

async function packageJson(): Promise<{
  scripts?: Record<string, string>;
  build?: {
    appId?: string;
    extraResources?: Array<{ from?: string; to?: string }>;
    mac?: { target?: Array<{ target?: string; arch?: string[] }> };
  };
}> {
  return JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
}

describe("desktop packaging contract", () => {
  it("keeps a reproducible macOS DMG command and both supported architectures", async () => {
    const pkg = await packageJson();
    expect(pkg.scripts?.["dist:mac"]).toBe(
      "npm run pack:prepare && electron-builder --mac dmg",
    );
    expect(pkg.build?.appId).toBe("com.lunadesk.app");
    expect(pkg.build?.mac?.target).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dmg", arch: expect.arrayContaining(["arm64", "x64"]) }),
      ]),
    );
  });

  it("packages the assembled Next standalone app as Electron resources/app", async () => {
    const pkg = await packageJson();
    expect(pkg.scripts?.["pack:prepare"]).toContain("prepare:standalone");
    expect(pkg.build?.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "dist-electron/app", to: "app" }),
      ]),
    );
    const prepare = await readFile(path.join(root, "scripts/prepare-standalone.mjs"), "utf8");
    expect(prepare).toContain(".next");
    expect(prepare).toContain("dist-electron");
    expect(prepare).toContain('"app"');
    expect(prepare).toContain('"@earendil-works", "pi-ai"');
  });

  it("runs the packaged Next server through Electron's Node mode", async () => {
    const main = await readFile(path.join(root, "electron/main.js"), "utf8");
    expect(main).toContain('ELECTRON_RUN_AS_NODE: "1"');
    expect(main).toContain('LUNA_WORKSPACE_STORE: path.join(app.getPath("userData"), "workspace.json")');
    expect(main).toContain("spawn(process.execPath, [serverEntry]");
  });
});
