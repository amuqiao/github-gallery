import { getPublishedSearchEntries } from "@/lib/catalog/search";

export async function GET() {
  const entries = await getPublishedSearchEntries();

  return new Response(JSON.stringify(entries), {
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
