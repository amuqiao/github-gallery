# GitHub Gallery

A contract-driven static gallery for curated GitHub projects.

## Structure

```text
catalog/projects/<id>/project.yaml  # machine-readable project facts
catalog/projects/<id>/details.md    # optional human-readable detail page
catalog/taxonomies.yaml             # shared categories and tags
catalog/site.yaml                   # site title, description, and navigation
src/lib/catalog/                    # shared loader and schema
docs/contract/                      # maintainer-facing contracts
docs/current/                       # implemented structure
docs/plans/                         # future work
docs/runbooks/                      # repeatable maintenance procedures
```

## Maintainer Docs

Read these in order when changing the catalog model:

1. [Current structure](docs/current/structure.md)
2. [Project config contract](docs/contract/project-config.md)
3. [Site config contract](docs/contract/site-config.md)
4. [Catalog contract iteration runbook](docs/runbooks/catalog-contract-iteration.md)
5. [Roadmap](docs/plans/roadmap.md)

## Commands

```sh
npm install
npm run dev
npm run build
```
