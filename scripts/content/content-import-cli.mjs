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
  contentCollectionConfigSchema,
  contentItemConfigSchema
} from "../../src/lib/catalog/catalog-schema.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentRoot = path.join(rootDir, "catalog", "content");
const batchesDir = path.join(rootDir, ".tmp", "import-batches");
const lockDir = path.join(rootDir, ".data", "catalog-write.lock");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePathPattern = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const allowedTopLevelEntries = new Set(["manifest.yaml", "items", "collections"]);
const contentKindDirectories = {
  item: "items",
  collection: "collections"
};
const configFileNames = {
  item: "item.yaml",
  collection: "collection.yaml"
};
let lockHeld = false;
let interruptCode;

const nonEmptyString = z.string().trim().min(1);
const slugString = z.string().regex(slugPattern);
const operationSchema = z
  .object({
    target: z.enum(["item", "collection"]),
    hall: slugString,
    id: slugString,
    state: z.literal("drafts"),
    action: z.enum(["create", "replace", "delete"]),
    path: z.string().regex(relativePathPattern).optional()
  })
  .strict();
const manifestSchema = z
  .object({
    schema_version: z.literal(1),
    kind: z.literal("content-import-batch"),
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
process.on("SIGINT", () => {
  interruptCode ??= 130;
});
process.on("SIGTERM", () => {
  interruptCode ??= 143;
});

function throwIfInterrupted() {
  if (!interruptCode) {
    return;
  }

  const error = new Error("content import interrupted");
  error.exitCode = interruptCode;
  throw error;
}

function die(message, code = 2) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function usage() {
  console.log(`用法：
  ./scripts/content.sh import <command> <batch> [options]

命令：
  validate <batch>                 校验 content import batch 合同、payload 和当前 drafts 目标状态。
  plan <batch>                     输出将要执行的 create/replace/delete 计划。
  diff <batch>                     展示 batch 与当前 drafts content bundle 目录差异。
  apply <batch> [--allow-replace] [--allow-delete]
                                   加锁、备份、写入 drafts、验证，失败回滚。

批次目录：
  .tmp/import-batches/<batch-id>/
    manifest.yaml
    items/<hall>/<id>/item.yaml
    collections/<hall>/<id>/collection.yaml

说明：
  content import 只写入 catalog/content/drafts/。
  发布必须继续使用 ./scripts/content.sh publish <hall> <item|collection> <id>。`);
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

async function pathExists(itemPath) {
  try {
    await fs.access(itemPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function operationKey(operation) {
  return `${operation.target}:${operation.hall}/${operation.id}`;
}

function bundleDirectory(state, target, hall, id) {
  return path.join(contentRoot, state, hall, contentKindDirectories[target], id);
}

function defaultOperationPath(target, hall, id) {
  return target === "item" ? `./items/${hall}/${id}` : `./collections/${hall}/${id}`;
}

function configFileName(target) {
  return configFileNames[target];
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
  }

  return { batchPath, manifest };
}

async function buildPlan(input) {
  const batch = await loadBatch(input);
  const plan = [];

  await assertNoUndeclaredDirs(batch.batchPath, batch.manifest.operations);

  for (const operation of batch.manifest.operations) {
    const configuredPath = operation.path ?? defaultOperationPath(operation.target, operation.hall, operation.id);
    const expectedPath = defaultOperationPath(operation.target, operation.hall, operation.id);
    if (operation.action === "delete") {
      if (operation.path) {
        die(`${operationKey(operation)} delete operation must not declare path`);
      }
    } else if (configuredPath !== expectedPath) {
      die(`${operationKey(operation)} path must be ${expectedPath}`);
    }

    const destination = bundleDirectory(operation.state, operation.target, operation.hall, operation.id);
    const targetExists = await pathExists(destination);
    if (operation.action === "create") {
      await assertNoBundleExistsInAnyState(operation);
    }
    if (operation.action === "replace" && !targetExists) {
      die(`${operationKey(operation)} replace target does not exist in drafts`);
    }
    if (operation.action === "delete" && !targetExists) {
      die(`${operationKey(operation)} delete target does not exist in drafts`);
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
      payload = await validatePayload(operation, source);
    }

    plan.push({ ...operation, source, destination, payload });
  }

  return { ...batch, plan };
}

async function assertNoBundleExistsInAnyState(operation) {
  for (const state of ["drafts", "published", "archived"]) {
    const directory = bundleDirectory(state, operation.target, operation.hall, operation.id);
    if (await pathExists(directory)) {
      die(`${operationKey(operation)} create target already exists in ${state}`);
    }
  }
}

async function assertNoUndeclaredDirs(batchPath, operations) {
  const declared = new Set(
    operations
      .filter((operation) => operation.action !== "delete")
      .map((operation) => `${operation.target}:${operation.hall}/${operation.id}`)
  );

  for (const target of ["item", "collection"]) {
    const root = path.join(batchPath, contentKindDirectories[target]);
    if (!(await pathExists(root))) {
      continue;
    }

    const hallEntries = await fs.readdir(root, { withFileTypes: true });
    for (const hallEntry of hallEntries) {
      if (!hallEntry.isDirectory()) {
        die(`batch ${contentKindDirectories[target]}/ must only contain hall directories: ${contentKindDirectories[target]}/${hallEntry.name}`);
      }

      const hallRoot = path.join(root, hallEntry.name);
      const itemEntries = await fs.readdir(hallRoot, { withFileTypes: true });
      for (const itemEntry of itemEntries) {
        if (!itemEntry.isDirectory()) {
          die(`batch ${contentKindDirectories[target]}/${hallEntry.name}/ must only contain bundle directories: ${itemEntry.name}`);
        }
        if (!declared.has(`${target}:${hallEntry.name}/${itemEntry.name}`)) {
          die(`batch contains undeclared ${target} directory: ${contentKindDirectories[target]}/${hallEntry.name}/${itemEntry.name}`);
        }
      }
    }
  }
}

async function validatePayload(operation, source) {
  const configPath = path.join(source, configFileName(operation.target));
  const schema = operation.target === "item" ? contentItemConfigSchema : contentCollectionConfigSchema;
  const payload = await readYaml(configPath, schema, `${operationKey(operation)} ${configFileName(operation.target)}`);

  if (payload.id !== operation.id) {
    die(`${operationKey(operation)} payload id must match operation id: ${payload.id}`);
  }

  if (payload.hall !== operation.hall) {
    die(`${operationKey(operation)} payload hall must match operation hall: ${payload.hall}`);
  }

  await assertReferencedFilesExist(operation, source, payload);
  return payload;
}

async function assertReferencedFilesExist(operation, source, payload) {
  const references = [
    { kind: "body", path: payload.body.path },
    ...(operation.target === "item" ? (payload.notes ?? []).map((note) => ({ kind: `note ${note.id}`, path: note.path })) : [])
  ];
  const realSource = await fs.realpath(source);

  for (const reference of references) {
    const referencePath = path.resolve(source, reference.path);
    assertInside(source, referencePath, `${operationKey(operation)} ${reference.kind} path`);
    const stats = await fs.lstat(referencePath).catch((error) => {
      if (error.code === "ENOENT") {
        die(`${operationKey(operation)} ${reference.kind} file not found: ${reference.path}`);
      }
      throw error;
    });
    if (stats.isSymbolicLink()) {
      die(`${operationKey(operation)} ${reference.kind} file must not be a symlink: ${reference.path}`);
    }
    if (!stats.isFile()) {
      die(`${operationKey(operation)} ${reference.kind} path must be a regular file: ${reference.path}`);
    }

    const realReferencePath = await fs.realpath(referencePath);
    assertInside(realSource, realReferencePath, `${operationKey(operation)} ${reference.kind} real path`);
  }
}

function printPlan(plan) {
  for (const operation of plan) {
    console.log(`${operation.action.toUpperCase().padEnd(8)} ${operation.target.padEnd(10)} ${operation.hall.padEnd(12)} ${operation.id}`);
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
    lockHeld = true;
    await fs.writeFile(path.join(lockDir, "owner"), `pid=${process.pid}\nstarted_at=${new Date().toISOString()}\n`, "utf8");
  } catch (error) {
    if (error.code === "EEXIST") {
      die("another catalog write is already running");
    }

    cleanupLockSync();
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
    console.log(`\n## ${operation.action.toUpperCase()} ${operation.target} ${operation.hall}/${operation.id}`);
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
    const backupRoot = path.join(rootDir, ".tmp", "content-import-backups", `${manifest.batch_id}.${process.pid}`);
    const applied = [];

    try {
      await fs.mkdir(backupRoot, { recursive: true });

      for (const operation of plan) {
        throwIfInterrupted();
        await applyOperation(operation, backupRoot, applied);
        throwIfInterrupted();
      }

      throwIfInterrupted();
      validateCatalog();
      throwIfInterrupted();
      await fs.rm(backupRoot, { recursive: true, force: true });
      printPlan(plan);
    } catch (error) {
      await rollback(applied);
      await fs.rm(backupRoot, { recursive: true, force: true });
      throw error;
    }
  });
}

async function applyOperation(operation, backupRoot, applied) {
  const backupTarget = path.join(backupRoot, operation.target, operation.hall, operation.id);
  const stagingTarget = operation.action === "delete" ? undefined : stagingPath(operation);
  const appliedOperation = {
    operation,
    backupTarget,
    stagingTarget,
    createdDestination: false,
    backedUp: false
  };

  try {
    if (stagingTarget) {
      await fs.mkdir(path.dirname(stagingTarget), { recursive: true });
      await fs.cp(operation.source, stagingTarget, { recursive: true, errorOnExist: true, force: false });
      throwIfInterrupted();
    }

    if (operation.action === "create") {
      applied.push(appliedOperation);
      await fs.mkdir(path.dirname(operation.destination), { recursive: true });
      throwIfInterrupted();
      appliedOperation.createdDestination = true;
      await fs.rename(stagingTarget, operation.destination);
      return;
    }

    applied.push(appliedOperation);
    await fs.mkdir(path.dirname(backupTarget), { recursive: true });
    throwIfInterrupted();
    await fs.rename(operation.destination, backupTarget);
    appliedOperation.backedUp = true;

    if (operation.action === "replace") {
      await fs.mkdir(path.dirname(operation.destination), { recursive: true });
      throwIfInterrupted();
      appliedOperation.createdDestination = true;
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
  for (const { operation, backupTarget, stagingTarget, backedUp, createdDestination } of applied.reverse()) {
    if (createdDestination) {
      await fs.rm(operation.destination, { recursive: true, force: true });
    }
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
