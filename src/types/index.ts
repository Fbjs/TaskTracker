
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export const ALL_TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];

export type TaskPriority = "Low" | "Medium" | "High";
export const ALL_TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

export interface User {
  id: string;
  email: string;
  // Add other user fields if needed, e.g., name
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[]; // Changed: made non-optional
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  createdAt: Date;
  assigneeId?: string; // ID of the assigned user
  assignee?: Pick<User, 'id' | 'email'>; // Populated assignee details for display
  objectiveId: string;
}

export interface Objective {
  id: string;
  description: string;
  tasks: Task[];
  userId?: string; // ID of the user who created it (likely owner of workspace)
  workspaceId?: string; // ID of the workspace it belongs to
}

export interface SuggestedTask {
  taskDescription: string;
  assignee: string; // This might need to become assigneeEmail or similar if AI suggests emails
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
