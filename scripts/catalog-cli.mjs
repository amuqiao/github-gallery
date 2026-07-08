#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dump, load } from "js-yaml";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectionsDir = path.join(rootDir, "catalog", "collections");
const lockDir = path.join(rootDir, ".data", "catalog-write.lock");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validCollectionStatuses = new Set(["published", "draft", "archived"]);
const writeCommands = new Set([
  "new",
  "delete",
  "add-project",
  "remove-project",
  "set-title",
  "set-summary",
  "set-status",
  "set-note"
]);
let lockHeld = false;

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

function event(action, id, detail = "") {
  console.log(`${action.padEnd(9)} ${id.padEnd(12)} ${detail}`);
}

function assertId(id, label = "id") {
  if (!slugPattern.test(id)) {
    die(`${label} must use lowercase kebab-case: ${id}`);
  }
}

function usage() {
  console.log(`用法：
  ./scripts/catalog.sh collection <command> [args...]

命令：
  list
  show <id>
  new <id> --title <title> --summary <summary> --project <id> [--project <id> ...] [--status <status>] [--details]
  delete <id> --force
  add-project <collection-id> <project-id> [--note <note>] [--position <n>]
  remove-project <collection-id> <project-id>
  set-title <id> <title>
  set-summary <id> <summary>
  set-status <id> <published|draft|archived>
  set-note <id> <project-id> --note <note>

说明：
  所有写操作都会调用 ./scripts/verify.sh catalog。
  脚本只维护 collection.yaml 和可选 details.md；字段合同仍由 schema/loader 执行。`);
}

function parseOptions(args, allowedOptions = new Set()) {
  const options = new Map();
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const name = arg.slice(2);
    if (!allowedOptions.has(name)) {
      die(`unknown option: --${name}`);
    }

    if (name === "details" || name === "force") {
      options.set(name, true);
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      die(`--${name} requires a value`);
    }

    index += 1;
    if (options.has(name)) {
      const current = options.get(name);
      if (Array.isArray(current)) {
        current.push(value);
      } else {
        options.set(name, [current, value]);
      }
    } else {
      options.set(name, value);
    }
  }

  return { options, positionals };
}

async function withCatalogWriteLock(operation) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  try {
    await fs.mkdir(lockDir);
    await fs.writeFile(
      path.join(lockDir, "owner"),
      `pid=${process.pid}\nstarted_at=${new Date().toISOString()}\n`,
      "utf8"
    );
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

function optionValues(options, name) {
  if (!options.has(name)) {
    return [];
  }

  const value = options.get(name);
  return Array.isArray(value) ? value : [value];
}

function requiredOption(options, name) {
  const values = optionValues(options, name);
  if (values.length !== 1) {
    die(`--${name} is required exactly once`);
  }

  return values[0];
}

async function readCollection(id) {
  assertId(id, "collection id");
  const collectionPath = path.join(collectionsDir, id, "collection.yaml");
  const raw = await fs.readFile(collectionPath, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      die(`collection not found: ${id}`, 4);
    }

    throw error;
  });
  const config = load(raw);

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    die(`${id} collection.yaml must be a YAML object`);
  }

  return { collectionPath, config, raw };
}

async function writeCollection(collectionPath, config) {
  await fs.writeFile(collectionPath, dump(config, { lineWidth: 120, noRefs: true, sortKeys: false }), "utf8");
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

async function withCollectionRollback(id, update) {
  const { collectionPath, config, raw } = await readCollection(id);
  const backupPath = `${collectionPath}.bak.${process.pid}`;
  const nextPath = `${collectionPath}.next.${process.pid}`;

  try {
    await update(config);
    await writeCollection(nextPath, config);
    await fs.rename(collectionPath, backupPath);
    await fs.rename(nextPath, collectionPath);
    validateCatalog();
    await fs.rm(backupPath, { force: true });
  } catch (error) {
    await fs.rm(nextPath, { force: true });
    await fs.writeFile(collectionPath, raw, "utf8");
    await fs.rm(backupPath, { force: true });
    throw error;
  }
}

async function listCollections() {
  const entries = await fs.readdir(collectionsDir, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => !id.startsWith("."))
    .filter((id) => slugPattern.test(id))
    .sort();

  for (const id of ids) {
    await fs.access(path.join(collectionsDir, id, "collection.yaml"));
    console.log(id);
  }
}

async function showCollection(id) {
  assertId(id, "collection id");
  const collectionPath = path.join(collectionsDir, id, "collection.yaml");
  const raw = await fs.readFile(collectionPath, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      die(`collection not found: ${id}`, 4);
    }

    throw error;
  });
  process.stdout.write(raw);
}

