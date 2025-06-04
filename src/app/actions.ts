// src/app/actions.ts
"use server";

import { suggestTasks as genkitSuggestTasks, type SuggestTasksInput, type SuggestTasksOutput } from "@/ai/flows/suggest-tasks";
import type { Objective, Task, TaskStatus, TaskPriority, AISuggestions, ALL_TASK_PRIORITIES, ALL_TASK_STATUSES } from "@/types";
import { revalidatePath } from "next/cache";

// Dummy data store (in a real app, this would be a database)
let objectivesStore: Objective[] = [];
let nextObjectiveId = 1;
let nextTaskId = 1;

// Helper to ensure dates are Date objects
function processObjective(obj: Objective): Objective {
  return {
    ...obj,
    tasks: obj.tasks.map(task => ({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      createdAt: new Date(task.createdAt),
    })),
  };
}


export async function getInitialData(): Promise<{ objectives: Objective[] }> {
  if (objectivesStore.length === 0) {
    const mockObjectives: Objective[] = [
      {
        id: `obj-${nextObjectiveId++}`,
        description: "Launch New Marketing Campaign",
        tasks: [
          { id: `task-${nextTaskId++}`, objectiveId: `obj-1`, description: "Define campaign goals and KPIs", status: "Done", priority: "High", dueDate: new Date("2024-08-10"), createdAt: new Date("2024-07-01"), assignee: "Alice" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-1`, description: "Develop creative assets", status: "In Progress", priority: "High", dueDate: new Date("2024-08-20"), createdAt: new Date("2024-07-10"), assignee: "Bob" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-1`, description: "Plan media buy", status: "To Do", priority: "Medium", dueDate: new Date("2024-08-25"), createdAt: new Date("2024-07-15"), assignee: "Charlie" },
        ],
      },
      {
        id: `obj-${nextObjectiveId++}`,
        description: "Develop Q4 Product Roadmap",
        tasks: [
          { id: `task-${nextTaskId++}`, objectiveId: `obj-2`, description: "Gather stakeholder feedback", status: "In Progress", priority: "High", createdAt: new Date("2024-07-05"), assignee: "Diana" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-2`, description: "Analyze market trends", status: "To Do", priority: "Medium", dueDate: new Date("2024-09-15"), createdAt: new Date("2024-07-20"), assignee: "Eve" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-2`, description: "Draft initial roadmap", status: "Blocked", priority: "High", dueDate: new Date("2024-09-30"), createdAt: new Date("2024-07-25"), assignee: "Frank" },
        ],
      },
    ];
    objectivesStore = mockObjectives.map(processObjective);
  }
  return { objectives: JSON.parse(JSON.stringify(objectivesStore.map(processObjective))) };
}

export async function handleSuggestTasks(objectivePrompt: string): Promise<AISuggestions | { error: string }> {
  try {
    const input: SuggestTasksInput = { objectivePrompt };
    const result: SuggestTasksOutput = await genkitSuggestTasks(input);
    return result;
  } catch (error) {
    console.error("Error calling AI suggestion flow:", error);
    return { error: "Failed to get AI suggestions. Please try again." };
  }
}

export async function addObjectiveAction(description: string, tasksData: { description: string; assignee?: string }[]): Promise<Objective> {
  const newObjectiveId = `obj-${nextObjectiveId++}`;
  const newTasks: Task[] = tasksData.map(taskData => ({
    id: `task-${nextTaskId++}`,
    objectiveId: newObjectiveId,
    description: taskData.description,
    status: "To Do",
    priority: "Medium", // Default priority
    createdAt: new Date(),
    assignee: taskData.assignee || undefined,
  }));

  const newObjective: Objective = {
    id: newObjectiveId,
    description,
    tasks: newTasks,
  };
  objectivesStore.push(newObjective);
  revalidatePath("/");
  return JSON.parse(JSON.stringify(processObjective(newObjective)));
}

export async function updateObjectiveAction(objectiveId: string, newDescription: string): Promise<Objective | { error: string }> {
  const objective = objectivesStore.find(obj => obj.id === objectiveId);
  if (!objective) {
    return { error: "Objective not found." };
  }
  objective.description = newDescription;
  revalidatePath("/");
  return JSON.parse(JSON.stringify(processObjective(objective)));
}


export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus, objectiveId: string): Promise<{success: boolean}> {
  const objective = objectivesStore.find(obj => obj.id === objectiveId);
  if (objective) {
    const task = objective.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = newStatus;
      revalidatePath("/");
      return { success: true };
    }
  }
  return { success: false };
}

export async function updateTaskAction(
  taskId: string, 
  objectiveId: string, 
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt'>>
): Promise<Task | { error: string }> {
  const objective = objectivesStore.find(obj => obj.id === objectiveId);
  if (!objective) {
    return { error: "Objective not found." };
  }
  const taskIndex = objective.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return { error: "Task not found." };
  }
  
  const oldTask = objective.tasks[taskIndex];
  const updatedTask: Task = {
    ...oldTask,
    ...updates,
    description: updates.description ?? oldTask.description,
    status: updates.status ?? oldTask.status,
    priority: updates.priority ?? oldTask.priority,
    dueDate: updates.dueDate !== undefined ? (updates.dueDate ? new Date(updates.dueDate) : undefined) : oldTask.dueDate,
    assignee: updates.assignee !== undefined ? updates.assignee : oldTask.assignee,
  };
  
  objective.tasks[taskIndex] = updatedTask;
  revalidatePath("/");
  return JSON.parse(JSON.stringify({
    ...updatedTask,
    dueDate: updatedTask.dueDate?.toISOString(),
    createdAt: updatedTask.createdAt.toISOString(),
  }));
}
