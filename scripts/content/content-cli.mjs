#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dump, load } from "js-yaml";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentRoot = path.join(rootDir, "catalog", "content");
const lockDir = path.join(rootDir, ".data", "catalog-write.lock");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const contentTypes = new Set(["item", "collection"]);
const contentKinds = {
  item: "items",
  collection: "collections"
};
const writeCommands = new Set(["item", "collection", "publish", "archive", "restore"]);
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
  console.log(`${action.padEnd(9)} ${id.padEnd(16)} ${detail}`);
}

function assertId(id, label = "id") {
  if (!slugPattern.test(id)) {
    die(`${label} must use lowercase kebab-case: ${id}`);
  }
}

function usage() {
  console.log(`用法：
  ./scripts/content.sh item new <hall> <github_project|ai_model> <id> [options]
  ./scripts/content.sh item note add <hall> <id> <note-id> [options]
  ./scripts/content.sh collection new <hall> <id> --title <title> --summary <summary> --item <id> [--item <id> ...]
  ./scripts/content.sh publish <hall> <item|collection> <id>
  ./scripts/content.sh archive <hall> <item|collection> <id>
  ./scripts/content.sh restore <hall> <item|collection> <id>

写操作会加 catalog write lock，并在写后运行验证。publish 使用 ./scripts/verify.sh release。`);
}

