#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { z } from "zod";
import {
  collectionConfigSchema,
  projectConfigSchema,
  taxonomyCatalogSchema
} from "../src/lib/catalog/catalog-schema.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = path.join(rootDir, "catalog");
const projectsDir = path.join(catalogDir, "projects");
const collectionsDir = path.join(catalogDir, "collections");
const batchesDir = path.join(rootDir, ".tmp", "import-batches");
const lockDir = path.join(rootDir, ".data", "catalog-write.lock");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const allowedTopLevelEntries = new Set(["manifest.yaml", "projects", "collections"]);
let lockHeld = false;

const nonEmptyString = z.string().trim().min(1);
const slugString = z.string().regex(slugPattern);
const operationSchema = z
  .object({
    target: z.enum(["project", "collection"]),
    id: slugString,
    action: z.enum(["create", "replace", "delete"]),
    path: z.string().regex(relativePathPattern).optional()
  })
  .strict();
const manifestSchema = z
  .object({
    schema_version: z.literal(1),
    kind: z.literal("catalog-import-batch"),
    batch_id: slugString,
    source: z
      .object({
        type: z.enum(["manual", "ai"]),
        model: nonEmptyString.optional(),
        notes: z.array(nonEmptyString).optional()
      })
      .strict(),
    mode: z.literal("scoped"),
    operations: z.array(operationSchema).min(1)
  })
  .strict();

function cleanupLockSync() {
  if (lockHeld) {
    rmSync(lockDir, { recursive: true, force: true });
    lockHeld = false;
  }
}

process.once("exit", cleanupLockSync);
process.once("SIGINT", () => {
  cleanupLockSync();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanupLockSync();
  process.exit(143);
});

function die(message, code = 2) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function usage() {
  console.log(`用法：
  ./scripts/catalog.sh import <command> <batch> [options]

命令：
  validate <batch>                 校验 import batch 合同、payload、引用关系和当前 catalog 状态。
  plan <batch>                     输出将要执行的 create/replace/delete 计划。
  diff <batch>                     展示 batch 与当前 catalog item 目录差异。
  apply <batch> [--allow-replace] [--allow-delete]
                                   加锁、备份、整 item 目录写入、验证，失败回滚。

批次目录：
  .tmp/import-batches/<batch-id>/
    manifest.yaml
    projects/<id>/project.yaml
    collections/<id>/collection.yaml

说明：
  AI 或人工整理结果只能进入 .tmp/import-batches。
  import 只执行 manifest.yaml 显式声明的操作。
  replace 语义是替换整个 project 或 collection 目录，不做文件级覆盖。`);
}

function parseOptions(args, allowedOptions = new Set()) {
  const options = new Set();
  const positionals = [];

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const name = arg.slice(2);
    if (!allowedOptions.has(name)) {
      die(`unknown option: --${name}`);
    }

    options.add(name);
  }

  return { options, positionals };
}

function assertId(id, label = "id") {
  if (!slugPattern.test(id)) {
    die(`${label} must use lowercase kebab-case: ${id}`);
  }
}

function relativeToRoot(itemPath) {
  return path.relative(rootDir, itemPath);
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    die(`${label} must stay inside ${relativeToRoot(parent)}`);
  }
}

function batchPathFor(input) {
  const batchPath = path.resolve(rootDir, input);
  assertInside(batchesDir, batchPath, "batch path");
  return batchPath;
}

