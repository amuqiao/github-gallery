#!/usr/bin/env node
import process from "node:process";
import { readValidatedContentCatalog } from "../../src/lib/catalog/content-validator.js";

function event(action, id, detail = "") {
  console.log(`${action.padEnd(9)} ${id.padEnd(16)} ${detail}`);
}

async function main() {
  const { itemConfigs, collectionConfigs } = await readValidatedContentCatalog();
  const publishedItems = itemConfigs.filter((item) => item.publicationState === "published");
  const publishedCollections = collectionConfigs.filter((collection) => collection.publicationState === "published");

  event("RELEASE", "items", `${publishedItems.length} published`);
  event("RELEASE", "collections", `${publishedCollections.length} published`);
  event("RELEASE", "gate", "passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? `ERROR: ${error.message}` : error);
  process.exit(1);
});
