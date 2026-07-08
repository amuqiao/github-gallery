# Site Config Contract

This document describes the site-level configuration contract. The executable schema lives in `src/lib/catalog/project-schema.ts`.

## Purpose

`catalog/site.yaml` owns site-level display facts that must not be hard-coded in layouts or pages.

## File Layout

```text
catalog/site.yaml
```

## Required Fields

| Field | Rule |
| --- | --- |
| `title` | Required site display title. |
| `description` | Required default meta description. |
| `navigation` | Required non-empty array of `{ label, href }`. |

## Route Rules

- Project routes use `/projects/<project-id>/`.
- Category routes use `/categories/<category-id>/`.
- Tag routes use `/tags/<tag-id>/`.
- Project ids, category ids, and tag ids are URL-facing identifiers. Rename them only as a deliberate breaking route change.
- Empty category and tag pages are allowed in the first version because taxonomy ids are stable entry points, even before projects are assigned to them.

## Change Rules

- Do not hard-code a domain-specific category such as `ai` in shared layout navigation.
- Add new navigation entries through `catalog/site.yaml`.
- Keep navigation links stable and simple; prefer root pages, anchors, category pages, or tag pages.
