// Why this exists: small file helpers shared by the build tools.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Lists files under dir, recursively, whose names match the test. */
export function listFiles(dir: string, test: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listFiles(path, test));
    else if (test(name)) out.push(path);
  }
  return out.sort();
}