async function createCollection(args) {
  const [id, ...rest] = args;
  if (!id) {
    die("missing collection id");
  }

  assertId(id, "collection id");
  const { options, positionals } = parseOptions(rest, new Set(["title", "summary", "project", "status", "details"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for collection new: ${positionals.join(" ")}`);
  }

  const title = requiredOption(options, "title");
  const summary = requiredOption(options, "summary");
  const projects = optionValues(options, "project");
  const status = options.get("status") ?? "draft";
  const includeDetails = options.has("details");

  if (projects.length === 0) {
    die("at least one --project is required");
  }

  if (!validCollectionStatuses.has(status)) {
    die("--status must be published, draft, or archived");
  }

  for (const project of projects) {
    assertId(project, "project id");
  }

  const collectionDir = path.join(collectionsDir, id);
  const tmpDir = path.join(collectionsDir, `.${id}.tmp.${process.pid}`);

  try {
    await fs.access(collectionDir);
    die(`${collectionDir} already exists`, 3);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await fs.mkdir(tmpDir, { recursive: false });
    const config = {
      schema_version: 1,
      id,
      title,
      summary,
      status,
      items: projects.map((project) => ({ project }))
    };

    if (includeDetails) {
      config.details = {
        type: "markdown",
        path: "./details.md"
      };
    }

    await writeCollection(path.join(tmpDir, "collection.yaml"), config);

    if (includeDetails) {
      await fs.writeFile(path.join(tmpDir, "details.md"), `# ${title}\n\nAdd collection details here.\n`, "utf8");
    }

    await fs.rename(tmpDir, collectionDir).catch((error) => {
      if (error.code === "EEXIST" || error.code === "ENOTEMPTY") {
        die(`${collectionDir} already exists`, 3);
      }

      throw error;
    });

    validateCatalog();
  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(collectionDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  event("CREATED", id, `catalog/collections/${id}`);
}

async function deleteCollection(args) {
  const [id, ...rest] = args;
  if (!id) {
    die("missing collection id");
  }

  const { options, positionals } = parseOptions(rest, new Set(["force"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for collection delete: ${positionals.join(" ")}`);
  }

  if (!options.has("force")) {
    die("collection delete requires --force");
  }

  assertId(id, "collection id");
  const collectionDir = path.join(collectionsDir, id);
  const backupDir = path.join(collectionsDir, `.${id}.delete.${process.pid}`);

  await fs.rename(collectionDir, backupDir).catch((error) => {
    if (error.code === "ENOENT") {
      die(`collection not found: ${id}`, 4);
    }

    throw error;
  });

  try {
    validateCatalog();
    await fs.rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    await fs.rename(backupDir, collectionDir);
    throw error;
  }

  event("DELETED", id, `catalog/collections/${id}`);
}

async function addProject(args) {
  const [collectionId, projectId, ...rest] = args;
  if (!collectionId || !projectId) {
    die("collection add-project requires <collection-id> <project-id>");
  }

  assertId(collectionId, "collection id");
  assertId(projectId, "project id");
  const { options, positionals } = parseOptions(rest, new Set(["note", "position"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for collection add-project: ${positionals.join(" ")}`);
  }

  const note = options.get("note");
  const position = options.get("position");
  if (position && !/^[1-9][0-9]*$/.test(position)) {
    die("--position must be a 1-based positive integer");
  }

  await withCollectionRollback(collectionId, async (config) => {
    if (!Array.isArray(config.items)) {
      die(`${collectionId} items must be an array`);
    }

    const item = note ? { project: projectId, note } : { project: projectId };
    const index = position ? Number(position) - 1 : config.items.length;
    if (index > config.items.length) {
      die(`--position is out of range for ${collectionId}`);
    }

    config.items.splice(index, 0, item);
  });

  event("UPDATED", collectionId, `added ${projectId}`);
}

async function removeProject(args) {
  const [collectionId, projectId] = args;
  if (!collectionId || !projectId || args.length !== 2) {
    die("collection remove-project requires <collection-id> <project-id>");
  }

  assertId(collectionId, "collection id");
  assertId(projectId, "project id");

  await withCollectionRollback(collectionId, async (config) => {
    if (!Array.isArray(config.items)) {
      die(`${collectionId} items must be an array`);
    }

    const before = config.items.length;
    config.items = config.items.filter((item) => item.project !== projectId);
    if (config.items.length === before) {
      die(`${collectionId} does not reference project: ${projectId}`);
    }
  });

  event("UPDATED", collectionId, `removed ${projectId}`);
}

async function setScalarField(args, field, label) {
  const [collectionId, value] = args;
  if (!collectionId || !value || args.length !== 2) {
    die(`collection ${label} requires <collection-id> <value>`);
  }

  assertId(collectionId, "collection id");
  if (field === "status" && !validCollectionStatuses.has(value)) {
    die("status must be published, draft, or archived");
  }

  await withCollectionRollback(collectionId, async (config) => {
    config[field] = value;
  });

  event("UPDATED", collectionId, `${field}=${value}`);
}

async function setNote(args) {
  const [collectionId, projectId, ...rest] = args;
  if (!collectionId || !projectId) {
    die("collection set-note requires <collection-id> <project-id> --note <note>");
  }

  assertId(collectionId, "collection id");
  assertId(projectId, "project id");
  const { options, positionals } = parseOptions(rest, new Set(["note"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for collection set-note: ${positionals.join(" ")}`);
  }

  const note = requiredOption(options, "note");

  await withCollectionRollback(collectionId, async (config) => {
    if (!Array.isArray(config.items)) {
      die(`${collectionId} items must be an array`);
    }

    const item = config.items.find((candidate) => candidate.project === projectId);
    if (!item) {
      die(`${collectionId} does not reference project: ${projectId}`);
    }

    item.note = note;
  });

  event("UPDATED", collectionId, `note ${projectId}`);
}

async function main() {
  const [scope, command, ...args] = process.argv.slice(2);

  if (scope !== "collection" || !command || command === "help" || command === "-h" || command === "--help") {
    usage();
    process.exit(scope === "collection" ? 0 : 2);
  }

  const runCommand = async () => {
    switch (command) {
    case "list":
      if (args.length !== 0) die(`unexpected arguments for collection list: ${args.join(" ")}`);
      await listCollections();
      break;
    case "show":
      if (args.length !== 1) die("collection show requires <id>");
      await showCollection(args[0]);
      break;
    case "new":
      await createCollection(args);
      break;
    case "delete":
      await deleteCollection(args);
      break;
    case "add-project":
      await addProject(args);
      break;
    case "remove-project":
      await removeProject(args);
      break;
    case "set-title":
      await setScalarField(args, "title", "set-title");
      break;
    case "set-summary":
      await setScalarField(args, "summary", "set-summary");
      break;
    case "set-status":
      await setScalarField(args, "status", "set-status");
      break;
    case "set-note":
      await setNote(args);
      break;
    default:
      usage();
      process.exit(2);
    }
  };

  if (writeCommands.has(command)) {
    await withCatalogWriteLock(runCommand);
  } else {
    await runCommand();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `ERROR: ${error.message}` : error);
  process.exit(error.exitCode ?? 1);
});
