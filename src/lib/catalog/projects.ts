import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { adaptProjectBlocks, type AdaptedProjectBlock } from "./block-adapters";
import {
  projectConfigSchema,
  siteConfigSchema,
  taxonomyCatalogSchema,
  type LocaleCode,
  type LocalizedText,
  type ProjectConfig,
  type SiteConfig,
  type TaxonomyCatalog as TaxonomyCatalogConfig,
  type TaxonomyItem as TaxonomyItemConfig
} from "./project-schema";

const repoRoot = process.cwd();
const catalogRoot = path.join(repoRoot, "catalog");
const projectsRoot = path.join(catalogRoot, "projects");
const taxonomiesPath = path.join(catalogRoot, "taxonomies.yaml");
const siteConfigPath = path.join(catalogRoot, "site.yaml");

export type Project = Omit<ProjectConfig, "blocks"> & {
  blocks: AdaptedProjectBlock[];
  directory: string;
  route: string;
};

export type LocalizedTaxonomyItem = Omit<TaxonomyItemConfig, "name" | "description"> & {
  label: string;
  descriptionText: string;
};

export type TaxonomyCatalog = Omit<TaxonomyCatalogConfig, "categories" | "tags"> & {
  categories: LocalizedTaxonomyItem[];
  tags: LocalizedTaxonomyItem[];
};

export type CatalogSnapshot = {
  projects: Project[];
  taxonomy: TaxonomyCatalog;
  site: SiteConfig;
  projectsById: Map<string, Project>;
  projectsByCategory: Map<string, Project[]>;
  projectsByTag: Map<string, Project[]>;
  categoriesById: Map<string, LocalizedTaxonomyItem>;
  tagsById: Map<string, LocalizedTaxonomyItem>;
};

let catalogSnapshot: Promise<CatalogSnapshot> | undefined;

export async function getSiteConfig(): Promise<SiteConfig> {
  const raw = await fs.readFile(siteConfigPath, "utf8");
  return siteConfigSchema.parse(load(raw));
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  catalogSnapshot ??= buildCatalogSnapshot();
  return catalogSnapshot;
}

export async function getTaxonomyCatalog(): Promise<TaxonomyCatalog> {
  return (await getCatalogSnapshot()).taxonomy;
}

export async function getAllProjects(): Promise<Project[]> {
  return (await getCatalogSnapshot()).projects;
}

export async function getProjectById(id: string): Promise<Project> {
  const snapshot = await getCatalogSnapshot();
  const project = snapshot.projectsById.get(id);

  if (!project) {
    throw new Error(`Unknown project id: ${id}`);
  }

  return project;
}

export async function getProjectsByCategory(category: string): Promise<Project[]> {
  return (await getCatalogSnapshot()).projectsByCategory.get(category) ?? [];
}

export async function getProjectsByTag(tag: string): Promise<Project[]> {
  return (await getCatalogSnapshot()).projectsByTag.get(tag) ?? [];
}

export async function getRelatedProjects(project: Project): Promise<Project[]> {
  const snapshot = await getCatalogSnapshot();
  return (project.relations?.related_projects ?? []).map((id) => {
    const relatedProject = snapshot.projectsById.get(id);

    if (!relatedProject) {
      throw new Error(`${project.id} references unknown related project: ${id}`);
    }

    return relatedProject;
  });
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

export function resolveProjectPath(project: Project, relativePath: string): string {
  const fullPath = path.resolve(project.directory, relativePath);
  const relativeToProject = path.relative(project.directory, fullPath);

  if (relativeToProject.startsWith("..") || path.isAbsolute(relativeToProject)) {
    throw new Error(`${project.id} references a path outside its project directory: ${relativePath}`);
  }

  return fullPath;
}

async function buildCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [taxonomy, site] = await Promise.all([readTaxonomyCatalog(), getSiteConfig()]);
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const projects = await Promise.all(directories.map((directory) => readProject(directory, taxonomy)));
  assertUniqueIds("projects", projects);
  assertRelatedProjectsExist(projects);
  const sortedProjects = projects.sort((a, b) => a.name.localeCompare(b.name));
  const projectsById = new Map(sortedProjects.map((project) => [project.id, project]));
  const categoriesById = new Map(taxonomy.categories.map((category) => [category.id, category]));
  const tagsById = new Map(taxonomy.tags.map((tag) => [tag.id, tag]));

  return {
    projects: sortedProjects,
    taxonomy,
    site,
    projectsById,
    projectsByCategory: groupProjectsByCategory(sortedProjects, taxonomy.categories),
    projectsByTag: groupProjectsByTag(sortedProjects, taxonomy.tags),
    categoriesById,
    tagsById
  };
}

