import { getPublishedContentItems, type ContentItem, type ContentNote } from "./content";
import { getCategory, getProjectMaintenanceStatus, getTag, getTaxonomyCatalog } from "./taxonomy";

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
    const itemLabels = labelsForItem(item, taxonomy);

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
      const noteLabels = labelsForNote(note, item, itemLabels);

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

function labelsForItem(item: ContentItem, taxonomy: Awaited<ReturnType<typeof getTaxonomyCatalog>>): string[] {
  if (item.kind === "ai_model") {
    const profile = item.profile;
    return uniqueLabels([
      "模型",
      profile.provider,
      ...profile.modalities.input,
      ...profile.modalities.output,
      ...profile.tasks,
      ...profile.access,
      ...profile.formats,
      ...profile.runtimes,
      profile.license
    ]);
  }

  if (item.kind === "knowledge_article") {
    const profile = item.profile;
    return uniqueLabels(["知识", profile.domain, ...profile.topics, ...(profile.audience ?? [])]);
  }

  const profile = item.profile;
  return uniqueLabels([
    "项目",
    getCategory(taxonomy, profile.category).label,
    getProjectMaintenanceStatus(taxonomy, profile.maintenance_status).label,
    ...profile.tags.map((tag) => getTag(taxonomy, tag).label),
    ...(profile.languages ?? []),
    profile.license
  ]);
}

function labelsForNote(note: ContentNote, item: ContentItem, itemLabels: string[]): string[] {
  return uniqueLabels(["笔记", note.type === "html" ? "HTML" : "Markdown", item.title, item.hall, item.kind, ...itemLabels]);
}

function buildSearchText(parts: Array<string | undefined>, labels: string[]): string {
  return normalizeSearchText([...parts, ...labels].filter((part): part is string => Boolean(part)).join(" "));
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s\-_/|·:：,，.。()[\]{}]+/g, "");
}

function uniqueLabels(labels: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of labels) {
    const trimmed = label?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function compareRecentEntries(a: PublishedSearchEntry, b: PublishedSearchEntry): number {
  return (
    b.added_at.localeCompare(a.added_at) ||
    a.hall.localeCompare(b.hall) ||
    a.type.localeCompare(b.type) ||
    a.title.localeCompare(b.title)
  );
}