async function readYaml(filePath, schema, label) {
  const raw = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      die(`${label} not found: ${relativeToRoot(filePath)}`);
    }
    throw error;
  });

  try {
    return schema.parse(load(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      die(`${label} is invalid: ${error.issues.map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`).join("; ")}`);
    }
    throw error;
  }
}

async function assertNoSymlinks(directory) {
  const stats = await fs.lstat(directory);
  if (stats.isSymbolicLink()) {
    die(`import batch must not contain symlink: ${relativeToRoot(directory)}`);
  }

  if (!stats.isDirectory()) {
    return;
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const entryStats = await fs.lstat(entryPath);
    if (entryStats.isSymbolicLink()) {
      die(`import batch must not contain symlink: ${relativeToRoot(entryPath)}`);
    }
    if (entryStats.isDirectory()) {
      await assertNoSymlinks(entryPath);
    }
  }
}

async function pathExists(itemPath) {
  return fs.access(itemPath).then(() => true, () => false);
}

function targetDir(target, id) {
  return target === "project" ? path.join(projectsDir, id) : path.join(collectionsDir, id);
}

function configFileName(target) {
  return target === "project" ? "project.yaml" : "collection.yaml";
}

function defaultOperationPath(target, id) {
  return target === "project" ? `./projects/${id}` : `./collections/${id}`;
}

function operationKey(operation) {
  return `${operation.target}:${operation.id}`;
}

async function readCurrentProjectIds() {
  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name));
}

async function readCurrentCollectionIds() {
  const entries = await fs.readdir(collectionsDir, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name));
}

async function readTaxonomyIds() {
  const taxonomy = await readYaml(path.join(catalogDir, "taxonomies.yaml"), taxonomyCatalogSchema, "catalog/taxonomies.yaml");
  return {
    categories: new Set(taxonomy.categories.map((category) => category.id)),
    tags: new Set(taxonomy.tags.map((tag) => tag.id)),
    projectMaintenanceStatuses: new Set(
      taxonomy.project_maintenance_statuses.map((maintenanceStatus) => maintenanceStatus.id)
    )
  };
}

async function loadBatch(input) {
  const batchPath = batchPathFor(input);
  const stats = await fs.lstat(batchPath).catch((error) => {
    if (error.code === "ENOENT") {
      die(`batch not found: ${relativeToRoot(batchPath)}`);
    }
    throw error;
  });

  if (!stats.isDirectory()) {
    die(`batch must be a directory: ${relativeToRoot(batchPath)}`);
  }

  await assertNoSymlinks(batchPath);

  const entries = await fs.readdir(batchPath);
  for (const entry of entries) {
    if (!allowedTopLevelEntries.has(entry)) {
      die(`unexpected top-level batch entry: ${entry}`);
    }
  }

  const manifest = await readYaml(path.join(batchPath, "manifest.yaml"), manifestSchema, "manifest.yaml");
  if (manifest.batch_id !== path.basename(batchPath)) {
    die(`manifest batch_id must match batch directory name: ${manifest.batch_id} != ${path.basename(batchPath)}`);
  }

  const seen = new Set();
  for (const operation of manifest.operations) {
    const key = operationKey(operation);
    if (seen.has(key)) {
      die(`duplicate operation for ${key}`);
    }
    seen.add(key);
    assertId(operation.id, `${operation.target} id`);
  }

  return { batchPath, manifest };
}

async function buildPlan(input) {
  const batch = await loadBatch(input);
  const currentProjectIds = await readCurrentProjectIds();
  const currentCollectionIds = await readCurrentCollectionIds();
  const taxonomyIds = await readTaxonomyIds();
  const plan = [];
  const batchProjectIds = new Set();
  const deletedProjectIds = new Set();

  for (const operation of batch.manifest.operations) {
    if (operation.target === "project" && operation.action !== "delete") {
      batchProjectIds.add(operation.id);
    }
    if (operation.target === "project" && operation.action === "delete") {
      deletedProjectIds.add(operation.id);
    }
  }

  await assertNoUndeclaredDirs(batch.batchPath, batch.manifest.operations);
  await assertDeletedProjectsAreUnreferenced(batch.manifest.operations, deletedProjectIds);

  for (const operation of batch.manifest.operations) {
    const configuredPath = operation.path ?? defaultOperationPath(operation.target, operation.id);
    const expectedPath = defaultOperationPath(operation.target, operation.id);
    if (operation.action === "delete") {
      if (operation.path) {
        die(`${operationKey(operation)} delete operation must not declare path`);
      }
    } else if (configuredPath !== expectedPath) {
      die(`${operationKey(operation)} path must be ${expectedPath}`);
    }

    const destination = targetDir(operation.target, operation.id);
    const exists = operation.target === "project" ? currentProjectIds.has(operation.id) : currentCollectionIds.has(operation.id);
    if (operation.action === "create" && exists) {
      die(`${operationKey(operation)} create target already exists`);
    }
    if ((operation.action === "replace" || operation.action === "delete") && !exists) {
      die(`${operationKey(operation)} ${operation.action} target does not exist`);
    }

    let source;
    let payload;
    if (operation.action !== "delete") {
      source = path.resolve(batch.batchPath, configuredPath);
      assertInside(batch.batchPath, source, `${operationKey(operation)} source path`);
      const sourceStats = await fs.lstat(source).catch((error) => {
        if (error.code === "ENOENT") {
          die(`${operationKey(operation)} source path not found: ${configuredPath}`);
        }
        throw error;
      });
      if (!sourceStats.isDirectory()) {
        die(`${operationKey(operation)} source path must be a directory`);
      }
      payload = await validatePayload(operation, source, taxonomyIds, currentProjectIds, batchProjectIds, deletedProjectIds);
    }

    plan.push({ ...operation, source, destination, payload });
  }

  return { ...batch, plan };
}

async function assertDeletedProjectsAreUnreferenced(operations, deletedProjectIds) {
  if (deletedProjectIds.size === 0) {
    return;
  }

  const touchedProjects = new Set(
    operations
      .filter((operation) => operation.target === "project" && operation.action !== "create")
      .map((operation) => operation.id)
  );
  const touchedCollections = new Set(
    operations
      .filter((operation) => operation.target === "collection" && operation.action !== "create")
      .map((operation) => operation.id)
  );

  const projectEntries = await fs.readdir(projectsDir, { withFileTypes: true });
  for (const entry of projectEntries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || touchedProjects.has(entry.name)) {
      continue;
    }

    const project = await readYaml(path.join(projectsDir, entry.name, "project.yaml"), projectConfigSchema, `catalog/projects/${entry.name}/project.yaml`);
    for (const relatedId of project.relations?.related_projects ?? []) {
      if (deletedProjectIds.has(relatedId)) {
        die(`project:${entry.name} references project scheduled for delete: ${relatedId}`);
      }
    }
  }

  const collectionEntries = await fs.readdir(collectionsDir, { withFileTypes: true });
  for (const entry of collectionEntries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || touchedCollections.has(entry.name)) {
      continue;
    }

    const collection = await readYaml(path.join(collectionsDir, entry.name, "collection.yaml"), collectionConfigSchema, `catalog/collections/${entry.name}/collection.yaml`);
    for (const item of collection.items) {
      if (deletedProjectIds.has(item.project)) {
        die(`collection:${entry.name} references project scheduled for delete: ${item.project}`);
      }
    }
  }
}

async function assertNoUndeclaredDirs(batchPath, operations) {
  const declared = new Set(operations.filter((operation) => operation.action !== "delete").map((operation) => operationKey(operation)));

  for (const target of ["project", "collection"]) {
    const root = path.join(batchPath, target === "project" ? "projects" : "collections");
    if (!(await pathExists(root))) {
      continue;
    }

    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const targetPath = target === "project" ? "projects" : "collections";
      if (!entry.isDirectory()) {
        die(`batch ${targetPath}/ must only contain item directories: ${targetPath}/${entry.name}`);
      }
      if (!declared.has(`${target}:${entry.name}`)) {
        die(`batch contains undeclared ${target} directory: ${targetPath}/${entry.name}`);
      }
    }
  }
}

async function validatePayload(operation, source, taxonomyIds, currentProjectIds, batchProjectIds, deletedProjectIds) {
  const configPath = path.join(source, configFileName(operation.target));
  const schema = operation.target === "project" ? projectConfigSchema : collectionConfigSchema;
  const payload = await readYaml(configPath, schema, `${operationKey(operation)} ${configFileName(operation.target)}`);

  if (payload.id !== operation.id) {
    die(`${operationKey(operation)} payload id must match operation id: ${payload.id}`);
  }

  await assertAllowedItemFiles(operation, source, payload);

  if (payload.details) {
    const detailsPath = path.resolve(source, payload.details.path);
    assertInside(source, detailsPath, `${operationKey(operation)} details.path`);
    const detailsStats = await fs.lstat(detailsPath).catch((error) => {
      if (error.code === "ENOENT") {
        die(`${operationKey(operation)} details file not found: ${payload.details.path}`);
      }
      throw error;
    });
    if (detailsStats.isSymbolicLink()) {
      die(`${operationKey(operation)} details file must not be a symlink`);
    }
  }

  if (operation.target === "project") {
    validateProjectPayload(operation, payload, taxonomyIds, currentProjectIds, batchProjectIds, deletedProjectIds);
  } else {
    validateCollectionPayload(operation, payload, currentProjectIds, batchProjectIds, deletedProjectIds);
  }

  return payload;
}

async function assertAllowedItemFiles(operation, source, payload) {
  const configFile = configFileName(operation.target);
  const allowed = new Set([configFile]);
  if (payload.details) {
    allowed.add("details.md");
  }

  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      die(`${operationKey(operation)} schema_version 1 item directory must not contain subdirectory: ${entry.name}`);
    }
    if (!entry.isFile()) {
      die(`${operationKey(operation)} item entry must be a regular file: ${entry.name}`);
    }
    if (!allowed.has(entry.name)) {
      die(`${operationKey(operation)} unexpected item file in schema_version 1: ${entry.name}`);
    }
  }
}

function validateProjectPayload(operation, payload, taxonomyIds, currentProjectIds, batchProjectIds, deletedProjectIds) {
  if (!taxonomyIds.categories.has(payload.category)) {
    die(`${operationKey(operation)} references unknown category: ${payload.category}`);
  }

  for (const tag of payload.tags) {
    if (!taxonomyIds.tags.has(tag)) {
      die(`${operationKey(operation)} references unknown tag: ${tag}`);
    }
  }

  if (!taxonomyIds.projectMaintenanceStatuses.has(payload.maintenance_status)) {
    die(`${operationKey(operation)} references unknown maintenance_status: ${payload.maintenance_status}`);
  }

  const availableProjectIds = new Set([...currentProjectIds, ...batchProjectIds]);
  for (const deletedId of deletedProjectIds) {
    availableProjectIds.delete(deletedId);
  }

  for (const relatedId of payload.relations?.related_projects ?? []) {
    if (!availableProjectIds.has(relatedId)) {
      die(`${operationKey(operation)} references unknown related project: ${relatedId}`);
    }
  }
}

function validateCollectionPayload(operation, payload, currentProjectIds, batchProjectIds, deletedProjectIds) {
  const availableProjectIds = new Set([...currentProjectIds, ...batchProjectIds]);
  for (const deletedId of deletedProjectIds) {
    availableProjectIds.delete(deletedId);
  }
  const seen = new Set();

  for (const item of payload.items) {
    if (seen.has(item.project)) {
      die(`${operationKey(operation)} references duplicate project: ${item.project}`);
    }
    if (!availableProjectIds.has(item.project)) {
      die(`${operationKey(operation)} references unknown project: ${item.project}`);
    }
    seen.add(item.project);
  }
}

function printPlan(plan) {
  for (const operation of plan) {
    console.log(`${operation.action.toUpperCase().padEnd(8)} ${operation.target.padEnd(10)} ${operation.id}`);
  }
}

function validateCatalog() {
  const result = spawnSync("./scripts/verify.sh", ["catalog"], {
    cwd: rootDir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    const error = new Error("catalog validation failed");
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

async function withCatalogWriteLock(operation) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });
  try {
    await fs.mkdir(lockDir);
    await fs.writeFile(path.join(lockDir, "owner"), `pid=${process.pid}\nstarted_at=${new Date().toISOString()}\n`, "utf8");
    lockHeld = true;
  } catch (error) {
    if (error.code === "EEXIST") {
      die("another catalog write is already running");
    }
    throw error;
  }

  try {
    return await operation();
  } finally {
    cleanupLockSync();
  }
}

async function diffBatch(input) {
  const { plan } = await buildPlan(input);
  let hasDiff = false;

  for (const operation of plan) {
    console.log(`\n## ${operation.action.toUpperCase()} ${operation.target} ${operation.id}`);
    if (operation.action === "create") {
      console.log(`CREATE ${relativeToRoot(operation.destination)} from ${relativeToRoot(operation.source)}`);
      hasDiff = true;
      continue;
    }
    if (operation.action === "delete") {
      console.log(`DELETE ${relativeToRoot(operation.destination)}`);
      hasDiff = true;
      continue;
    }

    const result = spawnSync("git", ["diff", "--no-index", "--", operation.destination, operation.source], {
      cwd: rootDir,
      stdio: "inherit"
    });
    if (result.status === 1) {
      hasDiff = true;
      continue;
    }
    if (result.status !== 0) {
      const error = new Error(`git diff failed for ${operationKey(operation)}`);
      error.exitCode = result.status ?? 1;
      throw error;
    }
  }

  if (!hasDiff) {
    console.log("No differences.");
  }
}