async function readTaxonomyCatalog(): Promise<TaxonomyCatalog> {
  const raw = await fs.readFile(taxonomiesPath, "utf8");
  const parsed = taxonomyCatalogSchema.parse(load(raw));
  assertUniqueIds("categories", parsed.categories);
  assertUniqueIds("tags", parsed.tags);
  return localizeTaxonomyCatalog(parsed);
}

function localizeTaxonomyCatalog(taxonomy: TaxonomyCatalogConfig): TaxonomyCatalog {
  const locale = taxonomy.locale.default;

  return {
    ...taxonomy,
    categories: taxonomy.categories.map((category) => localizeTaxonomyItem(category, locale)),
    tags: taxonomy.tags.map((tag) => localizeTaxonomyItem(tag, locale))
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

async function readProject(directoryName: string, taxonomy: TaxonomyCatalog): Promise<Project> {
  const directory = path.join(projectsRoot, directoryName);
  const raw = await fs.readFile(path.join(directory, "project.yaml"), "utf8");
  const config = projectConfigSchema.parse(load(raw));

  if (config.id !== directoryName) {
    throw new Error(`Project directory "${directoryName}" must match project id "${config.id}"`);
  }

  assertKnownTaxonomy(config, taxonomy);
  const project = {
    ...config,
    blocks: adaptProjectBlocks(config.blocks),
    directory,
    route: `/projects/${config.id}/`
  };

  await assertReferencedFilesExist(project);
  return project;
}

function assertKnownTaxonomy(project: ProjectConfig, taxonomy: TaxonomyCatalog): void {
  const categoryIds = new Set(taxonomy.categories.map((category) => category.id));
  const tagIds = new Set(taxonomy.tags.map((tag) => tag.id));

  if (!categoryIds.has(project.category)) {
    throw new Error(`${project.id} references unknown category: ${project.category}`);
  }

  for (const tag of project.tags) {
    if (!tagIds.has(tag)) {
      throw new Error(`${project.id} references unknown tag: ${tag}`);
    }
  }
}

async function assertReferencedFilesExist(project: Project): Promise<void> {
  const references = [project.details?.path].filter((item): item is string => Boolean(item));

  for (const reference of references) {
    const referencePath = resolveProjectPath(project, reference);
    const stats = await fs.lstat(referencePath);

    if (stats.isSymbolicLink()) {
      throw new Error(`${project.id} references a symlink details file: ${reference}`);
    }
  }
}

function assertRelatedProjectsExist(projects: Project[]): void {
  const projectIds = new Set(projects.map((project) => project.id));

  for (const project of projects) {
    for (const relatedId of project.relations?.related_projects ?? []) {
      if (!projectIds.has(relatedId)) {
        throw new Error(`${project.id} references unknown related project: ${relatedId}`);
      }
    }
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

function groupProjectsByCategory(projects: Project[], categories: LocalizedTaxonomyItem[]): Map<string, Project[]> {
  const groups = new Map(categories.map((category) => [category.id, [] as Project[]]));

  for (const project of projects) {
    groups.get(project.category)?.push(project);
  }

  return groups;
}

function groupProjectsByTag(projects: Project[], tags: LocalizedTaxonomyItem[]): Map<string, Project[]> {
  const groups = new Map(tags.map((tag) => [tag.id, [] as Project[]]));

  for (const project of projects) {
    for (const tag of project.tags) {
      groups.get(tag)?.push(project);
    }
  }

  return groups;
}
