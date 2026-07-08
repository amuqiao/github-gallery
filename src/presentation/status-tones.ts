export type ProjectStatusTone = "success" | "warning" | "muted" | "neutral";

const projectStatusTones = {
  active: "success",
  inactive: "warning",
  archived: "muted",
  unknown: "neutral"
} satisfies Record<string, ProjectStatusTone>;

export function getProjectStatusTone(statusId: string): ProjectStatusTone {
  const tone = projectStatusTones[statusId as keyof typeof projectStatusTones];

  if (!tone) {
    throw new Error(`Missing presentation tone for project status: ${statusId}`);
  }

  return tone;
}
