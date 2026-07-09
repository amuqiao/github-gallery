import type { Collection } from "./collections";
import type { ContentCollection, ContentItem, ContentNote } from "./content";
import type { ModelItem, ModelNote } from "./models";
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

const modelMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/models/*/details.md")
};

const modelNoteMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/models/*/notes/**/*.md")
};

const modelNoteHtmlModules = {
  ...import.meta.glob<string>("../../../catalog/models/*/notes/**/*.html", {
    import: "default",
    query: "?raw"
  })
};

const contentBodyMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/content/*/*/items/*/index.md"),
  ...import.meta.glob<MarkdownModule>("../../../catalog/content/*/*/collections/*/index.md")
};

const contentBodyHtmlModules = {
  ...import.meta.glob<string>("../../../catalog/content/*/*/items/*/index.html", {
    import: "default",
    query: "?raw"
  }),
  ...import.meta.glob<string>("../../../catalog/content/*/*/collections/*/index.html", {
    import: "default",
    query: "?raw"
  })
};

const contentNoteMarkdownModules = {
  ...import.meta.glob<MarkdownModule>("../../../catalog/content/*/*/items/*/notes/**/*.md")
};

const contentNoteHtmlModules = {
  ...import.meta.glob<string>("../../../catalog/content/*/*/items/*/notes/**/*.html", {
    import: "default",
    query: "?raw"
  })
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
    assertSafeHtmlFragment(project, `note ${note.id}`, html, note.path);
  }

  return {
    type: "html",
    html
  };
}

export type ModelDetail = {
  type: "markdown";
  Content: (_props: Record<string, unknown>) => unknown;
};

export async function loadModelDetail(model: ModelItem): Promise<ModelDetail | undefined> {
  if (!model.details) {
    return undefined;
  }

  const key = `../../../catalog/models/${model.id}/${model.details.path.replace("./", "")}`;
  const loader = modelMarkdownModules[key];

  if (!loader) {
    throw new Error(`${model.id} details module is not registered: ${model.details.path}`);
  }

  const module = await loader();
  return {
    type: model.details.type,
    Content: module.Content
  };
}

export type ModelNoteDetail =
  | {
      type: "markdown";
      Content: (_props: Record<string, unknown>) => unknown;
    }
  | {
      type: "html";
      html: string;
    };

export async function loadModelNote(model: ModelItem, note: ModelNote): Promise<ModelNoteDetail> {
  const key = `../../../catalog/models/${model.id}/${note.path.replace("./", "")}`;

  if (note.type === "markdown") {
    const loader = modelNoteMarkdownModules[key];

    if (!loader) {
      throw new Error(`${model.id} note ${note.id} markdown module is not registered: ${note.path}`);
    }

    const module = await loader();
    return {
      type: "markdown",
      Content: module.Content
    };
  }

  const loader = modelNoteHtmlModules[key];

  if (!loader) {
    throw new Error(`${model.id} note ${note.id} html module is not registered: ${note.path}`);
  }

  const html = await loader();
  if (note.html_mode === "fragment") {
    assertSafeHtmlFragment(model, `note ${note.id}`, html, note.path);
  }

  return {
    type: "html",
    html
  };
}

export type ContentBodyDetail =
  | {
      type: "markdown";
      Content: (_props: Record<string, unknown>) => unknown;
    }
  | {
      type: "html";
      html: string;
    };

export async function loadContentItemBody(item: ContentItem): Promise<ContentBodyDetail> {
  return loadContentBody(item, "items", item.body);
}

export async function loadContentCollectionBody(collection: ContentCollection): Promise<ContentBodyDetail> {
  return loadContentBody(collection, "collections", collection.body);
}

async function loadContentBody(
  content: ContentItem | ContentCollection,
  contentKindDirectory: "items" | "collections",
  body: ContentItem["body"] | ContentCollection["body"]
): Promise<ContentBodyDetail> {
  const key = `../../../catalog/content/${content.publicationState}/${content.hall}/${contentKindDirectory}/${content.id}/${body.path.replace("./", "")}`;

  if (body.type === "markdown") {
    const loader = contentBodyMarkdownModules[key];

    if (!loader) {
      throw new Error(`${content.hall}/${content.id} content body markdown module is not registered: ${body.path}`);
    }

    const module = await loader();
    return {
      type: "markdown",
      Content: module.Content
    };
  }

  const loader = contentBodyHtmlModules[key];

  if (!loader) {
    throw new Error(`${content.hall}/${content.id} content body html module is not registered: ${body.path}`);
  }

  const html = await loader();
  assertSafeHtmlFragment(content, "body", html, body.path);
  return {
    type: "html",
    html
  };
}

export type ContentNoteDetail =
  | {
      type: "markdown";
      Content: (_props: Record<string, unknown>) => unknown;
    }
  | {
      type: "html";
      html: string;
    };

export async function loadContentNote(item: ContentItem, note: ContentNote): Promise<ContentNoteDetail> {
  const key = `../../../catalog/content/${item.publicationState}/${item.hall}/items/${item.id}/${note.path.replace("./", "")}`;

  if (note.type === "markdown") {
    const loader = contentNoteMarkdownModules[key];

    if (!loader) {
      throw new Error(`${item.hall}/${item.id} note ${note.id} markdown module is not registered: ${note.path}`);
    }

    const module = await loader();
    return {
      type: "markdown",
      Content: module.Content
    };
  }

  const loader = contentNoteHtmlModules[key];

  if (!loader) {
    throw new Error(`${item.hall}/${item.id} note ${note.id} html module is not registered: ${note.path}`);
  }

  const html = await loader();
  if (note.html_mode === "fragment") {
    assertSafeHtmlFragment(item, `note ${note.id}`, html, note.path);
  }

  return {
    type: "html",
    html
  };
}

function assertSafeHtmlFragment(item: Project | ModelItem | ContentItem | ContentCollection, sourceLabel: string, html: string, sourcePath: string): void {
  const blockedPatterns = [
    { pattern: /<\s*!doctype\b/i, label: "doctype" },
    { pattern: /<\s*html\b/i, label: "html" },
    { pattern: /<\s*head\b/i, label: "head" },
    { pattern: /<\s*body\b/i, label: "body" },
    { pattern: /<\s*script\b/i, label: "script" },
    { pattern: /<\s*style\b/i, label: "style" },
    { pattern: /<\s*link\b/i, label: "link" },
    { pattern: /<\s*meta\b/i, label: "meta" },
    { pattern: /\son[a-z]+\s*=/i, label: "inline event handler" },
    { pattern: /\sstyle\s*=/i, label: "inline style attribute" }
  ];

  for (const { pattern, label } of blockedPatterns) {
    if (pattern.test(html)) {
      throw new Error(`${item.id} ${sourceLabel} html fragment contains blocked ${label}: ${sourcePath}`);
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
