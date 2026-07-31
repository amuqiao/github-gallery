import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const relativePathSchema = z
  .string()
  .regex(relativePathPattern, "Path must be a relative catalog item-local path such as ./details.md");

const nonEmptyString = z.string().trim().min(1);
const isoDateString = z
  .string()
  .regex(isoDatePattern, "Date must use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map((segment) => Number.parseInt(segment, 10));
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Date must be a valid calendar date");
export const localeCodeSchema = z.enum(["zh", "en"]);

export const localizedTextSchema = z
  .object({
    zh: nonEmptyString,
    en: nonEmptyString
  })
  .strict();

export const hallAvailabilities = ["active", "planned"];

export const hallConfigSchema = z
  .object({
    schema_version: z.literal(1),
    id: z.string().regex(slugPattern, "id must use lowercase kebab-case"),
    title: nonEmptyString,
    summary: nonEmptyString.max(220),
    availability: z.enum(hallAvailabilities),
    order: z.number().int().nonnegative()
  })
  .strict();

export const projectNoteSchema = z
  .object({
    id: z.string().regex(slugPattern, "note id must use lowercase kebab-case"),
    title: nonEmptyString,
    type: z.enum(["markdown", "html"]),
    path: relativePathSchema,
    summary: nonEmptyString.max(180),
    added_at: isoDateString,
    display: z.enum(["site", "standalone"]),
    html_mode: z.enum(["fragment", "document"]).optional()
  })
  .strict()
  .superRefine((note, ctx) => {
    if (!note.path.startsWith("./notes/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "note.path must be under ./notes/",
        path: ["path"]
      });
    }

    if (note.type === "markdown" && !note.path.endsWith(".md")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "markdown notes must use a .md path",
        path: ["path"]
      });
    }

    if (note.type === "html" && !note.path.endsWith(".html")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "html notes must use a .html path",
        path: ["path"]
      });
    }

    if (note.type === "markdown" && note.display !== "site") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "markdown notes must use display: site",
        path: ["display"]
      });
    }

    if (note.type === "markdown" && note.html_mode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "markdown notes must not set html_mode",
        path: ["html_mode"]
      });
    }

    if (note.type === "html" && note.display === "site" && note.html_mode !== "fragment") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "site html notes must use html_mode: fragment",
        path: ["html_mode"]
      });
    }

    if (note.type === "html" && note.display === "standalone" && note.html_mode !== "document") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "standalone html notes must use html_mode: document",
        path: ["html_mode"]
      });
    }
  });

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

/** @type {["drafts", "published", "archived"]} */
export const contentPublicationStates = ["drafts", "published", "archived"];

export const contentBodySchema = z
  .object({
    type: z.enum(["markdown", "html"]),
    path: relativePathSchema,
    html_mode: z.literal("fragment").optional()
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.type === "markdown" && body.path !== "./index.md") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "markdown body must use path: ./index.md",
        path: ["path"]
      });
    }

    if (body.type === "markdown" && body.html_mode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "markdown body must not set html_mode",
        path: ["html_mode"]
      });
    }

    if (body.type === "html" && body.path !== "./index.html") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "html body must use path: ./index.html",
        path: ["path"]
      });
    }

    if (body.type === "html" && body.html_mode !== "fragment") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "html body must use html_mode: fragment",
        path: ["html_mode"]
      });
    }
  });

export const contentSourceSchema = z
  .object({
    type: nonEmptyString,
    url: z.string().url()
  })
  .strict();

export const githubProjectProfileSchema = z
  .object({
    repo: z.string().url(),
    category: z.string().regex(slugPattern),
    tags: z.array(z.string().regex(slugPattern)).min(1).max(8),
    maintenance_status: z.string().regex(slugPattern),
    license: nonEmptyString.optional(),
    languages: z.array(nonEmptyString).min(1).optional()
  })
  .strict();

export const aiModelProfileSchema = z
  .object({
    provider: nonEmptyString,
    modalities: z
      .object({
        input: z.array(nonEmptyString).min(1).max(8),
        output: z.array(nonEmptyString).min(1).max(8)
      })
      .strict(),
    tasks: z.array(nonEmptyString).min(1).max(12),
    access: z.array(nonEmptyString).min(1).max(8),
    formats: z.array(nonEmptyString).min(1).max(8),
    runtimes: z.array(nonEmptyString).min(1).max(8),
    license: nonEmptyString.optional()
  })
  .strict();

export const knowledgeArticleProfileSchema = z
  .object({
    domain: nonEmptyString,
    topics: z.array(nonEmptyString).min(1).max(8),
    audience: z.array(nonEmptyString).min(1).max(6).optional()
  })
  .strict();

const contentItemBaseSchema = z
  .object({
    schema_version: z.literal(2),
    id: z.string().regex(slugPattern, "id must use lowercase kebab-case"),
    hall: z.string().regex(slugPattern),
    title: nonEmptyString,
    summary: nonEmptyString.max(180),
    added_at: isoDateString,
    source: contentSourceSchema,
    body: contentBodySchema,
    notes: z.array(projectNoteSchema).optional(),
    blocks: z.array(projectBlockSchema).optional()
  })
  .strict();

export const contentItemConfigSchema = z.discriminatedUnion("kind", [
  contentItemBaseSchema.extend({
    kind: z.literal("github_project"),
    profile: githubProjectProfileSchema,
    relations: relationsSchema.optional()
  }),
  contentItemBaseSchema.extend({
    kind: z.literal("ai_model"),
    profile: aiModelProfileSchema
  }),
  contentItemBaseSchema.extend({
    kind: z.literal("knowledge_article"),
    profile: knowledgeArticleProfileSchema
  })
]);

export const contentCollectionItemSchema = z
  .object({
    item: z.string().regex(slugPattern),
    note: nonEmptyString.max(180).optional()
  })
  .strict();

export const contentCollectionConfigSchema = z
  .object({
    schema_version: z.literal(2),
    id: z.string().regex(slugPattern, "id must use lowercase kebab-case"),
    hall: z.string().regex(slugPattern),
    title: nonEmptyString,
    summary: nonEmptyString.max(180),
    body: contentBodySchema,
    items: z.array(contentCollectionItemSchema).min(1),
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

export const siteNavigationHrefSchema = z
  .string()
  .trim()
  .regex(
    /^\/$|^\/(?:search|recent)\/$|^\/halls\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:collections\/)?$/,
    "navigation.href must be /, /search/, /recent/, /halls/<hall>/, or /halls/<hall>/collections/"
  );

export const siteConfigSchema = z
  .object({
    title: nonEmptyString,
    description: nonEmptyString,
    navigation: z
      .array(
        z
          .object({
            label: nonEmptyString,
            href: siteNavigationHrefSchema
          })
          .strict()
      )
      .min(1)
  })
  .strict();
