export type PresentationThemeId = "editorial-paper";
export type PresentationLayoutId = "bento-editorial";

export interface PresentationTheme {
  id: PresentationThemeId;
  label: string;
  description: string;
}

export interface PresentationLayout {
  id: PresentationLayoutId;
  label: string;
  description: string;
}
