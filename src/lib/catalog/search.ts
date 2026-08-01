import { getPublishedContentItems, type ContentItem } from "./content";
import { projectContentItemSearch, projectContentNoteSearch } from "./projections";
import { getTaxonomyCatalog } from "./taxonomy";

export type PublishedSearchEntryType = "item" | "note";

export type PublishedSearchEntry = {
  id: string;
  type: PublishedSearchEntryType;
  hall: string;
  kind: ContentItem["kind"];
  title: string;
  summary: string;
  route: string;
  added_at: string;
  parentTitle?: string;
  labels: string[];
  searchText: string;
};

let publishedSearchEntries: Promise<PublishedSearchEntry[]> | undefined;

export async function getPublishedSearchEntries(): Promise<PublishedSearchEntry[]> {
  publishedSearchEntries ??= buildPublishedSearchEntries();
  return publishedSearchEntries;
}

export async function getRecentPublishedEntries(limit?: number): Promise<PublishedSearchEntry[]> {
  const entries = [...(await getPublishedSearchEntries())].sort(compareRecentEntries);
  return typeof limit === "number" ? entries.slice(0, limit) : entries;
}

async function buildPublishedSearchEntries(): Promise<PublishedSearchEntry[]> {
  const [items, taxonomy] = await Promise.all([getPublishedContentItems(), getTaxonomyCatalog()]);
  const entries: PublishedSearchEntry[] = [];

  for (const item of items) {
    const itemLabels = projectContentItemSearch(item, taxonomy).labels;

    entries.push({
      id: `${item.hall}:${item.id}`,
      type: "item",
      hall: item.hall,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      route: item.route,
      added_at: item.added_at,
      labels: itemLabels,
      searchText: buildSearchText([item.id, item.hall, item.kind, item.title, item.summary, item.source.type], itemLabels)
    });

    for (const note of item.notes) {
      const noteLabels = projectContentNoteSearch(note, item, itemLabels).labels;

      entries.push({
        id: `${item.hall}:${item.id}:note:${note.id}`,
        type: "note",
        hall: item.hall,
        kind: item.kind,
        title: note.title,
        summary: note.summary,
        route: note.route,
        added_at: note.added_at,
        parentTitle: item.title,
        labels: noteLabels,
        searchText: buildSearchText(
          [note.id, note.type, note.title, note.summary, item.id, item.hall, item.kind, item.title, item.summary],
          noteLabels
        )
      });
    }
  }

  return entries.sort((a, b) => a.hall.localeCompare(b.hall) || a.title.localeCompare(b.title));
}

function buildSearchText(parts: Array<string | undefined>, labels: string[]): string {
  return normalizeSearchText([...parts, ...labels].filter((part): part is string => Boolean(part)).join(" "));
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/|·:：,，.。()[\]{}]+/g, "");
}

function compareRecentEntries(a: PublishedSearchEntry, b: PublishedSearchEntry): number {
  return (
    b.added_at.localeCompare(a.added_at) ||
    a.hall.localeCompare(b.hall) ||
    a.type.localeCompare(b.type) ||
    a.title.localeCompare(b.title)
  );
}
