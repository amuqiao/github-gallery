import type { ProjectBlock } from "./catalog-types";

export type AdaptedProjectBlock = ProjectBlock & {
  title: string;
};

type BlockAdapter<T extends ProjectBlock> = (block: T) => AdaptedProjectBlock;

const blockAdapters = {
  links: (block) => ({
    ...block,
    title: block.title ?? "链接"
  }),
  highlights: (block) => ({
    ...block,
    title: block.title ?? "亮点"
  }),
  "use-cases": (block) => ({
    ...block,
    title: block.title ?? "使用场景"
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
