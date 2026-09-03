import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspacePath =
  process.env.LUNA_WORKSPACE_STORE ??
  path.join(process.env.HOME ?? process.cwd(), ".lunadesk", "workspace.json");

export async function GET() {
  try {
    const raw = await fs.readFile(workspacePath, "utf8");
    return Response.json({ workspace: JSON.parse(raw) });
  } catch {
    return Response.json({ workspace: null });
  }
}

export async function POST(request: Request) {
  let workspace: unknown;
  try {
    workspace = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!workspace || typeof workspace !== "object" || !Array.isArray((workspace as { bots?: unknown }).bots)) {
    return new Response("Invalid workspace", { status: 400 });
  }

  await fs.mkdir(path.dirname(workspacePath), { recursive: true });
  const temporaryPath = `${workspacePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(workspace, null, 2), { mode: 0o600 });
  await fs.rename(temporaryPath, workspacePath);
  return Response.json({ ok: true });
}
