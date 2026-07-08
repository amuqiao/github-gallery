import { getCategory, getTag, type Project, type TaxonomyCatalog, type TaxonomyItem } from "./projects";

export interface ProjectCardViewModel {
  project: Project;
  category: TaxonomyItem;
  tags: TaxonomyItem[];
}

export function toProjectCardViewModel(project: Project, taxonomy: TaxonomyCatalog): ProjectCardViewModel {
  return {
    project,
    category: getCategory(taxonomy, project.category),
    tags: project.tags.map((tag) => getTag(taxonomy, tag))
  };
}

export function toProjectCardViewModels(
  projects: Project[],
  taxonomy: TaxonomyCatalog
): ProjectCardViewModel[] {
  return projects.map((project) => toProjectCardViewModel(project, taxonomy));
}
