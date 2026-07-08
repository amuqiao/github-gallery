import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

const relativePathSchema = z
  .string()
  .regex(relativePathPattern, "Path must be a relative catalog item-local path such as ./details.md");

const nonEmptyString = z.string().trim().min(1);
/** @type {["published", "draft", "archived"]} */
export const collectionPublicationStatuses = ["published", "draft", "archived"];
export const localeCodeSchema = z.enum(["zh", "en"]);

export const localizedTextSchema = z
  .object({
    zh: nonEmptyString,
    en: nonEmptyString
  })
  .strict();

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
    maintenance_status: z.string().regex(slugPattern),
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
    publication_status: z.enum(collectionPublicationStatuses),
    items: z.array(collectionItemSchema).min(1),
    details: detailsSchema.optional(),
    blocks: z.array(projectBlockSchema).optional()
  })
  .strict();

export const taxonomyItemSchema = z
  .object({
    id: z.string().regex(slugPattern),
    name: localizedTextSchema,
    description: localizedTextSchema
  })
  .strict();

export const taxonomyCatalogSchema = z
  .object({
    schema_version: z.literal(1),
    locale: z
      .object({
        default: localeCodeSchema,
        supported: z.array(localeCodeSchema).min(1)
      })
      .strict(),
    categories: z.array(taxonomyItemSchema).min(1),
    tags: z.array(taxonomyItemSchema).min(1),
    project_maintenance_statuses: z.array(taxonomyItemSchema).min(1)
  })
  .strict()
  .superRefine((taxonomy, ctx) => {
    const supported = new Set(taxonomy.locale.supported);

    if (supported.size !== taxonomy.locale.supported.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "locale.supported must not contain duplicate locales",
        path: ["locale", "supported"]
      });
    }

    if (!supported.has(taxonomy.locale.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "locale.default must be included in locale.supported",
        path: ["locale", "default"]
      });
    }

    for (const requiredLocale of ["zh", "en"]) {
      if (!supported.has(requiredLocale)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `locale.supported must include ${requiredLocale}`,
          path: ["locale", "supported"]
        });
      }
    }
  });

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
