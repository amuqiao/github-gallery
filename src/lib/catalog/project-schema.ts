import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

const relativePathSchema = z
  .string()
  .regex(relativePathPattern, "Path must be a relative catalog item-local path such as ./details.md");

const nonEmptyString = z.string().trim().min(1);

export const detailsSchema = z
  .object({
    type: z.literal("markdown"),
    path: relativePathSchema
  })
  .strict()
  .superRefine((details, ctx) => {
    if (details.path !== "./details.md") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "details.path must be ./details.md in schema_version 1",
        path: ["path"]
      });
    }
  });

export const metaSchema = z
  .object({
    license: nonEmptyString.optional(),
    languages: z.array(nonEmptyString).min(1).optional()
  })
  .strict();

export const relationsSchema = z
  .object({
    related_projects: z.array(z.string().regex(slugPattern)).min(1).optional()
  })
  .strict();

export const linksBlockSchema = z
  .object({
    type: z.literal("links"),
    title: nonEmptyString.optional(),
    items: z
      .array(
        z
          .object({
            label: nonEmptyString,
            url: z.string().url()
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export const highlightsBlockSchema = z
  .object({
    type: z.literal("highlights"),
    title: nonEmptyString.optional(),
    items: z.array(nonEmptyString).min(1)
  })
  .strict();

export const useCasesBlockSchema = z
  .object({
    type: z.literal("use-cases"),
    title: nonEmptyString.optional(),
    items: z.array(nonEmptyString).min(1)
  })
  .strict();

export const projectBlockSchema = z.discriminatedUnion("type", [
  linksBlockSchema,
  highlightsBlockSchema,
  useCasesBlockSchema
]);

export const projectConfigSchema = z
  .object({
    schema_version: z.literal(1),
    id: z.string().regex(slugPattern, "id must use lowercase kebab-case"),
    name: nonEmptyString,
    repo: z.string().url(),
    summary: nonEmptyString.max(160),
    category: z.string().regex(slugPattern),
    tags: z.array(z.string().regex(slugPattern)).min(1).max(8),
    status: z.enum(["active", "inactive", "archived", "unknown"]),
    details: detailsSchema.optional(),
    meta: metaSchema.optional(),
    relations: relationsSchema.optional(),
    blocks: z.array(projectBlockSchema).optional()
  })
  .strict();

export const collectionItemSchema = z
  .object({
    project: z.string().regex(slugPattern),
    note: nonEmptyString.max(180).optional()
  })
  .strict();

export const collectionConfigSchema = z
  .object({
    schema_version: z.literal(1),
    id: z.string().regex(slugPattern, "id must use lowercase kebab-case"),
    title: nonEmptyString,
    summary: nonEmptyString.max(180),
    status: z.enum(["published", "draft", "archived"]),
    items: z.array(collectionItemSchema).min(1),
    details: detailsSchema.optional(),
    blocks: z.array(projectBlockSchema).optional()
  })
  .strict();

export const taxonomyItemSchema = z
  .object({
    id: z.string().regex(slugPattern),
    name: nonEmptyString,
    description: nonEmptyString.optional()
  })
  .strict();

export const taxonomyCatalogSchema = z
  .object({
    categories: z.array(taxonomyItemSchema).min(1),
    tags: z.array(taxonomyItemSchema).min(1)
  })
  .strict();

export const siteConfigSchema = z
  .object({
    title: nonEmptyString,
    description: nonEmptyString,
    navigation: z
      .array(
        z
          .object({
            label: nonEmptyString,
            href: nonEmptyString
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ProjectBlock = z.infer<typeof projectBlockSchema>;
export type CollectionConfig = z.infer<typeof collectionConfigSchema>;
export type CollectionItemConfig = z.infer<typeof collectionItemSchema>;
export type TaxonomyCatalog = z.infer<typeof taxonomyCatalogSchema>;
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
