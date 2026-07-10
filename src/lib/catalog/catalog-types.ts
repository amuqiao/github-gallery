import { z } from "zod";
import {
  contentBodySchema,
  contentCollectionConfigSchema,
  contentCollectionItemSchema,
  contentItemConfigSchema,
  hallConfigSchema,
  localeCodeSchema,
  localizedTextSchema,
  projectBlockSchema,
  projectNoteSchema,
  siteConfigSchema,
  taxonomyCatalogSchema,
  taxonomyItemSchema
} from "./catalog-schema.js";

export type ProjectBlock = z.infer<typeof projectBlockSchema>;
export type ProjectNoteConfig = z.infer<typeof projectNoteSchema>;
export type HallConfig = z.infer<typeof hallConfigSchema>;
export type ContentBodyConfig = z.infer<typeof contentBodySchema>;
export type ContentItemConfig = z.infer<typeof contentItemConfigSchema>;
export type ContentCollectionConfig = z.infer<typeof contentCollectionConfigSchema>;
export type ContentCollectionItemConfig = z.infer<typeof contentCollectionItemSchema>;
export type TaxonomyCatalog = z.infer<typeof taxonomyCatalogSchema>;
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export type LocaleCode = z.infer<typeof localeCodeSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
