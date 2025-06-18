
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export const ALL_TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];

export type TaskPriority = "Low" | "Medium" | "High";
export const ALL_TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

export type ObjectivePriority = "Low" | "Medium" | "High";
export const ALL_OBJECTIVE_PRIORITIES: ObjectivePriority[] = ["Low", "Medium", "High"];

export interface User {
  id: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  assigneeId?: string;
  assignee?: Pick<User, 'id' | 'email'>;
  objectiveId: string;
}

export interface Objective {
  id: string;
  description: string;
  tasks: Task[];
  userId?: string;
  workspaceId?: string;
  priority: ObjectivePriority; // Nuevo campo
  isArchived: boolean; // Se añade aquí para la siguiente etapa, pero se inicializará
  createdAt: Date; // Asegurar que createdAt esté aquí para la ordenación
}

export interface SuggestedTask {
  taskDescription: string;
  assignee: string;
}

export interface AISuggestions {
  objectiveDescription: string;
  tasks: SuggestedTask[];
}

export interface GanttTask extends Task {
  name: string;
  start: Date;
  end: Date;
  progress?: number;
}
