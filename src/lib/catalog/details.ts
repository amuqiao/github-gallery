import type { ContentCollection, ContentItem, ContentNote } from "./content";

type MarkdownModule = {
  Content: (_props: Record<string, unknown>) => unknown;
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

function assertSafeHtmlFragment(
  item: ContentItem | ContentCollection,
  sourceLabel: string,
  html: string,
  sourcePath: string
): void {
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
