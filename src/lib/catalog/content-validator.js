import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import {
  contentCollectionConfigSchema,
  contentItemConfigSchema,
  contentPublicationStates,
  hallConfigSchema,
  taxonomyCatalogSchema
} from "./catalog-schema.js";

const repoRoot = process.cwd();
const catalogRoot = path.join(repoRoot, "catalog");
const contentRoot = path.join(catalogRoot, "content");
const hallsRoot = path.join(catalogRoot, "halls");
const taxonomiesPath = path.join(catalogRoot, "taxonomies.yaml");
const contentKinds = ["items", "collections"];

export async function readValidatedContentCatalog() {
  const [hallsById, taxonomy] = await Promise.all([readHalls(), readTaxonomyIds()]);
  const { itemConfigs, collectionConfigs } = await readContentConfigs(hallsById, taxonomy);

  assertUniqueBundleKeys("content items", itemConfigs);
  assertUniqueBundleKeys("content collections", collectionConfigs);
  assertContentItemRelations(itemConfigs);
  assertCollectionReferences(itemConfigs, collectionConfigs);

  return { itemConfigs, collectionConfigs };
}

async function readHalls() {
  const hallDirectories = await readDirectories(hallsRoot);
  const hallsById = new Map();

  for (const directoryName of hallDirectories) {
    const hallPath = path.join(hallsRoot, directoryName, "hall.yaml");
    const hall = hallConfigSchema.parse(load(await fs.readFile(hallPath, "utf8")));

    if (hall.id !== directoryName) {
      throw new Error(`Hall directory "${directoryName}" must match hall id "${hall.id}"`);
    }

    hallsById.set(hall.id, hall);
  }

  return hallsById;
}

async function readTaxonomyIds() {
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

async function readContentConfigs(hallsById, taxonomy) {
  await assertContentRootShape();

  const itemConfigs = [];
  const collectionConfigs = [];

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

async function assertContentRootShape() {
  const entries = await fs.readdir(contentRoot, { withFileTypes: true });
  const allowedStates = new Set(contentPublicationStates);
  const seenStates = new Set();

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

async function assertHallContentDirectoryShape(publicationState, hall) {
  const directory = path.join(contentRoot, publicationState, hall);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const allowedKinds = new Set(contentKinds);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`catalog/content/${publicationState}/${hall} must only contain content kind directories`);
    }

    if (!allowedKinds.has(entry.name)) {
      throw new Error(`catalog/content/${publicationState}/${hall} contains unknown content kind: ${entry.name}`);
    }
  }
}

async function readItemConfigs(publicationState, hall, taxonomy) {
  const itemRoot = path.join(contentRoot, publicationState, hall, "items");
  const directories = await readDirectoriesIfExists(itemRoot);
  const itemConfigs = [];

  for (const directoryName of directories) {
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
    assertUniqueIds(`${config.hall}/${config.id} notes`, config.notes ?? []);
    await assertReferencedFilesExist({
      id: config.id,
      directory,
      body: config.body,
      notes: config.notes ?? []
    });

    itemConfigs.push({
      ...config,
      directory,
      publicationState
    });
  }

  return itemConfigs;
}

async function readCollectionConfigs(publicationState, hall) {
  const collectionRoot = path.join(contentRoot, publicationState, hall, "collections");
  const directories = await readDirectoriesIfExists(collectionRoot);
  const collectionConfigs = [];

  for (const directoryName of directories) {
    const directory = path.join(collectionRoot, directoryName);
    const raw = await fs.readFile(path.join(directory, "collection.yaml"), "utf8");
    const config = contentCollectionConfigSchema.parse(load(raw));

    if (config.id !== directoryName) {
      throw new Error(`Content collection directory "${directoryName}" must match collection id "${config.id}"`);
    }

    if (config.hall !== hall) {
      throw new Error(`${config.id} content collection hall must match directory hall "${hall}"`);
    }

    assertUniqueCollectionItems(config);
    await assertReferencedFilesExist({
      id: config.id,
      directory,
      body: config.body,
      notes: []
    });

    collectionConfigs.push({
      ...config,
      directory,
      publicationState
    });
  }

  return collectionConfigs;
}

function assertKnownContentTaxonomy(item, taxonomy) {
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

async function assertReferencedFilesExist(bundle) {
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

function resolveContentPath(bundle, relativePath) {
  const fullPath = path.resolve(bundle.directory, relativePath);
  const relativeToBundle = path.relative(bundle.directory, fullPath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    throw new Error(`${bundle.id} references a path outside its content bundle: ${relativePath}`);
  }

  return fullPath;
}

function assertPathInsideBundle(bundle, fullPath, relativePath) {
  const relativeToBundle = path.relative(bundle.directory, fullPath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    throw new Error(`${bundle.id} references a path outside its content bundle: ${relativePath}`);
  }
}

function assertCollectionReferences(items, collections) {
  const itemsByKey = new Map(items.map((item) => [contentKey(item.hall, item.id), item]));

  for (const collection of collections) {
    for (const itemRef of collection.items) {
      const item = itemsByKey.get(contentKey(collection.hall, itemRef.item));

      if (!item) {
        throw new Error(`${collection.id} content collection references unknown item: ${collection.hall}/${itemRef.item}`);
      }

      if (collection.publicationState === "published" && item.publicationState !== "published") {
        throw new Error(`${collection.id} published content collection references non-published item: ${item.id}`);
      }

      if (collection.publicationState === "drafts" && item.publicationState === "archived") {
        throw new Error(`${collection.id} draft content collection references archived item: ${item.id}`);
      }
    }
  }
}

function assertContentItemRelations(items) {
  const itemsByKey = new Map(items.map((item) => [contentKey(item.hall, item.id), item]));

  for (const item of items) {
    if (item.kind !== "github_project") {
      continue;
    }

    for (const relatedId of item.relations?.related_projects ?? []) {
      const relatedItem = itemsByKey.get(contentKey(item.hall, relatedId));

      if (!relatedItem) {
        throw new Error(`${item.id} content item references unknown related project: ${item.hall}/${relatedId}`);
      }

      if (item.publicationState === "published" && relatedItem.publicationState !== "published") {
        throw new Error(`${item.id} published content item references non-published related project: ${relatedId}`);
      }
    }
  }
}

function assertUniqueCollectionItems(collection) {
  const seen = new Set();

  for (const item of collection.items) {
    if (seen.has(item.item)) {
      throw new Error(`${collection.id} content collection references duplicate item: ${item.item}`);
    }

    seen.add(item.item);
  }
}

function assertUniqueBundleKeys(label, items) {
  const seen = new Set();

  for (const item of items) {
    const key = contentKey(item.hall, item.id);

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label} key: ${key}`);
    }

    seen.add(key);
  }
}

function assertUniqueIds(label, items) {
  const seen = new Set();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }

    seen.add(item.id);
  }
}

async function readDirectories(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`${path.relative(repoRoot, directory)} must only contain directories: ${entry.name}`);
    }

    directories.push(entry.name);
  }

  return directories.sort();
}

async function readDirectoriesIfExists(directory) {
  try {
    return await readDirectories(directory);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function contentKey(hall, id) {
  return `${hall}:${id}`;
}
