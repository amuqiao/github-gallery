import { z } from "zod";
import {
  collectionConfigSchema,
  collectionItemSchema,
  contentBodySchema,
  contentCollectionConfigSchema,
  contentCollectionItemSchema,
  contentItemConfigSchema,
  hallConfigSchema,
  localeCodeSchema,
  localizedTextSchema,
  modelConfigSchema,
  projectBlockSchema,
  projectNoteSchema,
  projectConfigSchema,
  siteConfigSchema,
  taxonomyCatalogSchema,
  taxonomyItemSchema
} from "./catalog-schema.js";

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ProjectBlock = z.infer<typeof projectBlockSchema>;
export type ProjectNoteConfig = z.infer<typeof projectNoteSchema>;
export type HallConfig = z.infer<typeof hallConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type CollectionConfig = z.infer<typeof collectionConfigSchema>;
export type CollectionItemConfig = z.infer<typeof collectionItemSchema>;
export type ContentBodyConfig = z.infer<typeof contentBodySchema>;
export type ContentItemConfig = z.infer<typeof contentItemConfigSchema>;
export type ContentCollectionConfig = z.infer<typeof contentCollectionConfigSchema>;
export type ContentCollectionItemConfig = z.infer<typeof contentCollectionItemSchema>;
export type TaxonomyCatalog = z.infer<typeof taxonomyCatalogSchema>;
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export type LocaleCode = z.infer<typeof localeCodeSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
