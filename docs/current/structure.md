# GitHub Gallery Structure

This document describes the current implemented repository structure only.

## Current Behavior

- The site is an Astro static site.
- Project data lives under `catalog/projects/<id>/project.yaml`.
- Optional project details live beside the project config as `details.md`.
- Shared categories and tags live in `catalog/taxonomies.yaml`.
- Site-level title, description, and navigation live in `catalog/site.yaml`.
- Pages do not parse project YAML directly. They call `src/lib/catalog/projects.ts`.
- `src/lib/catalog/projects.ts` builds a shared catalog snapshot with project and taxonomy indexes, plus cross-project relation validation and lookup helpers.
- Project detail content is loaded through `src/lib/catalog/details.ts`.

## Runtime Path

```text
catalog/projects/<id>/project.yaml
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/projects.ts
  -> src/pages/index.astro
  -> src/pages/projects/[id].astro
  -> src/pages/categories/[category].astro
  -> src/pages/tags/[tag].astro
  -> static HTML output

catalog/projects/<id>/details.md
  -> src/lib/catalog/details.ts
  -> src/pages/projects/[id].astro
  -> static HTML output
```

## State Authority

`project.yaml` is the machine-readable source for project cards, filters, routes, and cross-project references. `catalog/site.yaml` is the source for site-level navigation. Detail documents are human-readable supporting content and do not define filterable fields.

## Verification

- `npm run build` runs `astro check` and `astro build`.
- Build-time loading fails when project configs violate the schema, reference unknown taxonomy ids, reference missing files, or point outside the project directory.
- `schema_version: 1` supports Markdown details only.
