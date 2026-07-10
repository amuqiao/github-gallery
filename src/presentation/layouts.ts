import type { PresentationLayout, PresentationLayoutId } from "@/presentation/types";

export const presentationLayouts: Record<PresentationLayoutId, PresentationLayout> = {
  "bento-editorial": {
    id: "bento-editorial",
    label: "Bento Editorial",
    description: "Hub-first editorial layout for the platform home and hall pages."
  }
};