async function applyBatch(input, options) {
  if (!options.has("allow-replace")) {
    const needsReplace = (await buildPlan(input)).plan.some((operation) => operation.action === "replace");
    if (needsReplace) {
      die("apply contains replace operations; pass --allow-replace");
    }
  }

  if (!options.has("allow-delete")) {
    const needsDelete = (await buildPlan(input)).plan.some((operation) => operation.action === "delete");
    if (needsDelete) {
      die("apply contains delete operations; pass --allow-delete");
    }
  }

  await withCatalogWriteLock(async () => {
    const { manifest, plan } = await buildPlan(input);
    const backupRoot = path.join(rootDir, ".tmp", "catalog-import-backups", `${manifest.batch_id}.${process.pid}`);
    const applied = [];

    try {
      await fs.mkdir(backupRoot, { recursive: true });

      for (const operation of plan) {
        await applyOperation(operation, backupRoot, applied);
      }

      validateCatalog();
      await fs.rm(backupRoot, { recursive: true, force: true });
      printPlan(plan);
    } catch (error) {
      await rollback(applied);
      throw error;
    }
  });
}

async function applyOperation(operation, backupRoot, applied) {
  const backupTarget = path.join(backupRoot, operation.target === "project" ? "projects" : "collections", operation.id);
  const stagingTarget = operation.action === "delete" ? undefined : stagingPath(operation);
  const appliedOperation = {
    operation,
    backupTarget,
    stagingTarget,
    backedUp: false
  };

  try {
    if (stagingTarget) {
      await fs.cp(operation.source, stagingTarget, { recursive: true, errorOnExist: true, force: false });
    }

    if (operation.action === "create") {
      await fs.rename(stagingTarget, operation.destination);
      applied.push(appliedOperation);
      return;
    }

    await fs.mkdir(path.dirname(backupTarget), { recursive: true });
    await fs.rename(operation.destination, backupTarget);
    appliedOperation.backedUp = true;
    applied.push(appliedOperation);

    if (operation.action === "replace") {
      await fs.rename(stagingTarget, operation.destination);
    }
  } catch (error) {
    if (stagingTarget) {
      await fs.rm(stagingTarget, { recursive: true, force: true });
    }
    throw error;
  }
}