function parseOptions(args, allowedOptions = new Set(), booleanOptions = new Set()) {
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

    if (booleanOptions.has(name)) {
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

function optionValues(options, name) {
  if (!options.has(name)) {
    return [];
  }

  const value = options.get(name);
  return Array.isArray(value) ? value : [value];
}

function optionalOption(options, name) {
  const values = optionValues(options, name);
  if (values.length > 1) {
    die(`--${name} must be passed at most once`);
  }

  return values[0];
}

function requiredOption(options, name) {
  const values = optionValues(options, name);
  if (values.length !== 1) {
    die(`--${name} is required exactly once`);
  }

  return values[0];
}

async function withCatalogWriteLock(operation) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  try {
    await fs.mkdir(lockDir);
    lockHeld = true;
    await fs.writeFile(
      path.join(lockDir, "owner"),
      `pid=${process.pid}\nstarted_at=${new Date().toISOString()}\n`,
      "utf8"
    );
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

function validateCatalog(command = "catalog") {
  const result = spawnSync("./scripts/verify.sh", [command], {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    const error = new Error(`${command} validation failed`);
    error.exitCode = result.status ?? 1;
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

async function collectMissingParents(startDirectory, stopDirectory) {
  const stop = path.resolve(stopDirectory);
  const missingParents = [];
  let current = path.dirname(startDirectory);

  while (current.startsWith(`${stop}${path.sep}`)) {
    if (!(await pathExists(current))) {
      missingParents.push(current);
    }

    current = path.dirname(current);
  }

  return missingParents;
}

async function removeEmptyDirectories(directories) {
  for (const directory of directories) {
    try {
      await fs.rmdir(directory);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      if (error.code === "ENOTEMPTY" || error.code === "EEXIST") {
        return;
      }

      throw error;
    }
  }
}

function bundleDirectory(state, hall, type, id) {
  const kindDirectory = contentKinds[type];
  if (!kindDirectory) {
    die(`content type must be item or collection: ${type}`);
  }

  return path.join(contentRoot, state, hall, kindDirectory, id);
}

async function assertNoBundleExists(hall, type, id) {
  for (const state of ["drafts", "published", "archived"]) {
    const directory = bundleDirectory(state, hall, type, id);
    if (await pathExists(directory)) {
      die(`${hall}/${type}/${id} already exists in ${state}`, 3);
    }
  }
}

async function findExistingBundle(hall, type, id, allowedStates) {
  for (const state of allowedStates) {
    const directory = bundleDirectory(state, hall, type, id);
    if (await pathExists(directory)) {
      return { state, directory };
    }
  }

  die(`${hall}/${type}/${id} not found in ${allowedStates.join(", ")}`, 4);
}

async function writeYaml(filePath, config) {
  await fs.writeFile(filePath, dump(config, { lineWidth: 120, noRefs: true, sortKeys: false }), "utf8");
}

function markdownSkeleton(title, kind) {
  return `# ${title}\n\nAdd ${kind} content here.\n`;
}

function htmlFragmentSkeleton(title) {
  return `<section>\n  <h1>${escapeHtml(title)}</h1>\n  <p>Add HTML note content here.</p>\n</section>\n`;
}

function htmlDocumentSkeleton(title) {
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8" />\n  <title>${escapeHtml(title)}</title>\n</head>\n<body>\n  <main>\n    <h1>${escapeHtml(title)}</h1>\n    <p>Add standalone HTML note content here.</p>\n  </main>\n</body>\n</html>\n`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assertRepeatedIds(values, label) {
  for (const value of values) {
    assertId(value, label);
  }
}

function buildItemConfig(hall, kind, id, options) {
  const title = requiredOption(options, "title");
  const summary = requiredOption(options, "summary");

  if (kind === "github_project") {
    const repo = requiredOption(options, "repo");
    const tags = optionValues(options, "tag");
    if (tags.length === 0) {
      die("github_project item new requires at least one --tag");
    }

    assertId(requiredOption(options, "category"), "category id");
    assertRepeatedIds(tags, "tag id");
    assertId(requiredOption(options, "maintenance-status"), "maintenance status id");

    const profile = {
      repo,
      category: requiredOption(options, "category"),
      tags,
      maintenance_status: requiredOption(options, "maintenance-status")
    };
    const license = optionalOption(options, "license");
    const languages = optionValues(options, "language");

    if (license) {
      profile.license = license;
    }
    if (languages.length > 0) {
      profile.languages = languages;
    }

    return {
      schema_version: 2,
      id,
      hall,
      kind,
      title,
      summary,
      source: {
        type: "github",
        url: repo
      },
      body: {
        type: "markdown",
        path: "./index.md"
      },
      profile
    };
  }

  if (kind === "ai_model") {
    const inputs = optionValues(options, "input");
    const outputs = optionValues(options, "output");
    const tasks = optionValues(options, "task");
    const access = optionValues(options, "access");
    const formats = optionValues(options, "format");
    const runtimes = optionValues(options, "runtime");

    for (const [label, values] of [
      ["--input", inputs],
      ["--output", outputs],
      ["--task", tasks],
      ["--access", access],
      ["--format", formats],
      ["--runtime", runtimes]
    ]) {
      if (values.length === 0) {
        die(`ai_model item new requires at least one ${label}`);
      }
    }

    const profile = {
      provider: requiredOption(options, "provider"),
      modalities: {
        input: inputs,
        output: outputs
      },
      tasks,
      access,
      formats,
      runtimes
    };
    const license = optionalOption(options, "license");

    if (license) {
      profile.license = license;
    }

    return {
      schema_version: 2,
      id,
      hall,
      kind,
      title,
      summary,
      source: {
        type: requiredOption(options, "source-type"),
        url: requiredOption(options, "source-url")
      },
      body: {
        type: "markdown",
        path: "./index.md"
      },
      profile
    };
  }

  die(`unknown content item kind: ${kind}`);
}

async function createItem(args) {
  const [hall, kind, id, ...rest] = args;
  if (!hall || !kind || !id) {
    die("item new requires <hall> <github_project|ai_model> <id>");
  }

  assertId(hall, "hall id");
  assertId(id, "item id");

  const allowedOptions = new Set([
    "title",
    "summary",
    "source-type",
    "source-url",
    "provider",
    "input",
    "output",
    "task",
    "access",
    "format",
    "runtime",
    "license",
    "repo",
    "category",
    "tag",
    "maintenance-status",
    "language"
  ]);
  const { options, positionals } = parseOptions(rest, allowedOptions);
  if (positionals.length > 0) {
    die(`unexpected arguments for item new: ${positionals.join(" ")}`);
  }

  await assertNoBundleExists(hall, "item", id);

  const targetDir = bundleDirectory("drafts", hall, "item", id);
  const tmpDir = path.join(path.dirname(targetDir), `.${id}.tmp.${process.pid}`);
  const createdParents = await collectMissingParents(targetDir, path.join(contentRoot, "drafts"));
  const config = buildItemConfig(hall, kind, id, options);

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await writeYaml(path.join(tmpDir, "item.yaml"), config);
    await fs.writeFile(path.join(tmpDir, "index.md"), markdownSkeleton(config.title, "item"), "utf8");
    await fs.rename(tmpDir, targetDir);
    validateCatalog("catalog");
  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(targetDir, { recursive: true, force: true });
    await removeEmptyDirectories(createdParents);
    throw error;
  }

  event("CREATED", id, path.relative(rootDir, targetDir));
}

async function readYamlObject(filePath, label) {
  const raw = await fs.readFile(filePath, "utf8");
  const config = load(raw);

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    die(`${label} must be a YAML object`);
  }

  return { raw, config };
}

async function addItemNote(args) {
  const [hall, itemId, noteId, ...rest] = args;
  if (!hall || !itemId || !noteId) {
    die("item note add requires <hall> <id> <note-id>");
  }

  assertId(hall, "hall id");
  assertId(itemId, "item id");
  assertId(noteId, "note id");

  const { options, positionals } = parseOptions(
    rest,
    new Set(["title", "summary", "format", "display"])
  );
  if (positionals.length > 0) {
    die(`unexpected arguments for item note add: ${positionals.join(" ")}`);
  }

  const title = requiredOption(options, "title");
  const summary = requiredOption(options, "summary");
  const format = requiredOption(options, "format");
  if (!["markdown", "html"].includes(format)) {
    die("--format must be markdown or html");
  }

  const { directory } = await findExistingBundle(hall, "item", itemId, ["drafts"]);
  const itemPath = path.join(directory, "item.yaml");
  const { raw, config } = await readYamlObject(itemPath, `${itemId} item.yaml`);
  const notes = Array.isArray(config.notes) ? config.notes : [];

  if (notes.some((note) => note.id === noteId)) {
    die(`${itemId} already has note: ${noteId}`, 3);
  }

  const noteDirectory = path.join(directory, "notes");
  const noteDirectoryExisted = await pathExists(noteDirectory);
  const extension = format === "markdown" ? "md" : "html";
  const notePath = path.join(noteDirectory, `${noteId}.${extension}`);
  const relativeNotePath = `./notes/${noteId}.${extension}`;

  if (await pathExists(notePath)) {
    die(`${relativeNotePath} already exists`, 3);
  }

  const note = {
    id: noteId,
    title,
    type: format,
    path: relativeNotePath,
    summary,
    display: "site"
  };

  let noteContent = markdownSkeleton(title, "note");
  if (format === "html") {
    const display = requiredOption(options, "display");
    if (!["site", "standalone"].includes(display)) {
      die("--display must be site or standalone");
    }

    note.display = display;
    note.html_mode = display === "site" ? "fragment" : "document";
    noteContent = display === "site" ? htmlFragmentSkeleton(title) : htmlDocumentSkeleton(title);
  } else if (options.has("display")) {
    die("markdown notes must not set --display");
  }

  config.notes = [...notes, note];

  try {
    await fs.mkdir(noteDirectory, { recursive: true });
    await fs.writeFile(notePath, noteContent, "utf8");
    await writeYaml(itemPath, config);
    validateCatalog("catalog");
  } catch (error) {
    await fs.writeFile(itemPath, raw, "utf8");
    await fs.rm(notePath, { force: true });
    if (!noteDirectoryExisted) {
      await fs.rm(noteDirectory, { recursive: true, force: true });
    }
    throw error;
  }

  event("UPDATED", itemId, `added note ${noteId}`);
}

async function createCollection(args) {
  const [hall, id, ...rest] = args;
  if (!hall || !id) {
    die("collection new requires <hall> <id>");
  }

  assertId(hall, "hall id");
  assertId(id, "collection id");

  const { options, positionals } = parseOptions(rest, new Set(["title", "summary", "item"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for collection new: ${positionals.join(" ")}`);
  }

  const title = requiredOption(options, "title");
  const summary = requiredOption(options, "summary");
  const items = optionValues(options, "item");
  if (items.length === 0) {
    die("collection new requires at least one --item");
  }
  assertRepeatedIds(items, "item id");
  await assertNoBundleExists(hall, "collection", id);

  const targetDir = bundleDirectory("drafts", hall, "collection", id);
  const tmpDir = path.join(path.dirname(targetDir), `.${id}.tmp.${process.pid}`);
  const createdParents = await collectMissingParents(targetDir, path.join(contentRoot, "drafts"));
  const config = {
    schema_version: 2,
    id,
    hall,
    title,
    summary,
    body: {
      type: "markdown",
      path: "./index.md"
    },
    items: items.map((item) => ({ item }))
  };

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await writeYaml(path.join(tmpDir, "collection.yaml"), config);
    await fs.writeFile(path.join(tmpDir, "index.md"), markdownSkeleton(title, "collection"), "utf8");
    await fs.rename(tmpDir, targetDir);
    validateCatalog("catalog");
  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(targetDir, { recursive: true, force: true });
    await removeEmptyDirectories(createdParents);
    throw error;
  }

  event("CREATED", id, path.relative(rootDir, targetDir));
}

async function moveBundle(args, fromState, toState, validationCommand, action) {
  const [hall, type, id] = args;
  if (!hall || !type || !id || args.length !== 3) {
    die(`${action.toLowerCase()} requires <hall> <item|collection> <id>`);
  }

  assertId(hall, "hall id");
  assertId(id, `${type} id`);
  if (!contentTypes.has(type)) {
    die("content type must be item or collection");
  }

  const sourceDir = bundleDirectory(fromState, hall, type, id);
  const targetDir = bundleDirectory(toState, hall, type, id);
  const backupDir = path.join(path.dirname(sourceDir), `.${id}.${action.toLowerCase()}.${process.pid}`);

  if (!(await pathExists(sourceDir))) {
    die(`${hall}/${type}/${id} not found in ${fromState}`, 4);
  }

  if (await pathExists(targetDir)) {
    die(`${hall}/${type}/${id} already exists in ${toState}`, 3);
  }

  const createdParents = await collectMissingParents(targetDir, path.join(contentRoot, toState));
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  let movedToTarget = false;

  try {
    await fs.rename(sourceDir, backupDir);
    await fs.rename(backupDir, targetDir);
    movedToTarget = true;
    validateCatalog(validationCommand);
  } catch (error) {
    if (movedToTarget && (await pathExists(targetDir))) {
      await fs.rename(targetDir, sourceDir);
    } else if (await pathExists(backupDir)) {
      await fs.rename(backupDir, sourceDir);
    }
    await removeEmptyDirectories(createdParents);
    throw error;
  }

  event(action, id, `${fromState} -> ${toState}`);
}

async function runCommand() {
  const [scope, command, ...args] = process.argv.slice(2);

  if (!scope || scope === "help" || scope === "-h" || scope === "--help") {
    usage();
    process.exit(scope ? 0 : 2);
  }

  if (scope === "item") {
    if (command === "new") {
      await createItem(args);
      return;
    }

    if (command === "note" && args[0] === "add") {
      await addItemNote(args.slice(1));
      return;
    }
  }

  if (scope === "collection" && command === "new") {
    await createCollection(args);
    return;
  }

  if (scope === "publish") {
    await moveBundle([command, ...args], "drafts", "published", "release", "PUBLISHED");
    return;
  }

  if (scope === "archive") {
    await moveBundle([command, ...args], "published", "archived", "catalog", "ARCHIVED");
    return;
  }

  if (scope === "restore") {
    await moveBundle([command, ...args], "archived", "drafts", "catalog", "RESTORED");
    return;
  }

  usage();
  process.exit(2);
}

try {
  if (writeCommands.has(process.argv[2])) {
    await withCatalogWriteLock(runCommand);
  } else {
    await runCommand();
  }
} catch (error) {
  console.error(error instanceof Error ? `ERROR: ${error.message}` : error);
  process.exit(error.exitCode ?? 1);
}
