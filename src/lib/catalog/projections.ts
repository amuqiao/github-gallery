import type { ContentItem, ContentNote } from "./content";
import { getCategory, getProjectMaintenanceStatus, getTag, type TaxonomyCatalog } from "./taxonomy";

export type ContentItemStat = {
  label: string;
  value: string | number;
};

export type ContentItemCardProjection = {
  kindLabel: string;
  primaryFacts: string[];
  tagPreview: string[];
  footerText: string;
};

export type ContentItemDetailHeaderProjection = {
  kindLabel: string;
  stats: ContentItemStat[];
  badges: string[];
};

export type ContentItemSearchProjection = {
  labels: string[];
};

export type ContentNoteSearchProjection = {
  labels: string[];
};

export function projectContentItemCard(
  item: ContentItem,
  taxonomy?: TaxonomyCatalog
): ContentItemCardProjection {
  const sourceLabel = item.source.type;

  if (item.kind === "ai_model") {
    const profile = item.profile;
    const primaryFacts = [profile.provider, profile.formats.join(" · "), profile.runtimes.join(" · ")];

    return {
      kindLabel: "模型",
      primaryFacts,
      tagPreview: profile.tasks.slice(0, 4),
      footerText: primaryFacts.filter(Boolean).join(" · ") || sourceLabel
    };
  }

  if (item.kind === "knowledge_article") {
    const profile = item.profile;
    const primaryFacts = [profile.domain, sourceLabel];

    return {
      kindLabel: "知识",
      primaryFacts,
      tagPreview: profile.topics.slice(0, 4),
      footerText: primaryFacts.filter(Boolean).join(" · ") || sourceLabel
    };
  }

  const profile = item.profile;
  const resolvedTaxonomy = requireTaxonomy(item, taxonomy);
  const kindLabel = getCategory(resolvedTaxonomy, profile.category).label;
  const primaryFacts = [profile.languages?.[0], profile.license].filter((fact): fact is string => Boolean(fact));

  return {
    kindLabel,
    primaryFacts,
    tagPreview: profile.tags.slice(0, 4).map((tag) => getTag(resolvedTaxonomy, tag).label),
    footerText: primaryFacts.filter(Boolean).join(" · ") || sourceLabel
  };
}

export function projectContentItemDetailHeader(
  item: ContentItem,
  taxonomy?: TaxonomyCatalog
): ContentItemDetailHeaderProjection {
  if (item.kind === "ai_model") {
    const profile = item.profile;

    return {
      kindLabel: "模型",
      stats: [
        { label: "提供方", value: profile.provider },
        { label: "模态", value: `${profile.modalities.input.join("+")} -> ${profile.modalities.output.join("+")}` },
        { label: "格式", value: profile.formats.join(" · ") }
      ],
      badges: profile.tasks
    };
  }

  if (item.kind === "knowledge_article") {
    const profile = item.profile;
    const stats: ContentItemStat[] = [
      { label: "领域", value: profile.domain },
      { label: "主题", value: profile.topics.join(" · ") },
      { label: "来源", value: item.source.type }
    ];

    if (profile.audience) {
      stats.push({ label: "适合", value: profile.audience.join(" · ") });
    }

    return {
      kindLabel: "知识",
      stats,
      badges: profile.topics
    };
  }

  const profile = item.profile;
  const resolvedTaxonomy = requireTaxonomy(item, taxonomy);
  const category = getCategory(resolvedTaxonomy, profile.category);
  const tags = profile.tags.map((tag) => getTag(resolvedTaxonomy, tag));
  const maintenanceStatus = getProjectMaintenanceStatus(resolvedTaxonomy, profile.maintenance_status);

  return {
    kindLabel: "项目",
    stats: [
      { label: "分类", value: category.label },
      { label: "维护", value: maintenanceStatus.label },
      { label: "语言", value: profile.languages?.[0] ?? "Unknown" },
      { label: "License", value: profile.license ?? "Unknown" }
    ],
    badges: tags.map((tag) => tag.label)
  };
}

export function projectContentItemSearch(
  item: ContentItem,
  taxonomy?: TaxonomyCatalog
): ContentItemSearchProjection {
  if (item.kind === "ai_model") {
    const profile = item.profile;

    return {
      labels: uniqueLabels([
        "模型",
        profile.provider,
        ...profile.modalities.input,
        ...profile.modalities.output,
        ...profile.tasks,
        ...profile.access,
        ...profile.formats,
        ...profile.runtimes,
        profile.license
      ])
    };
  }

  if (item.kind === "knowledge_article") {
    const profile = item.profile;

    return {
      labels: uniqueLabels(["知识", profile.domain, ...profile.topics, ...(profile.audience ?? [])])
    };
  }

  const profile = item.profile;
  const resolvedTaxonomy = requireTaxonomy(item, taxonomy);

  return {
    labels: uniqueLabels([
      "项目",
      getCategory(resolvedTaxonomy, profile.category).label,
      getProjectMaintenanceStatus(resolvedTaxonomy, profile.maintenance_status).label,
      ...profile.tags.map((tag) => getTag(resolvedTaxonomy, tag).label),
      ...(profile.languages ?? []),
      profile.license
    ])
  };
}

export function projectContentNoteSearch(
  note: ContentNote,
  item: ContentItem,
  itemLabels: string[]
): ContentNoteSearchProjection {
  return {
    labels: uniqueLabels([
      "笔记",
      note.type === "html" ? "HTML" : "Markdown",
      item.title,
      item.hall,
      item.kind,
      ...itemLabels
    ])
  };
}

function requireTaxonomy(item: ContentItem, taxonomy: TaxonomyCatalog | undefined): TaxonomyCatalog {
  if (!taxonomy) {
    throw new Error(`${item.hall}/${item.id} ${item.kind} projection requires taxonomy catalog`);
  }

  return taxonomy;
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
