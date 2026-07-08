import type { Project } from "./projects";

const projectStatusLabels: Record<Project["status"], string> = {
  active: "活跃",
  inactive: "不活跃",
  archived: "已归档",
  unknown: "未知"
};

export function getProjectStatusLabel(status: Project["status"]): string {
  return projectStatusLabels[status];
}
