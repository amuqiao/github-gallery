# Roadmap

## Current Baseline

- Astro static site skeleton exists.
- Project configs are loaded through a shared catalog layer.
- Project configs are validated at build time.
- Eight sample projects exist to exercise the contract.

## Remaining Gaps

- Search and client-side filtering are not implemented.
- GitHub repository metadata such as stars, license refresh, and last activity is not automated.
- Project screenshots and cover images are supported by contract but not populated in the sample data.
- MDX and HTML detail formats are reserved but not implemented in `schema_version: 1`.

## Planned Work

- Add local search over project name, summary, category, and tags.
- Add a narrow validation command if build-time validation becomes too slow for content-only edits.
- Add optional generated metadata under a separate generated data surface.
- Add project covers after the asset policy is finalized.
- Add MDX only after the Astro MDX integration is installed and verified.
- Add HTML details only after sanitization rules are implemented and tested.

## Acceptance

- Search works without changing the `project.yaml` contract.
- Generated metadata does not overwrite hand-maintained project facts.
- Missing assets, unknown tags, and broken related project ids fail validation before deployment.
- MDX or HTML detail support is moved from roadmap into the contract only after build-time validation covers it.
