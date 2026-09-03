import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AuthOperationOptions,
  Credential,
  CredentialInfo,
  CredentialStore,
} from "@earendil-works/pi-ai";
import { CREDENTIAL_STORE_PATH } from "../config";

/**
 * A minimal, serialized file-backed `CredentialStore` for Pi.
 *
 * On a packaged desktop build this path should point at an OS-keychain-backed
 * location; for the server/dev build we persist to a JSON file with 0600
 * permissions under the user's home directory. Secrets are NEVER committed —
 * the path is gitignored and defaults outside the repo.
 */
export class FileCredentialStore implements CredentialStore {
  private readonly file: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(file: string = CREDENTIAL_STORE_PATH) {
    this.file = file;
  }

  private async readAll(): Promise<Record<string, Credential>> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return JSON.parse(raw) as Record<string, Credential>;
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, Credential>): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  /** Run write-critical work one-at-a-time to emulate a per-process lock. */
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async read(providerId: string, _options?: AuthOperationOptions): Promise<Credential | undefined> {
    const all = await this.readAll();
    return all[providerId];
  }

  async list(_options?: AuthOperationOptions): Promise<readonly CredentialInfo[]> {
    const all = await this.readAll();
    return Object.entries(all).map(([providerId, cred]) => ({
      providerId,
      type: cred.type,
    }));
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    _options?: AuthOperationOptions,
  ): Promise<Credential | undefined> {
    return this.serialize(async () => {
      const all = await this.readAll();
      const next = await fn(all[providerId]);
      if (next === undefined) {
        return all[providerId];
      }
      all[providerId] = next;
      await this.writeAll(all);
      return next;
    });
  }

  async delete(providerId: string, _options?: AuthOperationOptions): Promise<void> {
    await this.serialize(async () => {
      const all = await this.readAll();
      if (providerId in all) {
        delete all[providerId];
        await this.writeAll(all);
      }
    });
  }
}

let shared: FileCredentialStore | undefined;

/** Process-wide singleton so refresh locks are honoured across requests. */
export function credentialStore(): FileCredentialStore {
  if (!shared) shared = new FileCredentialStore();
  return shared;
}
