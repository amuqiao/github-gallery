import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

const relativePathSchema = z
  .string()
  .regex(relativePathPattern, "Path must be a relative project-local path such as ./details.md");

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

export const mediaSchema = z
  .object({
    cover: relativePathSchema.optional(),
    screenshots: z
      .array(
        z
          .object({
            path: relativePathSchema,
            alt: nonEmptyString
          })
          .strict()
      )
      .optional()
  })
  .strict();

export const linksSchema = z
  .object({
    homepage: z.string().url().optional(),
    demo: z.string().url().optional(),
    docs: z.string().url().optional()
  })
  .strict();

export const metaSchema = z
  .object({
    license: nonEmptyString.optional(),
    languages: z.array(nonEmptyString).min(1).optional(),
    last_checked: z.string().date().optional()
  })
  .strict();

export const qualitySchema = z
  .object({
    strengths: z.array(nonEmptyString).min(1).optional(),
    weaknesses: z.array(nonEmptyString).min(1).optional(),
    use_cases: z.array(nonEmptyString).min(1).optional()
  })
  .strict();

export const relationsSchema = z
  .object({
    related_projects: z.array(z.string().regex(slugPattern)).min(1).optional()
  })
  .strict();

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
    media: mediaSchema.optional(),
    links: linksSchema.optional(),
    meta: metaSchema.optional(),
    quality: qualitySchema.optional(),
    relations: relationsSchema.optional(),
    extensions: z.record(z.unknown()).optional()
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
export type TaxonomyCatalog = z.infer<typeof taxonomyCatalogSchema>;
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
