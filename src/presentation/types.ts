export type PresentationThemeId = "editorial-paper";
export type PresentationLayoutId = "bento-editorial";

export type HomeSectionId = "filters" | "collections" | "projects";
export type ProjectCollectionVariant = "standard" | "editorial" | "ordered";
export type CollectionGridVariant = "standard" | "shelf";
export type FilterPanelVariant = "standard" | "editorial";

export interface PresentationTheme {
  id: PresentationThemeId;
  label: string;
  description: string;
}

export interface PresentationLayout {
  id: PresentationLayoutId;
  label: string;
  description: string;
  home: {
    sectionOrder: HomeSectionId[];
    filterPanelVariant: FilterPanelVariant;
    collectionGridVariant: CollectionGridVariant;
    projectCollectionVariant: ProjectCollectionVariant;
    featureFirstProject: boolean;
  };
  listPages: {
    collectionGridVariant: CollectionGridVariant;
    projectCollectionVariant: ProjectCollectionVariant;
  };
  detailPages: {
    projectCollectionVariant: ProjectCollectionVariant;
    relatedProjectCollectionVariant: ProjectCollectionVariant;
    collectionGridVariant: CollectionGridVariant;
  };
}

export interface PresentationHomeConfig {
  featuredCollectionId: string;
}
