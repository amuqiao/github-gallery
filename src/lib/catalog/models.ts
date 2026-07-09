import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { adaptProjectBlocks, type AdaptedProjectBlock } from "./block-adapters";
import { modelConfigSchema } from "./catalog-schema.js";
import type { ModelConfig, ProjectNoteConfig } from "./catalog-types";

const repoRoot = process.cwd();
const modelsRoot = path.join(repoRoot, "catalog", "models");

export type ModelNote = ProjectNoteConfig & {
  route: string;
};

export type ModelItem = Omit<ModelConfig, "blocks" | "notes"> & {
  blocks: AdaptedProjectBlock[];
  notes: ModelNote[];
  directory: string;
  route: string;
};

let modelSnapshot: Promise<ModelItem[]> | undefined;

export async function getAllModels(): Promise<ModelItem[]> {
  modelSnapshot ??= readModels();
  return modelSnapshot;
}

export async function getModelById(id: string): Promise<ModelItem> {
  const model = (await getAllModels()).find((item) => item.id === id);

  if (!model) {
    throw new Error(`Unknown model id: ${id}`);
  }

  return model;
}

export function getModelNoteById(model: ModelItem, noteId: string): ModelNote {
  const note = model.notes.find((item) => item.id === noteId);

  if (!note) {
    throw new Error(`${model.id} references unknown note: ${noteId}`);
  }

  return note;
}

export function resolveModelPath(model: ModelItem, relativePath: string): string {
  const fullPath = path.resolve(model.directory, relativePath);
  const relativeToModel = path.relative(model.directory, fullPath);

  if (relativeToModel.startsWith("..") || path.isAbsolute(relativeToModel)) {
    throw new Error(`${model.id} references a path outside its model directory: ${relativePath}`);
  }

  return fullPath;
}

async function readModels(): Promise<ModelItem[]> {
  const entries = await fs.readdir(modelsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const models = await Promise.all(directories.map((directory) => readModel(directory)));
  assertUniqueIds("models", models);
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

async function readModel(directoryName: string): Promise<ModelItem> {
  const directory = path.join(modelsRoot, directoryName);
  const raw = await fs.readFile(path.join(directory, "model.yaml"), "utf8");
  const config = modelConfigSchema.parse(load(raw));

  if (config.id !== directoryName) {
    throw new Error(`Model directory "${directoryName}" must match model id "${config.id}"`);
  }

  const model = {
    ...config,
    blocks: adaptProjectBlocks(config.blocks),
    notes: adaptModelNotes(config),
    directory,
    route: `/halls/models/${config.id}/`
  };

  await assertReferencedFilesExist(model);
  return model;
}

function adaptModelNotes(model: ModelConfig): ModelNote[] {
  const notes = model.notes ?? [];
  assertUniqueIds(`${model.id} notes`, notes);

  return notes.map((note) => ({
    ...note,
    route: `/halls/models/${model.id}/notes/${note.id}/`
  }));
}

async function assertReferencedFilesExist(model: ModelItem): Promise<void> {
  const references = [
    ...(model.details ? [{ kind: "details", path: model.details.path }] : []),
    ...model.notes.map((note) => ({ kind: `note ${note.id}`, path: note.path }))
  ];
  const realModelDirectory = await fs.realpath(model.directory);

  for (const reference of references) {
    const referencePath = resolveModelPath(model, reference.path);
    const stats = await fs.lstat(referencePath);

    if (stats.isSymbolicLink()) {
      throw new Error(`${model.id} references a symlink ${reference.kind} file: ${reference.path}`);
    }

    if (!stats.isFile()) {
      throw new Error(`${model.id} references a non-file ${reference.kind} path: ${reference.path}`);
    }

    const realReferencePath = await fs.realpath(referencePath);
    assertPathInsideModel({ ...model, directory: realModelDirectory }, realReferencePath, reference.path);
  }
}

function assertPathInsideModel(model: ModelItem, fullPath: string, relativePath: string): void {
  const relativeToModel = path.relative(model.directory, fullPath);

  if (relativeToModel.startsWith("..") || path.isAbsolute(relativeToModel)) {
    throw new Error(`${model.id} references a path outside its model directory: ${relativePath}`);
  }
}

function assertUniqueIds(label: string, items: Array<{ id: string }>): void {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id}`);
    }

    seen.add(item.id);
  }
}
