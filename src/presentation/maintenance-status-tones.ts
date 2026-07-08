export type ProjectMaintenanceStatusTone = "success" | "warning" | "muted" | "neutral";

const projectMaintenanceStatusTones = {
  active: "success",
  inactive: "warning",
  archived: "muted",
  unknown: "neutral"
} satisfies Record<string, ProjectMaintenanceStatusTone>;

export function getProjectMaintenanceStatusTone(maintenanceStatusId: string): ProjectMaintenanceStatusTone {
  const tone = projectMaintenanceStatusTones[maintenanceStatusId as keyof typeof projectMaintenanceStatusTones];

  if (!tone) {
    throw new Error(`Missing presentation tone for project maintenance status: ${maintenanceStatusId}`);
  }

  return tone;
}
