import type { CollectionConfig } from "@/lib/catalog/catalog-types";

type PublicationStatus = CollectionConfig["publication_status"];

const publicationStatusLabels = {
  published: "已发布",
  draft: "草稿",
  archived: "已归档"
} satisfies Record<PublicationStatus, string>;

export function getPublicationStatusLabel(publicationStatus: PublicationStatus): string {
  return publicationStatusLabels[publicationStatus];
}
