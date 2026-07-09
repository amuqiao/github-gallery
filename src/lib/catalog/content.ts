import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { adaptProjectBlocks, type AdaptedProjectBlock } from "./block-adapters";
import {
  contentCollectionConfigSchema,
  contentItemConfigSchema,
  contentPublicationStates,
  taxonomyCatalogSchema
} from "./catalog-schema.js";
import type { ContentCollectionConfig, ContentItemConfig, ProjectNoteConfig } from "./catalog-types";
import { getAllHalls } from "./halls";

const repoRoot = process.cwd();
const catalogRoot = path.join(repoRoot, "catalog");
const contentRoot = path.join(catalogRoot, "content");
const taxonomiesPath = path.join(catalogRoot, "taxonomies.yaml");
const contentKinds = ["items", "collections"];

export type ContentPublicationState = (typeof contentPublicationStates)[number];

export type ContentNote = ProjectNoteConfig & {
  route: string;
};

export type ContentItem = Omit<ContentItemConfig, "blocks" | "notes"> & {
  blocks: AdaptedProjectBlock[];
  notes: ContentNote[];
  directory: string;
  publicationState: ContentPublicationState;
  route: string;
};

export type ContentCollectionItem = {
  item: ContentItem;
  note?: string;
};

export type ContentCollection = Omit<ContentCollectionConfig, "blocks" | "items"> & {
  blocks: AdaptedProjectBlock[];
  items: ContentCollectionItem[];
  directory: string;
  publicationState: ContentPublicationState;
  route: string;
};

export type ContentCatalogSnapshot = {
  items: ContentItem[];
  collections: ContentCollection[];
  publicItems: ContentItem[];
  publicCollections: ContentCollection[];
  itemsByKey: Map<string, ContentItem>;
  collectionsByKey: Map<string, ContentCollection>;
};

let contentSnapshot: Promise<ContentCatalogSnapshot> | undefined;

export async function getContentCatalogSnapshot(): Promise<ContentCatalogSnapshot> {
  contentSnapshot ??= buildContentCatalogSnapshot();
  return contentSnapshot;
}

export async function getPublishedContentItems(): Promise<ContentItem[]> {
  return (await getContentCatalogSnapshot()).publicItems;
}

export async function getPublishedContentCollections(): Promise<ContentCollection[]> {
  return (await getContentCatalogSnapshot()).publicCollections;
}

async function buildContentCatalogSnapshot(): Promise<ContentCatalogSnapshot> {
  const [halls, taxonomy] = await Promise.all([getAllHalls(), readTaxonomyIds()]);
  const hallsById = new Map(halls.map((hall) => [hall.id, hall]));
  const { itemConfigs, collectionConfigs } = await readContentConfigs(hallsById, taxonomy);

  assertUniqueBundleKeys("content items", itemConfigs);
  assertUniqueBundleKeys("content collections", collectionConfigs);

  const items = itemConfigs.map((entry) => adaptContentItem(entry));
  const itemsByKey = new Map(items.map((item) => [contentKey(item.hall, item.id), item]));
  const collections = collectionConfigs.map((entry) => adaptContentCollection(entry, itemsByKey));

  assertCollectionReferences(collections);
  assertUniqueBundleKeys("content collections", collections);

  const sortedItems = items.sort(compareContentItems);
  const sortedCollections = collections.sort(compareContentCollections);

  return {
    items: sortedItems,
    collections: sortedCollections,
    publicItems: sortedItems.filter((item) => item.publicationState === "published"),
    publicCollections: sortedCollections.filter((collection) => collection.publicationState === "published"),
    itemsByKey,
    collectionsByKey: new Map(sortedCollections.map((collection) => [contentKey(collection.hall, collection.id), collection]))
  };
}

type TaxonomyIds = {
  categories: Set<string>;
  tags: Set<string>;
  projectMaintenanceStatuses: Set<string>;
};

async function readTaxonomyIds(): Promise<TaxonomyIds> {
  const raw = await fs.readFile(taxonomiesPath, "utf8");
  const taxonomy = taxonomyCatalogSchema.parse(load(raw));

  return {
    categories: new Set(taxonomy.categories.map((category) => category.id)),
    tags: new Set(taxonomy.tags.map((tag) => tag.id)),
    projectMaintenanceStatuses: new Set(
      taxonomy.project_maintenance_statuses.map((maintenanceStatus) => maintenanceStatus.id)
    )
  };
}

type ContentItemConfigEntry = ContentItemConfig & {
  directory: string;
  publicationState: ContentPublicationState;
};

type ContentCollectionConfigEntry = ContentCollectionConfig & {
  directory: string;
  publicationState: ContentPublicationState;
};

