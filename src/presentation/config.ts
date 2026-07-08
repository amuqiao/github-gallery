import type { PresentationLayoutId, PresentationThemeId } from "@/presentation/types";

export const presentationConfig = {
  layoutId: "bento-editorial",
  themeId: "editorial-paper"
} as const satisfies {
  layoutId: PresentationLayoutId;
  themeId: PresentationThemeId;
};
