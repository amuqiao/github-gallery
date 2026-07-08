import { z } from "zod";
import {
  collectionConfigSchema,
  collectionItemSchema,
  localeCodeSchema,
  localizedTextSchema,
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
export type CollectionConfig = z.infer<typeof collectionConfigSchema>;
export type CollectionItemConfig = z.infer<typeof collectionItemSchema>;
export type TaxonomyCatalog = z.infer<typeof taxonomyCatalogSchema>;
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export type LocaleCode = z.infer<typeof localeCodeSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
