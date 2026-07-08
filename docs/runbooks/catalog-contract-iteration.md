# Catalog Contract Iteration Runbook

本手册说明如何稳定迭代 GitHub Gallery 的配置合同。核心原则是：schema 定义字段级合同，loader 执行跨文件不变量，文档只解释已实现规则。

## Mental Model

```text
schema 定规则
  -> loader 执行规则
  -> build 验证规则
  -> docs 解释规则
```

这四层不能倒置。不要先在文档里发明字段，再让配置和页面跟着猜；也不要让页面绕过 loader 直接读取 YAML。字段形状归 schema，目录名、taxonomy、引用文件、related projects 这类跨文件不变量归 loader。

## Authority

| Layer | Canonical location | Owns |
| --- | --- | --- |
| Schema | `src/lib/catalog/project-schema.ts` | Executable config contract. |
| Loader | `src/lib/catalog/projects.ts` | YAML reading, schema parsing, cross-file validation, and catalog read model. |
| Detail loader | `src/lib/catalog/details.ts` | Detail document loading for implemented detail formats. |
| Build gate | `npm run build` | `astro check` and static build validation. |
| Contract docs | `docs/contract/` | Human explanation of the executable schema. Start with [`project-config.md`](../contract/project-config.md). |
| Current docs | `docs/current/` | Implemented structure and runtime path. Start with [`structure.md`](../current/structure.md). |
| Plans | `docs/plans/` | Accepted future gaps and acceptance criteria. Start with [`roadmap.md`](../plans/roadmap.md). |
| Runbooks | `docs/runbooks/` | Repeatable maintenance procedure. |

## When Adding Or Changing A Project Field

Use this order:

1. Update `src/lib/catalog/project-schema.ts`.
2. Update `src/lib/catalog/projects.ts` only if the field needs validation across files, normalization, indexes, or helper access.
3. Update sample `catalog/projects/<id>/project.yaml` only after the schema accepts the field.
4. Update `docs/contract/project-config.md` to explain the field.
5. Update `docs/current/structure.md` only if runtime behavior or module boundaries changed.
6. Update `docs/plans/roadmap.md` if a future gap is opened or closed.
7. Run `npm run build`.

Do not treat `docs/contract/project-config.md` as the source of truth. If the docs disagree with schema or loader behavior, the executable code is authoritative and the docs must be fixed.

## When Adding A Project

Use this order:

1. Create `catalog/projects/<id>/`.
2. Add `catalog/projects/<id>/project.yaml`.
3. Add `catalog/projects/<id>/details.md` when `details` is declared.
4. Use only category and tag ids from `catalog/taxonomies.yaml`.
5. Use `relations.related_projects` only for ids that already exist.
6. Run `npm run build`.

The project directory name must match `project.yaml` `id`.

## When Adding A Category Or Tag

Use this order:

1. Add the category or tag to `catalog/taxonomies.yaml`.
2. Reference it from project configs only after it exists in the taxonomy file.
3. Keep categories broad and stable.
4. Use tags for narrower or domain-specific meaning.
5. Run `npm run build`.

Category ids and tag ids are URL-facing identifiers. Renaming them is a route change.

## When Changing Site Navigation

Use this order:

1. Update `catalog/site.yaml`.
2. Keep shared layout code domain-neutral.
3. Avoid hard-coding category ids such as `ai` in `src/layouts/`.
4. Run `npm run build`.

## When Adding A New Detail Format

`schema_version: 1` supports Markdown details only. The exact accepted shape is defined in `src/lib/catalog/project-schema.ts` and explained in [`docs/contract/project-config.md`](../contract/project-config.md).

```yaml
details:
  type: markdown
  path: ./details.md
```

To add MDX or HTML later:

1. Add the required runtime integration or sanitization first.
2. Add executable validation in `src/lib/catalog/project-schema.ts`.
3. Update `src/lib/catalog/details.ts`.
4. Add at least one sample project that exercises the new path.
5. Update `docs/contract/project-config.md`.
6. Move the item out of `docs/plans/roadmap.md`.
7. Run `npm run build`.

Do not document MDX or HTML as supported in `docs/contract/` before the code validates and builds that path.

## Drift Checklist

Before finishing a contract-related change, check:

```text
[ ] New or changed fields are defined in `project-schema.ts`.
[ ] Pages still use `src/lib/catalog/projects.ts`; no page parses YAML directly.
[ ] Cross-file checks belong in the loader, not in page components.
[ ] `docs/contract/` explains implemented schema only.
[ ] `docs/current/` describes shipped behavior only.
[ ] `docs/plans/` contains future work only.
[ ] `docs/note.md` remains historical and is not used as authority.
[ ] `npm run build` passes.
```

## Anti-Patterns

- Adding a key to `project.yaml` because it is mentioned in documentation but not accepted by schema.
- Adding fallback defaults in loader code to hide invalid config.
- Letting a page read YAML directly for a one-off display.
- Duplicating category or tag meaning in project-specific fields.
- Describing future MDX, HTML, generated metadata, or search behavior as current behavior.
