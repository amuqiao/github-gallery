import {
  getCategory,
  getTag,
  type Project,
  type LocalizedTaxonomyItem,
  type TaxonomyCatalog
} from "./projects";
import type { Collection } from "./collections";

export interface ProjectCardViewModel {
  project: Project;
  category: LocalizedTaxonomyItem;
  tags: LocalizedTaxonomyItem[];
  note?: string;
}

export function toProjectCardViewModel(
  project: Project,
  taxonomy: TaxonomyCatalog,
  note?: string
): ProjectCardViewModel {
  return {
    project,
    category: getCategory(taxonomy, project.category),
    tags: project.tags.map((tag) => getTag(taxonomy, tag)),
    note
  };
}

export function toProjectCardViewModels(
  projects: Project[],
  taxonomy: TaxonomyCatalog
): ProjectCardViewModel[] {
  return projects.map((project) => toProjectCardViewModel(project, taxonomy));
}

export function toCollectionProjectCardViewModels(
  collection: Collection,
  taxonomy: TaxonomyCatalog
): ProjectCardViewModel[] {
  return collection.projectItems.map((item) => toProjectCardViewModel(item.project, taxonomy, item.note));
}
