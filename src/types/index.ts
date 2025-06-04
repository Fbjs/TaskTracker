export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export const ALL_TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];

export type TaskPriority = "Low" | "Medium" | "High";
export const ALL_TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  createdAt: Date;
  assignee?: string;
  objectiveId: string;
}

export interface Objective {
  id: string;
  description: string;
  tasks: Task[];
  // progress will be calculated dynamically
}

// For AI suggestions
export interface SuggestedTask {
  taskDescription: string;
  assignee: string;
}

export interface AISuggestions {
  objectiveDescription: string;
  tasks: SuggestedTask[];
}

export interface GanttTask extends Task {
  name: string; // Task description
  start: Date;
  end: Date;
  progress?: number; // Task progress for Gantt, if needed
}
