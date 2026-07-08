import type { PresentationLayout, PresentationLayoutId } from "@/presentation/types";

export const presentationLayouts: Record<PresentationLayoutId, PresentationLayout> = {
  "bento-editorial": {
    id: "bento-editorial",
    label: "Bento Editorial",
    description: "Hub-first editorial layout with bento summary, curated shelves, and reusable project cards.",
    home: {
      sectionOrder: ["filters", "collections", "projects"],
      filterPanelVariant: "editorial",
      collectionGridVariant: "shelf",
      projectCollectionVariant: "editorial",
      featureFirstProject: true
    },
    listPages: {
      collectionGridVariant: "shelf",
      projectCollectionVariant: "editorial"
    },
    detailPages: {
      projectCollectionVariant: "ordered",
      relatedProjectCollectionVariant: "standard"
    }
  }
};
