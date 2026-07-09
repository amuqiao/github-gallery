import { adaptProjectBlocks, type AdaptedProjectBlock } from "./block-adapters";
import { contentPublicationStates } from "./catalog-schema.js";
import { readValidatedContentCatalog } from "./content-validator.js";
import type { ContentCollectionConfig, ContentItemConfig, ProjectNoteConfig } from "./catalog-types";

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

export async function getPublishedContentItemsByHall(hall: string): Promise<ContentItem[]> {
  return (await getPublishedContentItems()).filter((item) => item.hall === hall);
}

export async function getPublishedContentItemsByHallAndKind(
  hall: string,
  kind: ContentItem["kind"]
): Promise<ContentItem[]> {
  return (await getPublishedContentItemsByHall(hall)).filter((item) => item.kind === kind);
}

export async function getPublishedContentCollectionsByHall(hall: string): Promise<ContentCollection[]> {
  return (await getPublishedContentCollections()).filter((collection) => collection.hall === hall);
}

export async function getPublishedContentCollectionsForItem(hall: string, itemId: string): Promise<ContentCollection[]> {
  return (await getPublishedContentCollectionsByHall(hall)).filter((collection) =>
    collection.items.some((entry) => entry.item.id === itemId)
  );
}

export function getContentItemNoteById(item: ContentItem, noteId: string): ContentNote {
  const note = item.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new Error(`${item.hall}/${item.id} references unknown content note: ${noteId}`);
  }

  return note;
}

async function buildContentCatalogSnapshot(): Promise<ContentCatalogSnapshot> {
  const { itemConfigs, collectionConfigs } = (await readValidatedContentCatalog()) as {
    itemConfigs: ContentItemConfigEntry[];
    collectionConfigs: ContentCollectionConfigEntry[];
  };

  const items = itemConfigs.map((entry) => adaptContentItem(entry));
  const itemsByKey = new Map(items.map((item) => [contentKey(item.hall, item.id), item]));
  const collections = collectionConfigs.map((entry) => adaptContentCollection(entry, itemsByKey));

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

type ContentItemConfigEntry = ContentItemConfig & {
  directory: string;
  publicationState: ContentPublicationState;
};

type ContentCollectionConfigEntry = ContentCollectionConfig & {
  directory: string;
  publicationState: ContentPublicationState;
};

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

  return notes.map((note) => ({
    ...note,
    route: `/halls/${item.hall}/items/${item.id}/notes/${note.id}/`
  }));
}

function adaptContentCollection(
  entry: ContentCollectionConfigEntry,
  itemsByKey: Map<string, ContentItem>
): ContentCollection {
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

function contentKey(hall: string, id: string): string {
  return `${hall}:${id}`;
}

function compareContentItems(a: ContentItem, b: ContentItem): number {
  return a.hall.localeCompare(b.hall) || a.title.localeCompare(b.title);
}

function compareContentCollections(a: ContentCollection, b: ContentCollection): number {
  return a.hall.localeCompare(b.hall) || a.title.localeCompare(b.title);
}
