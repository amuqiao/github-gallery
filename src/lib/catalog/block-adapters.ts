import type { ProjectBlock } from "./project-schema";

export type AdaptedProjectBlock = ProjectBlock & {
  title: string;
};

type BlockAdapter<T extends ProjectBlock> = (block: T) => AdaptedProjectBlock;

const blockAdapters = {
  links: (block) => ({
    ...block,
    title: block.title ?? "Links"
  }),
  highlights: (block) => ({
    ...block,
    title: block.title ?? "Highlights"
  }),
  "use-cases": (block) => ({
    ...block,
    title: block.title ?? "Use Cases"
  })
} satisfies {
  [Type in ProjectBlock["type"]]: BlockAdapter<Extract<ProjectBlock, { type: Type }>>;
};

export function adaptProjectBlocks(blocks: ProjectBlock[] = []): AdaptedProjectBlock[] {
  return blocks.map((block) => adaptProjectBlock(block));
}

function adaptProjectBlock(block: ProjectBlock): AdaptedProjectBlock {
  switch (block.type) {
    case "links":
      return blockAdapters.links(block);
    case "highlights":
      return blockAdapters.highlights(block);
    case "use-cases":
      return blockAdapters["use-cases"](block);
    default:
      return assertNever(block);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported project block type: ${JSON.stringify(value)}`);
}
