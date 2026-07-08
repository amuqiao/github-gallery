import type { Project } from "./projects";

type MarkdownModule = {
  Content: (_props: Record<string, unknown>) => unknown;
};

const markdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/projects/*/details.md")
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
