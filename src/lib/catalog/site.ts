import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { siteConfigSchema } from "./catalog-schema.js";
import type { SiteConfig } from "./catalog-types";
import { getAllHalls } from "./halls";

const repoRoot = process.cwd();
const siteConfigPath = path.join(repoRoot, "catalog", "site.yaml");

export async function getSiteConfig(): Promise<SiteConfig> {
  const raw = await fs.readFile(siteConfigPath, "utf8");
  const site = siteConfigSchema.parse(load(raw));
  await assertNavigationRoutes(site);
  return site;
}

async function assertNavigationRoutes(site: SiteConfig): Promise<void> {
  const halls = new Map((await getAllHalls()).map((hall) => [hall.id, hall]));

  for (const item of site.navigation) {
    if (item.href === "/") {
      continue;
    }

    const match = item.href.match(/^\/halls\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(collections\/)?$/);
    if (!match) {
      throw new Error(`Unsupported navigation href: ${item.href}`);
    }

    const hall = halls.get(match[1]);
    if (!hall) {
      throw new Error(`Navigation href references unknown hall: ${item.href}`);
    }

    if (match[2] && hall.availability !== "active") {
      throw new Error(`Navigation href references collections for non-active hall: ${item.href}`);
    }
  }
}