async function readContentConfigs(
  hallsById: Map<string, { availability: string }>,
  taxonomy: TaxonomyIds
): Promise<{
  itemConfigs: ContentItemConfigEntry[];
  collectionConfigs: ContentCollectionConfigEntry[];
}> {
  await assertContentRootShape();

  const itemConfigs: ContentItemConfigEntry[] = [];
  const collectionConfigs: ContentCollectionConfigEntry[] = [];

  for (const publicationState of contentPublicationStates) {
    const stateDirectory = path.join(contentRoot, publicationState);
    const hallDirectories = await readDirectories(stateDirectory);

    for (const hall of hallDirectories) {
      const hallConfig = hallsById.get(hall);

      if (!hallConfig) {
        throw new Error(`catalog/content/${publicationState} references unknown hall: ${hall}`);
      }

      if (hallConfig.availability !== "active") {
        throw new Error(`catalog/content/${publicationState} references planned hall without item contract: ${hall}`);
      }

      await assertHallContentDirectoryShape(publicationState, hall);
      itemConfigs.push(...(await readItemConfigs(publicationState, hall, taxonomy)));
      collectionConfigs.push(...(await readCollectionConfigs(publicationState, hall)));
    }
  }

  return { itemConfigs, collectionConfigs };
}

async function assertContentRootShape(): Promise<void> {
  const entries = await fs.readdir(contentRoot, { withFileTypes: true });
  const allowedStates: Set<string> = new Set(contentPublicationStates);
  const seenStates = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`catalog/content must only contain publication state directories: ${entry.name}`);
    }

    if (!allowedStates.has(entry.name)) {
      throw new Error(`catalog/content contains unknown publication state directory: ${entry.name}`);
    }

    seenStates.add(entry.name);
  }

  for (const publicationState of contentPublicationStates) {
    if (!seenStates.has(publicationState)) {
      throw new Error(`catalog/content is missing publication state directory: ${publicationState}`);
    }
  }
}

async function assertHallContentDirectoryShape(publicationState: ContentPublicationState, hall: string): Promise<void> {
  const directory = path.join(contentRoot, publicationState, hall);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const allowedKinds: Set<string> = new Set(contentKinds);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`catalog/content/${publicationState}/${hall} must only contain content kind directories`);
    }

    if (!allowedKinds.has(entry.name)) {
      throw new Error(`catalog/content/${publicationState}/${hall} contains unknown content kind: ${entry.name}`);
    }
  }
}

async function readItemConfigs(
  publicationState: ContentPublicationState,
  hall: string,
  taxonomy: TaxonomyIds
): Promise<ContentItemConfigEntry[]> {
  const itemRoot = path.join(contentRoot, publicationState, hall, "items");
  const directories = await readDirectoriesIfExists(itemRoot);

  return Promise.all(
    directories.map(async (directoryName) => {
      const directory = path.join(itemRoot, directoryName);
      const raw = await fs.readFile(path.join(directory, "item.yaml"), "utf8");
      const config = contentItemConfigSchema.parse(load(raw));

      if (config.id !== directoryName) {
        throw new Error(`Content item directory "${directoryName}" must match item id "${config.id}"`);
      }

      if (config.hall !== hall) {
        throw new Error(`${config.id} content item hall must match directory hall "${hall}"`);
      }

      assertKnownContentTaxonomy(config, taxonomy);
      await assertReferencedFilesExist({
        id: config.id,
        directory,
        body: config.body,
        notes: config.notes ?? []
      });

      return {
        ...config,
        directory,
        publicationState
      };
    })
  );
}

async function readCollectionConfigs(
  publicationState: ContentPublicationState,
  hall: string
): Promise<ContentCollectionConfigEntry[]> {
  const collectionRoot = path.join(contentRoot, publicationState, hall, "collections");
  const directories = await readDirectoriesIfExists(collectionRoot);

  return Promise.all(
    directories.map(async (directoryName) => {
      const directory = path.join(collectionRoot, directoryName);
      const raw = await fs.readFile(path.join(directory, "collection.yaml"), "utf8");
      const config = contentCollectionConfigSchema.parse(load(raw));

      if (config.id !== directoryName) {
        throw new Error(`Content collection directory "${directoryName}" must match collection id "${config.id}"`);
      }

      if (config.hall !== hall) {
        throw new Error(`${config.id} content collection hall must match directory hall "${hall}"`);
      }

      await assertReferencedFilesExist({
        id: config.id,
        directory,
        body: config.body,
        notes: []
      });

      return {
        ...config,
        directory,
        publicationState
      };
    })
  );
}

function adaptContentItem(entry: ContentItemConfigEntry): ContentItem {
  return {
    ...entry,
    blocks: adaptProjectBlocks(entry.blocks),
    notes: adaptContentNotes(entry),
    route: `/halls/${entry.hall}/items/${entry.id}/`
  };
}

function adaptContentNotes(item: ContentItemConfigEntry): ContentNote[] {
  const notes = item.notes ?? [];
  assertUniqueIds(`${item.hall}/${item.id} notes`, notes);

  return notes.map((note) => ({
    ...note,
    route: `/halls/${item.hall}/items/${item.id}/notes/${note.id}/`
  }));
}

