import { presentationConfig } from "@/presentation/config";
import { presentationLayouts } from "@/presentation/layouts";
import { presentationThemes } from "@/presentation/themes";

export function getActivePresentation() {
  return {
    config: presentationConfig,
    layout: presentationLayouts[presentationConfig.layoutId],
    theme: presentationThemes[presentationConfig.themeId]
  };
}
