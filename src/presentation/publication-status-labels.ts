import type { CollectionConfig } from "@/lib/catalog/catalog-types";

type PublicationStatus = CollectionConfig["publication_status"];

const publicationStatusLabels = {
  published: "Published",
  draft: "Draft",
  archived: "Archived"
} satisfies Record<PublicationStatus, string>;

export function getPublicationStatusLabel(publicationStatus: PublicationStatus): string {
  return publicationStatusLabels[publicationStatus];
}
