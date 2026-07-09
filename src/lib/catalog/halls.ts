import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { hallConfigSchema } from "./catalog-schema.js";
import type { HallConfig } from "./catalog-types";

const repoRoot = process.cwd();
const hallsRoot = path.join(repoRoot, "catalog", "halls");

export type Hall = HallConfig & {
  directory: string;
  route: string;
};

let hallSnapshot: Promise<Hall[]> | undefined;

export async function getAllHalls(): Promise<Hall[]> {
  hallSnapshot ??= readHalls();
  return hallSnapshot;
}

export async function getHallById(id: string): Promise<Hall> {
  const hall = (await getAllHalls()).find((item) => item.id === id);

  if (!hall) {
    throw new Error(`Unknown hall id: ${id}`);
  }

  return hall;
}

async function readHalls(): Promise<Hall[]> {
  const entries = await fs.readdir(hallsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const halls = await Promise.all(directories.map((directory) => readHall(directory)));
  assertUniqueIds("halls", halls);
  return halls.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

async function readHall(directoryName: string): Promise<Hall> {
  const directory = path.join(hallsRoot, directoryName);
  const raw = await fs.readFile(path.join(directory, "hall.yaml"), "utf8");
  const config = hallConfigSchema.parse(load(raw));

  if (config.id !== directoryName) {
    throw new Error(`Hall directory "${directoryName}" must match hall id "${config.id}"`);
  }

  return {
    ...config,
    directory,
    route: `/halls/${config.id}/`
  };
}

function assertUniqueIds(label: string, items: Array<{ id: string }>): void {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }

    seen.add(item.id);
  }
}
