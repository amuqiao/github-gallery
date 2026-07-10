import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { taxonomyCatalogSchema } from "./catalog-schema.js";
import type {
  LocaleCode,
  LocalizedText,
  TaxonomyCatalog as TaxonomyCatalogConfig,
  TaxonomyItem as TaxonomyItemConfig
} from "./catalog-types";

const repoRoot = process.cwd();
const taxonomiesPath = path.join(repoRoot, "catalog", "taxonomies.yaml");

export type LocalizedTaxonomyItem = Omit<TaxonomyItemConfig, "name" | "description"> & {
  label: string;
  descriptionText: string;
};

export type LocalizedProjectMaintenanceStatusItem = Omit<TaxonomyItemConfig, "name" | "description"> & {
  label: string;
  descriptionText: string;
};

export type TaxonomyCatalog = Omit<TaxonomyCatalogConfig, "categories" | "tags" | "project_maintenance_statuses"> & {
  categories: LocalizedTaxonomyItem[];
  tags: LocalizedTaxonomyItem[];
  project_maintenance_statuses: LocalizedProjectMaintenanceStatusItem[];
};

let taxonomySnapshot: Promise<TaxonomyCatalog> | undefined;

export async function getTaxonomyCatalog(): Promise<TaxonomyCatalog> {
  taxonomySnapshot ??= readTaxonomyCatalog();
  return taxonomySnapshot;
}

export function getCategory(taxonomy: TaxonomyCatalog, id: string): LocalizedTaxonomyItem {
  const item = taxonomy.categories.find((category) => category.id === id);

  if (!item) {
    throw new Error(`Unknown category id: ${id}`);
  }

  return item;
}

export function getTag(taxonomy: TaxonomyCatalog, id: string): LocalizedTaxonomyItem {
  const item = taxonomy.tags.find((tag) => tag.id === id);

  if (!item) {
    throw new Error(`Unknown tag id: ${id}`);
  }

  return item;
}

export function getProjectMaintenanceStatus(
  taxonomy: TaxonomyCatalog,
  id: string
): LocalizedProjectMaintenanceStatusItem {
  const item = taxonomy.project_maintenance_statuses.find((maintenanceStatus) => maintenanceStatus.id === id);

  if (!item) {
    throw new Error(`Unknown project maintenance status id: ${id}`);
  }

  return item;
}

async function readTaxonomyCatalog(): Promise<TaxonomyCatalog> {
  const raw = await fs.readFile(taxonomiesPath, "utf8");
  const parsed = taxonomyCatalogSchema.parse(load(raw));
  assertUniqueIds("categories", parsed.categories);
  assertUniqueIds("tags", parsed.tags);
  assertUniqueIds("project_maintenance_statuses", parsed.project_maintenance_statuses);
  return localizeTaxonomyCatalog(parsed);
}

function localizeTaxonomyCatalog(taxonomy: TaxonomyCatalogConfig): TaxonomyCatalog {
  const locale = taxonomy.locale.default;

  return {
    ...taxonomy,
    categories: taxonomy.categories.map((category) => localizeTaxonomyItem(category, locale)),
    tags: taxonomy.tags.map((tag) => localizeTaxonomyItem(tag, locale)),
    project_maintenance_statuses: taxonomy.project_maintenance_statuses.map((maintenanceStatus) =>
      localizeTaxonomyItem(maintenanceStatus, locale)
    )
  };
}

function localizeTaxonomyItem(item: TaxonomyItemConfig, locale: LocaleCode): LocalizedTaxonomyItem {
  return {
    id: item.id,
    label: localizeText(item.name, locale),
    descriptionText: localizeText(item.description, locale)
  };
}

function localizeText(text: LocalizedText, locale: LocaleCode): string {
  return text[locale];
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