function adaptContentCollection(
  entry: ContentCollectionConfigEntry,
  itemsByKey: Map<string, ContentItem>
): ContentCollection {
  assertUniqueCollectionItems(entry);

  return {
    ...entry,
    blocks: adaptProjectBlocks(entry.blocks),
    items: entry.items.map((item) => {
      const referencedItem = itemsByKey.get(contentKey(entry.hall, item.item));

      if (!referencedItem) {
        throw new Error(`${entry.id} content collection references unknown item: ${entry.hall}/${item.item}`);
      }

      return {
        item: referencedItem,
        note: item.note
      };
    }),
    route: `/halls/${entry.hall}/collections/${entry.id}/`
  };
}

function assertKnownContentTaxonomy(item: ContentItemConfig, taxonomy: TaxonomyIds): void {
  if (item.kind !== "github_project") {
    return;
  }

  if (!taxonomy.categories.has(item.profile.category)) {
    throw new Error(`${item.id} content item references unknown category: ${item.profile.category}`);
  }

  for (const tag of item.profile.tags) {
    if (!taxonomy.tags.has(tag)) {
      throw new Error(`${item.id} content item references unknown tag: ${tag}`);
    }
  }

  if (!taxonomy.projectMaintenanceStatuses.has(item.profile.maintenance_status)) {
    throw new Error(`${item.id} content item references unknown maintenance_status: ${item.profile.maintenance_status}`);
  }
}

function assertCollectionReferences(collections: ContentCollection[]): void {
  for (const collection of collections) {
    for (const item of collection.items) {
      if (item.item.hall !== collection.hall) {
        throw new Error(`${collection.id} content collection references item from another hall: ${item.item.id}`);
      }

      if (collection.publicationState === "published" && item.item.publicationState !== "published") {
        throw new Error(
          `${collection.id} published content collection references non-published item: ${item.item.id}`
        );
      }

      if (collection.publicationState === "drafts" && item.item.publicationState === "archived") {
        throw new Error(`${collection.id} draft content collection references archived item: ${item.item.id}`);
      }
    }
  }
}

function assertUniqueCollectionItems(collection: ContentCollectionConfigEntry): void {
  const seen = new Set<string>();

  for (const item of collection.items) {
    if (seen.has(item.item)) {
      throw new Error(`${collection.id} content collection references duplicate item: ${item.item}`);
    }

    seen.add(item.item);
  }
}

async function assertReferencedFilesExist(bundle: {
  id: string;
  directory: string;
  body: ContentItemConfig["body"];
  notes: ProjectNoteConfig[];
}): Promise<void> {
  const references = [
    { kind: "body", path: bundle.body.path },
    ...bundle.notes.map((note) => ({ kind: `note ${note.id}`, path: note.path }))
  ];
  const realBundleDirectory = await fs.realpath(bundle.directory);

  for (const reference of references) {
    const referencePath = resolveContentPath(bundle, reference.path);
    const stats = await fs.lstat(referencePath);

    if (stats.isSymbolicLink()) {
      throw new Error(`${bundle.id} references a symlink ${reference.kind} file: ${reference.path}`);
    }

    if (!stats.isFile()) {
      throw new Error(`${bundle.id} references a non-file ${reference.kind} path: ${reference.path}`);
    }

    const realReferencePath = await fs.realpath(referencePath);
    assertPathInsideBundle({ ...bundle, directory: realBundleDirectory }, realReferencePath, reference.path);
  }
}

function resolveContentPath(bundle: { id: string; directory: string }, relativePath: string): string {
  const fullPath = path.resolve(bundle.directory, relativePath);
  const relativeToBundle = path.relative(bundle.directory, fullPath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    throw new Error(`${bundle.id} references a path outside its content bundle: ${relativePath}`);
  }

  return fullPath;
}

function assertPathInsideBundle(bundle: { id: string; directory: string }, fullPath: string, relativePath: string): void {
  const relativeToBundle = path.relative(bundle.directory, fullPath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    throw new Error(`${bundle.id} references a path outside its content bundle: ${relativePath}`);
  }
}

async function readDirectories(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`${path.relative(repoRoot, directory)} must only contain directories: ${entry.name}`);
    }

    directories.push(entry.name);
  }

  return directories.sort();
}

async function readDirectoriesIfExists(directory: string): Promise<string[]> {
  try {
    return await readDirectories(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function assertUniqueBundleKeys(label: string, items: Array<{ hall: string; id: string }>): void {
  const seen = new Set<string>();

  for (const item of items) {
    const key = contentKey(item.hall, item.id);

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label} key: ${key}`);
    }

    seen.add(key);
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

function contentKey(hall: string, id: string): string {
  return `${hall}:${id}`;
}

function compareContentItems(a: ContentItem, b: ContentItem): number {
  return a.hall.localeCompare(b.hall) || a.title.localeCompare(b.title);
}

function compareContentCollections(a: ContentCollection, b: ContentCollection): number {
  return a.hall.localeCompare(b.hall) || a.title.localeCompare(b.title);
}
