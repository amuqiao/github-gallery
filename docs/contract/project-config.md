# Project Config Contract

This document describes the public project configuration contract. The executable schema lives in `src/lib/catalog/project-schema.ts`; this page explains the same rules for maintainers.

## Purpose

Each GitHub Gallery project has one `project.yaml` file. The file must contain stable machine-readable facts used by pages, filters, links, and validation.

Human-readable explanation belongs in `details.md`.

## File Layout

```text
catalog/projects/<id>/
  project.yaml
  details.md
```

The project directory name must match `project.yaml` `id`.

Media files referenced by `media.*` must stay inside the project directory. `schema_version: 1` does not require a fixed asset subdirectory.

## Required Fields

| Field | Rule |
| --- | --- |
| `schema_version` | Must be `1`. |
| `id` | Required, unique, lowercase kebab-case, and identical to the project directory name. |
| `name` | Required display name. |
| `repo` | Required URL. |
| `summary` | Required card summary, maximum 160 characters. |
| `category` | Required category id from `catalog/taxonomies.yaml`. |
| `tags` | Required array, 1 to 8 tag ids from `catalog/taxonomies.yaml`. |
| `status` | Required enum: `active`, `inactive`, `archived`, or `unknown`. |

## Optional Standard Fields

| Field | Rule |
| --- | --- |
| `details.type` | `markdown` in `schema_version: 1`. |
| `details.path` | Must be `./details.md` in `schema_version: 1`. |
| `media.cover` | Project-local image path. |
| `media.screenshots` | Array of `{ path, alt }` entries. |
| `links.homepage` | URL. |
| `links.demo` | URL. |
| `links.docs` | URL. |
| `meta.license` | Text label. |
| `meta.languages` | Non-empty array when present. |
| `meta.last_checked` | ISO date string. |
| `quality.strengths` | Non-empty array when present. |
| `quality.weaknesses` | Non-empty array when present. |
| `quality.use_cases` | Non-empty array when present. |
| `relations.related_projects` | Project id references; all ids must exist. |
| `extensions` | Object reserved for experimental domain-specific fields. |

## Reserved Detail Formats

MDX and HTML details are reserved for future contract versions. They are not accepted by `schema_version: 1` because they need separate integration and sanitization rules.

## Change Rules

- Add new top-level fields only by updating `src/lib/catalog/project-schema.ts` and this document together.
- Do not introduce synonyms such as `image`, `thumbnail`, and `cover` for the same concept.
- Keep categories broad and stable; use tags for narrower domain-specific meaning.
- Use `extensions` for experimental fields that are not part of the stable display contract.
