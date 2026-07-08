import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { adaptProjectBlocks, type AdaptedProjectBlock } from "./block-adapters";
import { getCatalogSnapshot, type Project } from "./projects";
import { collectionConfigSchema, type CollectionConfig } from "./project-schema";

const repoRoot = process.cwd();
const collectionsRoot = path.join(repoRoot, "catalog", "collections");

export type Collection = Omit<CollectionConfig, "blocks"> & {
  blocks: AdaptedProjectBlock[];
  directory: string;
  projectItems: CollectionProjectItem[];
  route: string;
};

export type CollectionProjectItem = {
  project: Project;
  note?: string;
};

export type CollectionSnapshot = {
  collections: Collection[];
  collectionsById: Map<string, Collection>;
};

let collectionSnapshot: Promise<CollectionSnapshot> | undefined;

export async function getCollectionSnapshot(): Promise<CollectionSnapshot> {
  collectionSnapshot ??= buildCollectionSnapshot();
  return collectionSnapshot;
}

export async function getAllCollections(): Promise<Collection[]> {
  return (await getCollectionSnapshot()).collections;
}

export async function getPublicCollections(): Promise<Collection[]> {
  return (await getCollectionSnapshot()).collections.filter((collection) => collection.status !== "draft");
}

export async function getCollectionById(id: string): Promise<Collection> {
  const snapshot = await getCollectionSnapshot();
  const collection = snapshot.collectionsById.get(id);

  if (!collection) {
    throw new Error(`Unknown collection id: ${id}`);
  }

  return collection;
}

export function resolveCollectionPath(collection: Collection, relativePath: string): string {
  const fullPath = path.resolve(collection.directory, relativePath);
  const relativeToCollection = path.relative(collection.directory, fullPath);

  if (relativeToCollection.startsWith("..") || path.isAbsolute(relativeToCollection)) {
    throw new Error(`${collection.id} references a path outside its collection directory: ${relativePath}`);
  }

  return fullPath;
}

async function buildCollectionSnapshot(): Promise<CollectionSnapshot> {
  const { projectsById } = await getCatalogSnapshot();
  const collections = await readCollections(projectsById);
  assertUniqueIds("collections", collections);
  const sortedCollections = collections.sort((a, b) => a.title.localeCompare(b.title));

  return {
    collections: sortedCollections,
    collectionsById: new Map(sortedCollections.map((collection) => [collection.id, collection]))
  };
}

async function readCollections(projectsById: Map<string, Project>): Promise<Collection[]> {
  const entries = await fs.readdir(collectionsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(directories.map((directory) => readCollection(directory, projectsById)));
}

async function readCollection(
  directoryName: string,
  projectsById: Map<string, Project>
): Promise<Collection> {
  const directory = path.join(collectionsRoot, directoryName);
  const raw = await fs.readFile(path.join(directory, "collection.yaml"), "utf8");
  const config = collectionConfigSchema.parse(load(raw));

  if (config.id !== directoryName) {
    throw new Error(`Collection directory "${directoryName}" must match collection id "${config.id}"`);
  }

  assertCollectionProjects(config, projectsById);
  const collection = {
    ...config,
    blocks: adaptProjectBlocks(config.blocks),
    directory,
    projectItems: config.items.map((item) => ({
      project: projectsById.get(item.project) as Project,
      note: item.note
    })),
    route: `/collections/${config.id}/`
  };

  await assertReferencedFilesExist(collection);
  return collection;
}

function assertCollectionProjects(collection: CollectionConfig, projectsById: Map<string, Project>): void {
  const seen = new Set<string>();

  for (const item of collection.items) {
    if (seen.has(item.project)) {
      throw new Error(`${collection.id} references duplicate collection project: ${item.project}`);
    }

    if (!projectsById.has(item.project)) {
      throw new Error(`${collection.id} references unknown collection project: ${item.project}`);
    }

    seen.add(item.project);
  }
}

async function assertReferencedFilesExist(collection: Collection): Promise<void> {
  const references = [collection.details?.path].filter((item): item is string => Boolean(item));

  for (const reference of references) {
    await fs.access(resolveCollectionPath(collection, reference));
  }
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
