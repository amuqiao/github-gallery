import type { Collection } from "./collections";
import type { Project, ProjectNote } from "./projects";

type MarkdownModule = {
  Content: (_props: Record<string, unknown>) => unknown;
};

const markdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/projects/*/details.md")
};

const projectNoteMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/projects/*/notes/**/*.md")
};

const projectNoteHtmlModules = {
  ...import.meta.glob<string>("../../../catalog/projects/*/notes/**/*.html", {
    import: "default",
    query: "?raw"
  })
};

const collectionMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/collections/*/details.md")
};

export type ProjectDetail = {
  type: "markdown";
  Content: (_props: Record<string, unknown>) => unknown;
};

export async function loadProjectDetail(project: Project): Promise<ProjectDetail | undefined> {
  if (!project.details) {
    return undefined;
  }

  const key = `../../../catalog/projects/${project.id}/${project.details.path.replace("./", "")}`;
  const loader = markdownModules[key];

  if (!loader) {
    throw new Error(`${project.id} details module is not registered: ${project.details.path}`);
  }

  const module = await loader();
  return {
    type: project.details.type,
    Content: module.Content
  };
}

export type ProjectNoteDetail =
  | {
      type: "markdown";
      Content: (_props: Record<string, unknown>) => unknown;
    }
  | {
      type: "html";
      html: string;
    };

export async function loadProjectNote(project: Project, note: ProjectNote): Promise<ProjectNoteDetail> {
  const key = `../../../catalog/projects/${project.id}/${note.path.replace("./", "")}`;

  if (note.type === "markdown") {
    const loader = projectNoteMarkdownModules[key];

    if (!loader) {
      throw new Error(`${project.id} note ${note.id} markdown module is not registered: ${note.path}`);
    }

    const module = await loader();
    return {
      type: "markdown",
      Content: module.Content
    };
  }

  const loader = projectNoteHtmlModules[key];

  if (!loader) {
    throw new Error(`${project.id} note ${note.id} html module is not registered: ${note.path}`);
  }

  const html = await loader();
  if (note.html_mode === "fragment") {
    assertSafeHtmlFragment(project, note, html);
  }

  return {
    type: "html",
    html
  };
}

function assertSafeHtmlFragment(project: Project, note: ProjectNote, html: string): void {
  const blockedPatterns = [
    { pattern: /<\s*!doctype\b/i, label: "doctype" },
    { pattern: /<\s*html\b/i, label: "html" },
    { pattern: /<\s*head\b/i, label: "head" },
    { pattern: /<\s*body\b/i, label: "body" },
    { pattern: /<\s*script\b/i, label: "script" },
    { pattern: /<\s*link\b/i, label: "link" },
    { pattern: /<\s*meta\b/i, label: "meta" },
    { pattern: /\son[a-z]+\s*=/i, label: "inline event handler" },
    { pattern: /\sstyle\s*=/i, label: "inline style attribute" }
  ];

  for (const { pattern, label } of blockedPatterns) {
    if (pattern.test(html)) {
      throw new Error(`${project.id} note ${note.id} html fragment contains blocked ${label}: ${note.path}`);
    }
  }
}

export type CollectionDetail = {
  type: "markdown";
  Content: (_props: Record<string, unknown>) => unknown;
};

export async function loadCollectionDetail(collection: Collection): Promise<CollectionDetail | undefined> {
  if (!collection.details) {
    return undefined;
  }

  const key = `../../../catalog/collections/${collection.id}/${collection.details.path.replace("./", "")}`;
  const loader = collectionMarkdownModules[key];

  if (!loader) {
    throw new Error(`${collection.id} collection details module is not registered: ${collection.details.path}`);
  }

  const module = await loader();
  return {
    type: collection.details.type,
    Content: module.Content
  };
}
