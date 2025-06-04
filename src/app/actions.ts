// src/app/actions.ts
"use server";

import { suggestTasks as genkitSuggestTasks, type SuggestTasksInput, type SuggestTasksOutput } from "@/ai/flows/suggest-tasks";
import type { Objective, Task, TaskStatus, AISuggestions } from "@/types";
import { revalidatePath } from "next/cache";

// Dummy data store (in a real app, this would be a database)
let objectivesStore: Objective[] = [];
let nextObjectiveId = 1;
let nextTaskId = 1;

export async function getInitialData(): Promise<{ objectives: Objective[] }> {
  // Simulate fetching initial data
  if (objectivesStore.length === 0) {
     // Create some mock data if store is empty
    const mockObjectives: Objective[] = [
      {
        id: `obj-${nextObjectiveId++}`,
        description: "Launch New Marketing Campaign",
        tasks: [
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Define campaign goals and KPIs", status: "Done", priority: "High", dueDate: new Date("2024-08-10"), createdAt: new Date("2024-07-01"), assignee: "Alice" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Develop creative assets", status: "In Progress", priority: "High", dueDate: new Date("2024-08-20"), createdAt: new Date("2024-07-10"), assignee: "Bob" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Plan media buy", status: "To Do", priority: "Medium", dueDate: new Date("2024-08-25"), createdAt: new Date("2024-07-15"), assignee: "Charlie" },
        ],
      },
      {
        id: `obj-${nextObjectiveId++}`,
        description: "Develop Q4 Product Roadmap",
        tasks: [
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Gather stakeholder feedback", status: "In Progress", priority: "High", createdAt: new Date("2024-07-05"), assignee: "Diana" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Analyze market trends", status: "To Do", priority: "Medium", dueDate: new Date("2024-09-15"), createdAt: new Date("2024-07-20"), assignee: "Eve" },
          { id: `task-${nextTaskId++}`, objectiveId: `obj-${nextObjectiveId-1}`, description: "Draft initial roadmap", status: "Blocked", priority: "High", dueDate: new Date("2024-09-30"), createdAt: new Date("2024-07-25"), assignee: "Frank" },
        ],
      },
    ];
    objectivesStore = mockObjectives;
  }
  return { objectives: JSON.parse(JSON.stringify(objectivesStore)) }; // Deep copy for safety
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
    priority: "Medium",
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
  return JSON.parse(JSON.stringify(newObjective));
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

// Add more CRUD actions as needed (updateObjective, deleteTask, etc.)
// For brevity, these are simplified. A real app would need robust error handling and data validation.