function stagingPath(operation) {
  return path.join(path.dirname(operation.destination), `.${operation.id}.import-${process.pid}-${Date.now()}`);
}

async function rollback(applied) {
  for (const { operation, backupTarget, stagingTarget, backedUp } of applied.reverse()) {
    await fs.rm(operation.destination, { recursive: true, force: true });
    if (stagingTarget) {
      await fs.rm(stagingTarget, { recursive: true, force: true });
    }
    if (backedUp && (await pathExists(backupTarget))) {
      await fs.mkdir(path.dirname(operation.destination), { recursive: true });
      await fs.rename(backupTarget, operation.destination);
    }
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "-h" || command === "--help" || command === "help") {
    usage();
    process.exit(command ? 0 : 2);
  }

  const { options, positionals } = parseOptions(rest, new Set(["allow-replace", "allow-delete"]));
  const [batchInput] = positionals;
  if (!batchInput || positionals.length !== 1) {
    die(`import ${command} requires exactly one <batch> argument`);
  }

  switch (command) {
  case "validate": {
    const { plan } = await buildPlan(batchInput);
    console.log(`VALID ${plan.length} operation(s)`);
    break;
  }
  case "plan": {
    const { plan } = await buildPlan(batchInput);
    printPlan(plan);
    break;
  }
  case "diff":
    await diffBatch(batchInput);
    break;
  case "apply":
    await applyBatch(batchInput, options);
    break;
  default:
    usage();
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `ERROR: ${error.message}` : error);
  process.exit(error.exitCode ?? 1);
});
