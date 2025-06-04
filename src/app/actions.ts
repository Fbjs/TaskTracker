
"use server";

import { suggestTasks as genkitSuggestTasks, type SuggestTasksInput, type SuggestTasksOutput } from "@/ai/flows/suggest-tasks";
import type { Objective, Task, TaskStatus, User, Workspace, AISuggestions } from "@/types";
import { revalidatePath } from "next/cache";

// Dummy data stores (in a real app, this would be a database)
let usersStore: User[] = [];
let workspacesStore: Workspace[] = [];
let objectivesStore: Objective[] = [];

let nextUserId = 1;
let nextWorkspaceId = 1;
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

// Mock function to get or create a user (replace with real auth in production)
async function getOrCreateUser(email: string): Promise<User> {
  let user = usersStore.find(u => u.email === email);
  if (!user) {
    user = { id: `user-${nextUserId++}`, email };
    usersStore.push(user);
  }
  return user;
}

export async function getInitialData(userId?: string): Promise<{ objectives: Objective[]; workspaces: Workspace[] }> {
  // In a real app, filter by userId and workspace memberships
  // For now, return all objectives and workspaces "owned" by the user or all if no userId.
  // This is highly simplified.
  
  if (workspacesStore.length === 0 && userId) {
    // Create a default workspace for a new user
     const defaultWorkspace: Workspace = {
      id: `ws-${nextWorkspaceId++}`,
      name: "My First Workspace",
      ownerId: userId,
    };
    workspacesStore.push(defaultWorkspace);
  }

  const userWorkspaces = userId ? workspacesStore.filter(ws => ws.ownerId === userId) : [...workspacesStore];
  // For this mock, objectives are not strictly filtered by workspace on initial load,
  // the client side will do that.
  return { 
    objectives: JSON.parse(JSON.stringify(objectivesStore.map(processObjective))),
    workspaces: JSON.parse(JSON.stringify(userWorkspaces))
  };
}

export async function createWorkspaceAction(name: string, ownerId: string): Promise<Workspace | { error: string }> {
  if (!name.trim()) {
    return { error: "Workspace name cannot be empty." };
  }
  const newWorkspace: Workspace = {
    id: `ws-${nextWorkspaceId++}`,
    name,
    ownerId,
  };
  workspacesStore.push(newWorkspace);
  revalidatePath("/");
  return JSON.parse(JSON.stringify(newWorkspace));
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

export async function addObjectiveAction(
  description: string, 
  tasksData: { description: string; assignee?: string }[],
  userId?: string, // Added userId
  workspaceId?: string // Added workspaceId
): Promise<Objective> {
  const newObjectiveId = `obj-${nextObjectiveId++}`;
  const newTasks: Task[] = tasksData.map(taskData => ({
    id: `task-${nextTaskId++}`,
    objectiveId: newObjectiveId,
    description: taskData.description,
    status: "To Do",
    priority: "Medium",
    createdAt: new Date(),
    assignee: taskData.assignee || undefined,
  }));

  const newObjective: Objective = {
    id: newObjectiveId,
    description,
    tasks: newTasks,
    userId,
    workspaceId,
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
