import type { Collection } from "./collections";
import type { Project } from "./projects";

type MarkdownModule = {
  Content: (_props: Record<string, unknown>) => unknown;
};

const markdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/projects/*/details.md")
};

const collectionMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/collections/*/details.md")
};

export type ProjectDetail = {
  type: "markdown";
  Content: (_props: Record<string, unknown>) => unknown;
};

export async function loadProjectDetail(project: Project): Promise<ProjectDetail | undefined> {
  if (!project.details) {
    return undefined;
  }

  const key = `../../../catalog/projects/${project.id}/${project.details.path.replace("./", "")}`;
  const loader = markdownModules[key];

  if (!loader) {
    throw new Error(`${project.id} details module is not registered: ${project.details.path}`);
  }

  const module = await loader();
  return {
    type: project.details.type,
    Content: module.Content
  };
}

export type CollectionDetail = {
  type: "markdown";
  Content: (_props: Record<string, unknown>) => unknown;
};

export async function loadCollectionDetail(collection: Collection): Promise<CollectionDetail | undefined> {
  if (!collection.details) {
    return undefined;
  }

  const key = `../../../catalog/collections/${collection.id}/${collection.details.path.replace("./", "")}`;
  const loader = collectionMarkdownModules[key];

  if (!loader) {
    throw new Error(`${collection.id} collection details module is not registered: ${collection.details.path}`);
  }

  const module = await loader();
  return {
    type: collection.details.type,
    Content: module.Content
  };
}
