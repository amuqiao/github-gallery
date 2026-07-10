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
const hallsRoot = path.join(rootDir, "catalog", "halls");
const lockDir = path.join(rootDir, ".data", "catalog-write.lock");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const contentTypes = new Set(["item", "collection"]);
const contentKinds = {
  item: "items",
  collection: "collections"
};
const contentStates = ["drafts", "published", "archived"];
const writeCommands = new Set(["item", "collection", "publish", "archive", "restore"]);
let lockHeld = false;
let signalRollback;

function cleanupLockSync() {
  if (lockHeld) {
    rmSync(lockDir, { recursive: true, force: true });
    lockHeld = false;
  }
}

process.once("exit", cleanupLockSync);
async function exitAfterSignal(code) {
  try {
    if (signalRollback) {
      await signalRollback();
      signalRollback = undefined;
    }
  } finally {
    cleanupLockSync();
    process.exit(code);
  }
}

process.once("SIGINT", () => {
  void exitAfterSignal(130);
});
process.once("SIGTERM", () => {
  void exitAfterSignal(143);
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
  ./scripts/content.sh item note import <hall> <id> <note-id> --state <drafts|published> --file <path> --title <title> --summary <summary> [--display <site|standalone>]
  ./scripts/content.sh item note replace <hall> <id> <note-id> --state <drafts|published> --file <path>
  ./scripts/content.sh collection new <hall> <id> --title <title> --summary <summary> --item <id> [--item <id> ...]
  ./scripts/content.sh publish <hall> <item|collection> <id>
  ./scripts/content.sh archive <hall> <item|collection> <id>
  ./scripts/content.sh restore <hall> <item|collection> <id>
  ./scripts/content.sh list [[drafts|published|archived] [hall] | [hall]]
  ./scripts/content.sh show <hall> <item|collection> <id>
  ./scripts/content.sh status <hall> <item|collection> <id>

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

async function readDirectoriesIfExists(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const directories = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      if (!entry.isDirectory()) {
        die(`${path.relative(rootDir, directory)} must only contain directories: ${entry.name}`, 1);
      }

      if (!slugPattern.test(entry.name)) {
        die(`${path.relative(rootDir, directory)} must only contain lowercase kebab-case directories: ${entry.name}`, 1);
      }

      directories.push(entry.name);
    }

    return directories.sort();
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
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

function bundleConfigPath(directory, type) {
  return path.join(directory, type === "item" ? "item.yaml" : "collection.yaml");
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

async function findBundleAcrossStates(hall, type, id) {
  const matches = [];

  for (const state of contentStates) {
    const directory = bundleDirectory(state, hall, type, id);
    if (await pathExists(directory)) {
      matches.push({ state, directory });
    }
  }

  if (matches.length === 0) {
    die(`${hall}/${type}/${id} not found in ${contentStates.join(", ")}`, 4);
  }

  if (matches.length > 1) {
    die(`${hall}/${type}/${id} exists in multiple states`, 3);
  }

  return matches[0];
}

async function assertActiveHall(hall) {
  assertId(hall, "hall id");

  const hallConfigPath = path.join(hallsRoot, hall, "hall.yaml");
  if (!(await pathExists(hallConfigPath))) {
    die(`unknown hall: ${hall}`, 4);
  }

  const { config } = await readYamlObject(hallConfigPath, `${hall} hall.yaml`);
  if (config.id !== hall) {
    die(`${hall} hall.yaml id must match its directory`, 1);
  }

  if (config.availability !== "active") {
    die(`${hall} is not an active content hall`, 4);
  }
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

function assertContentState(state) {
  if (!["drafts", "published"].includes(state)) {
    die("--state must be drafts or published");
  }
}

function validationCommandForState(state) {
  return state === "published" ? "release" : "catalog";
}

function assertDisplay(display) {
  if (!["site", "standalone"].includes(display)) {
    die("--display must be site or standalone");
  }
}

function noteFormatFromFilePath(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".md") {
    return { type: "markdown", extension: "md" };
  }

  if (extension === ".html") {
    return { type: "html", extension: "html" };
  }

  die("--file must point to a .md or .html file");
}

async function readNoteSourceFile(filePath) {
  const sourcePath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
  let stats;

  try {
    stats = await fs.lstat(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      die(`note source file does not exist: ${filePath}`, 4);
    }

    throw error;
  }

  if (stats.isSymbolicLink()) {
    die(`note source file must not be a symlink: ${filePath}`);
  }

  if (!stats.isFile()) {
    die(`note source path must be a file: ${filePath}`);
  }

  const realSourcePath = await fs.realpath(sourcePath);
  if (realSourcePath !== sourcePath) {
    die(`note source path must not contain symlinks: ${filePath}`);
  }

  return {
    content: await fs.readFile(sourcePath, "utf8"),
    ...noteFormatFromFilePath(sourcePath)
  };
}

async function assertSafeDirectoryChain(baseDirectory, targetDirectory, label) {
  const relativeDirectory = path.relative(baseDirectory, targetDirectory);

  if (relativeDirectory === "") {
    return;
  }

  if (relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) {
    die(`${label} directory must stay inside its content bundle: ${path.relative(rootDir, targetDirectory)}`);
  }

  let current = baseDirectory;
  for (const segment of relativeDirectory.split(path.sep)) {
    current = path.join(current, segment);

    if (!(await pathExists(current))) {
      continue;
    }

    const stats = await fs.lstat(current);

    if (stats.isSymbolicLink()) {
      die(`${label} directory must not contain symlinks: ${path.relative(rootDir, current)}`);
    }

    if (!stats.isDirectory()) {
      die(`${label} path must be a directory: ${path.relative(rootDir, current)}`);
    }
  }
}

function resolveBundleLocalPath(directory, relativePath, label) {
  if (!relativePath.startsWith("./notes/")) {
    die(`${label} path must be under ./notes/: ${relativePath}`);
  }

  const fullPath = path.resolve(directory, relativePath);
  const relativeToBundle = path.relative(directory, fullPath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    die(`${label} path must stay inside its content bundle: ${relativePath}`);
  }

  return fullPath;
}

async function assertSafeExistingNoteFile(notePath, relativePath) {
  const stats = await fs.lstat(notePath);

  if (stats.isSymbolicLink()) {
    die(`note file must not be a symlink: ${relativePath}`);
  }

  if (!stats.isFile()) {
    die(`note path must be a file: ${relativePath}`);
  }
}

async function assertRealPathInsideBundle(directory, filePath, relativePath) {
  const [realBundleDirectory, realFilePath] = await Promise.all([
    fs.realpath(directory),
    fs.realpath(filePath)
  ]);
  const relativeToBundle = path.relative(realBundleDirectory, realFilePath);

  if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
    die(`note path must stay inside its content bundle: ${relativePath}`);
  }
}

function assertHtmlDocument(html, label) {
  const trimmedHtml = html.trimStart();
  const documentPattern = /^(?:<!doctype\s+html[^>]*>\s*)?<html\b[\s\S]*<body\b[\s\S]*<\/body>[\s\S]*<\/html>\s*$/i;

  if (!documentPattern.test(trimmedHtml)) {
    die(`${label} standalone HTML note must be a complete html document with html and body elements`);
  }
}

function assertSafeHtmlFragment(html, label) {
  const blockedPatterns = [
    { pattern: /<\s*!doctype\b/i, name: "doctype" },
    { pattern: /<\s*html\b/i, name: "html" },
    { pattern: /<\s*head\b/i, name: "head" },
    { pattern: /<\s*body\b/i, name: "body" },
    { pattern: /<\s*script\b/i, name: "script" },
    { pattern: /<\s*style\b/i, name: "style" },
    { pattern: /<\s*link\b/i, name: "link" },
    { pattern: /<\s*meta\b/i, name: "meta" },
    { pattern: /\son[a-z]+\s*=/i, name: "inline event handler" },
    { pattern: /\sstyle\s*=/i, name: "inline style attribute" }
  ];

  for (const { pattern, name } of blockedPatterns) {
    if (pattern.test(html)) {
      die(`${label} site HTML note contains blocked ${name}`);
    }
  }
}

function resolveImportedNoteDisplay(source, requestedDisplay) {
  if (source.type === "markdown") {
    if (requestedDisplay) {
      die("markdown notes must not set --display");
    }

    return { display: "site" };
  }

  if (!requestedDisplay) {
    die("html note import requires --display site or --display standalone");
  }

  assertDisplay(requestedDisplay);
  if (requestedDisplay === "standalone") {
    assertHtmlDocument(source.content, "imported");
    return { display: "standalone", html_mode: "document" };
  }

  assertSafeHtmlFragment(source.content, "imported");
  return { display: "site", html_mode: "fragment" };
}

function assertReplacementMatchesNote(note, source) {
  if (note.type !== source.type) {
    die(`replacement file type ${source.type} does not match note type ${note.type}`);
  }

  if (source.type === "markdown") {
    if (note.display !== "site" || note.html_mode) {
      die(`markdown note ${note.id} has invalid display metadata`);
    }
    return;
  }

  if (note.display === "standalone") {
    if (note.html_mode !== "document") {
      die(`standalone HTML note ${note.id} must use html_mode: document`);
    }
    assertHtmlDocument(source.content, "replacement");
    return;
  }

  if (note.display === "site") {
    if (note.html_mode !== "fragment") {
      die(`site HTML note ${note.id} must use html_mode: fragment`);
    }
    assertSafeHtmlFragment(source.content, "replacement");
    return;
  }

  die(`note ${note.id} display must be site or standalone`);
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

async function importItemNote(args) {
  const [hall, itemId, noteId, ...rest] = args;
  if (!hall || !itemId || !noteId) {
    die("item note import requires <hall> <id> <note-id>");
  }

  assertId(hall, "hall id");
  assertId(itemId, "item id");
  assertId(noteId, "note id");

  const { options, positionals } = parseOptions(
    rest,
    new Set(["state", "file", "title", "summary", "display"])
  );
  if (positionals.length > 0) {
    die(`unexpected arguments for item note import: ${positionals.join(" ")}`);
  }

  const state = requiredOption(options, "state");
  assertContentState(state);

  const title = requiredOption(options, "title");
  const summary = requiredOption(options, "summary");
  const source = await readNoteSourceFile(requiredOption(options, "file"));
  const display = optionalOption(options, "display");
  const displayConfig = resolveImportedNoteDisplay(source, display);

  await assertActiveHall(hall);
  const { directory } = await findExistingBundle(hall, "item", itemId, [state]);
  const itemPath = path.join(directory, "item.yaml");
  const { raw, config } = await readYamlObject(itemPath, `${itemId} item.yaml`);
  const notes = Array.isArray(config.notes) ? config.notes : [];

  if (notes.some((note) => note.id === noteId)) {
    die(`${itemId} already has note: ${noteId}`, 3);
  }

  const noteDirectory = path.join(directory, "notes");
  const noteDirectoryExisted = await pathExists(noteDirectory);
  await assertSafeDirectoryChain(directory, noteDirectory, "notes");

  const notePath = path.join(noteDirectory, `${noteId}.${source.extension}`);
  const relativeNotePath = `./notes/${noteId}.${source.extension}`;

  if (await pathExists(notePath)) {
    die(`${relativeNotePath} already exists`, 3);
  }

  const note = {
    id: noteId,
    title,
    type: source.type,
    path: relativeNotePath,
    summary,
    ...displayConfig
  };

  config.notes = [...notes, note];
  const rollback = async () => {
    await fs.writeFile(itemPath, raw, "utf8");
    await fs.rm(notePath, { force: true });
    if (!noteDirectoryExisted) {
      await fs.rm(noteDirectory, { recursive: true, force: true });
    }
  };

  try {
    signalRollback = rollback;
    await fs.mkdir(noteDirectory, { recursive: true });
    await fs.writeFile(notePath, source.content, "utf8");
    await writeYaml(itemPath, config);
    validateCatalog(validationCommandForState(state));
  } catch (error) {
    await rollback();
    throw error;
  } finally {
    if (signalRollback === rollback) {
      signalRollback = undefined;
    }
  }

  event("UPDATED", itemId, `imported note ${noteId} into ${state}`);
}

async function replaceItemNote(args) {
  const [hall, itemId, noteId, ...rest] = args;
  if (!hall || !itemId || !noteId) {
    die("item note replace requires <hall> <id> <note-id>");
  }

  assertId(hall, "hall id");
  assertId(itemId, "item id");
  assertId(noteId, "note id");

  const { options, positionals } = parseOptions(rest, new Set(["state", "file"]));
  if (positionals.length > 0) {
    die(`unexpected arguments for item note replace: ${positionals.join(" ")}`);
  }

  const state = requiredOption(options, "state");
  assertContentState(state);

  const source = await readNoteSourceFile(requiredOption(options, "file"));

  await assertActiveHall(hall);
  const { directory } = await findExistingBundle(hall, "item", itemId, [state]);
  const { config } = await readYamlObject(path.join(directory, "item.yaml"), `${itemId} item.yaml`);
  const notes = Array.isArray(config.notes) ? config.notes : [];
  const note = notes.find((entry) => entry.id === noteId);

  if (!note) {
    die(`${itemId} does not have note: ${noteId}`, 4);
  }

  assertReplacementMatchesNote(note, source);

  const notePath = resolveBundleLocalPath(directory, note.path, `note ${noteId}`);
  await assertSafeDirectoryChain(directory, path.dirname(notePath), `note ${noteId}`);
  await assertSafeExistingNoteFile(notePath, note.path);
  await assertRealPathInsideBundle(directory, notePath, note.path);

  const previousContent = await fs.readFile(notePath, "utf8");
  const rollback = async () => {
    await fs.writeFile(notePath, previousContent, "utf8");
  };

  try {
    signalRollback = rollback;
    await fs.writeFile(notePath, source.content, "utf8");
    validateCatalog(validationCommandForState(state));
  } catch (error) {
    await rollback();
    throw error;
  } finally {
    if (signalRollback === rollback) {
      signalRollback = undefined;
    }
  }

  event("UPDATED", itemId, `replaced note ${noteId} in ${state}`);
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

async function listContent(args) {
  if (args.length > 2) {
    die("list accepts [drafts|published|archived] [hall] or [hall]");
  }

  let states = contentStates;
  let hallFilter;

  if (args.length === 1) {
    if (contentStates.includes(args[0])) {
      states = [args[0]];
    } else {
      hallFilter = args[0];
    }
  }

  if (args.length === 2) {
    if (!contentStates.includes(args[0])) {
      die(`publication state must be one of ${contentStates.join(", ")}: ${args[0]}`);
    }
    states = [args[0]];
    hallFilter = args[1];
  }

  if (hallFilter) {
    await assertActiveHall(hallFilter);
  }

  console.log("state\thall\ttype\tid\ttitle");
  for (const state of states) {
    const stateDirectory = path.join(contentRoot, state);
    const halls = hallFilter ? [hallFilter] : await readDirectoriesIfExists(stateDirectory);

    for (const hall of halls) {
      await assertActiveHall(hall);

      for (const type of ["item", "collection"]) {
        const kindDirectory = path.join(stateDirectory, hall, contentKinds[type]);
        const ids = await readDirectoriesIfExists(kindDirectory);

        for (const id of ids) {
          const directory = path.join(kindDirectory, id);
          const { config } = await readYamlObject(bundleConfigPath(directory, type), `${id} ${type}.yaml`);
          console.log(`${state}\t${hall}\t${type}\t${id}\t${config.title ?? ""}`);
        }
      }
    }
  }
}

async function showContent(args) {
  const [hall, type, id] = args;
  if (!hall || !type || !id || args.length !== 3) {
    die("show requires <hall> <item|collection> <id>");
  }

  assertId(hall, "hall id");
  assertId(id, `${type} id`);
  if (!contentTypes.has(type)) {
    die("content type must be item or collection");
  }

  const { state, directory } = await findBundleAcrossStates(hall, type, id);
  const configPath = bundleConfigPath(directory, type);
  const raw = await fs.readFile(configPath, "utf8");
  console.log(`# state: ${state}`);
  console.log(`# path: ${path.relative(rootDir, configPath)}`);
  process.stdout.write(raw);
}

async function showStatus(args) {
  const [hall, type, id] = args;
  if (!hall || !type || !id || args.length !== 3) {
    die("status requires <hall> <item|collection> <id>");
  }

  assertId(hall, "hall id");
  assertId(id, `${type} id`);
  if (!contentTypes.has(type)) {
    die("content type must be item or collection");
  }

  const { state, directory } = await findBundleAcrossStates(hall, type, id);
  console.log("state\thall\ttype\tid\tpath");
  console.log(`${state}\t${hall}\t${type}\t${id}\t${path.relative(rootDir, directory)}`);
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

    if (command === "note" && args[0] === "import") {
      await importItemNote(args.slice(1));
      return;
    }

    if (command === "note" && args[0] === "replace") {
      await replaceItemNote(args.slice(1));
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

  if (scope === "list") {
    await listContent([command, ...args].filter((value) => value !== undefined));
    return;
  }

  if (scope === "show") {
    await showContent([command, ...args]);
    return;
  }

  if (scope === "status") {
    await showStatus([command, ...args]);
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
