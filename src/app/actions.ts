
"use server";

import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/dbConnect";
import UserCollection from "@/models/User"; // Renamed import for clarity if User is also a type
import WorkspaceCollection from "@/models/Workspace"; // Renamed import
import ObjectiveCollection from "@/models/Objective"; // Renamed import
import TaskCollection from "@/models/Task"; // Renamed import
import type { Objective, Task, TaskStatus, User, Workspace, AISuggestions } from "@/types";
import type { ITask } from "@/models/Task";
import type { IObjective } from "@/models/Objective";
import type { IWorkspace } from "@/models/Workspace";
import { suggestTasks as genkitSuggestTasks, type SuggestTasksInput, type SuggestTasksOutput } from "@/ai/flows/suggest-tasks";

// Helper to convert Mongoose document to a plain object compatible with frontend types
// Handles _id -> id conversion and ensures dates are Date objects
function serializeDocument<T extends { _id: any, createdAt?: any, updatedAt?: any }>(doc: any): T {
  if (!doc) return null as unknown as T;
  const plainObject = doc.toObject ? doc.toObject({ getters: true, versionKey: false }) : { ...doc };

  plainObject.id = plainObject._id?.toString();
  delete plainObject._id;

  // Ensure dates are Date objects if they are not already
  if (plainObject.createdAt && typeof plainObject.createdAt === 'string') {
    plainObject.createdAt = new Date(plainObject.createdAt);
  }
  if (plainObject.updatedAt && typeof plainObject.updatedAt === 'string') {
    plainObject.updatedAt = new Date(plainObject.updatedAt);
  }
  if (plainObject.dueDate && typeof plainObject.dueDate === 'string') {
    plainObject.dueDate = new Date(plainObject.dueDate);
  }

  if (plainObject.tasks && Array.isArray(plainObject.tasks)) {
    plainObject.tasks = plainObject.tasks.map((task: any) => serializeDocument<Task>(task));
  }

  return plainObject as T;
}


export async function getInitialData(userId?: string): Promise<{ objectives: Objective[]; workspaces: Workspace[] }> {
  await dbConnect();

  if (!userId) {
    // For unauthenticated users or scenarios where userId is not critical for initial view,
    // though ideally, data should always be scoped.
    return { objectives: [], workspaces: [] };
  }

  let userWorkspaces: Workspace[] = [];
  try {
    const userWorkspacesDocs = await WorkspaceCollection.find({ ownerId: userId }).lean();
    userWorkspaces = userWorkspacesDocs.map(doc => serializeDocument<Workspace>(doc));

    if (userWorkspaces.length === 0) {
      // Create a default workspace for a new user if they have none
      const defaultWorkspaceData: Omit<IWorkspace, '_id' | 'createdAt' | 'updatedAt' | 'memberIds'> & { ownerId: string } = {
        name: "My First Workspace",
        ownerId: userId,
      };
      const newWsDoc = await WorkspaceCollection.create(defaultWorkspaceData);
      const createdWorkspace = serializeDocument<Workspace>(newWsDoc);
      userWorkspaces.push(createdWorkspace);
    }
  } catch (error) {
    console.error("Error fetching or creating workspaces:", error);
    // Depending on recovery strategy, might return empty or throw
    return { objectives: [], workspaces: [] };
  }

  let objectives: Objective[] = [];
  if (userWorkspaces.length > 0) {
    // Fetch objectives for all workspaces owned by the user
    // This could be refined to fetch only for a "current" workspace if that logic is added
    const workspaceIds = userWorkspaces.map(ws => ws.id);
    try {
      const objectivesDocs = await ObjectiveCollection.find({ workspaceId: { $in: workspaceIds } })
        .populate<{ tasks: ITask[] }>('tasks') // Populate tasks
        .lean(); // Use lean for performance and to get plain JS objects

      // Serialize objectives and their populated tasks
      objectives = objectivesDocs.map(objDoc => {
        const serializedObj = serializeDocument<Objective>(objDoc);
        // Ensure tasks within the objective are also serialized correctly
        if (serializedObj.tasks && Array.isArray(serializedObj.tasks)) {
           // tasks from .lean().populate() are already plain objects, but _id needs mapping
           serializedObj.tasks = objDoc.tasks.map(taskDoc => ({
            ...taskDoc,
            id: taskDoc._id.toString(),
            _id: undefined, // remove _id
            // Ensure Date objects
            createdAt: taskDoc.createdAt ? new Date(taskDoc.createdAt) : new Date(),
            dueDate: taskDoc.dueDate ? new Date(taskDoc.dueDate) : undefined,
          }));
        }
        return serializedObj;
      });

    } catch (error) {
      console.error("Error fetching objectives:", error);
    }
  }
  
  return { objectives, workspaces: userWorkspaces };
}

export async function createWorkspaceAction(name: string, ownerId: string): Promise<Workspace | { error: string }> {
  await dbConnect();
  if (!name.trim()) {
    return { error: "Workspace name cannot be empty." };
  }
  if (!ownerId) {
    return { error: "Owner ID is required to create a workspace."}
  }

  try {
    // Check if user exists (optional, depends on how strict you want to be)
    // const owner = await UserCollection.findById(ownerId);
    // if (!owner) return { error: "Owner user not found." };

    const newWorkspaceDoc = await WorkspaceCollection.create({ name, ownerId });
    revalidatePath("/");
    return serializeDocument<Workspace>(newWorkspaceDoc);
  } catch (error: any) {
    console.error("Error creating workspace:", error);
    if (error.code === 11000) { // Duplicate key error
      return { error: "A workspace with this name might already exist for the user or other unique constraint violation." };
    }
    return { error: "Failed to create workspace. " + error.message };
  }
}

export async function handleSuggestTasks(objectivePrompt: string): Promise<AISuggestions | { error: string }> {
  try {
    const input: SuggestTasksInput = { objectivePrompt };
    const result: SuggestTasksOutput = await genkitSuggestTasks(input);
    return result; // This function does not interact with DB directly, it calls AI.
  } catch (error) {
    console.error("Error calling AI suggestion flow:", error);
    return { error: "Failed to get AI suggestions. Please try again." };
  }
}

export async function addObjectiveAction(
  description: string,
  tasksData: { description: string; assignee?: string }[],
  userId?: string,
  workspaceId?: string
): Promise<Objective | { error: string }> {
  await dbConnect();

  if (!userId || !workspaceId) {
    return { error: "User ID and Workspace ID are required to create an objective." };
  }
  if (!description.trim()) {
    return { error: "Objective description cannot be empty." };
  }

  try {
    const taskDocsToCreate = tasksData
      .filter(td => td.description.trim() !== "")
      .map(taskData => ({
        description: taskData.description,
        assignee: taskData.assignee || undefined,
        status: "To Do" as TaskStatus,
        priority: "Medium" as TaskPriority,
        // objectiveId will be set once objective is created, or use a temporary one if your schema requires it.
        // For now, tasks are created first, then their IDs are added to objective.
        // This means tasks won't have objectiveId initially if created in a batch like this and then linked.
        // A better approach: create Objective, then create Tasks with that Objective's ID.
        // Let's adjust to create Objective first, then Tasks.
      }));

    // Create Objective first
    const newObjectiveDoc = await ObjectiveCollection.create({
      description,
      userId,
      workspaceId,
      tasks: [] // Start with empty tasks array
    });

    const createdTaskIds: string[] = [];
    if (taskDocsToCreate.length > 0) {
        const tasksToInsert = taskDocsToCreate.map(taskInput => ({
            ...taskInput,
            objectiveId: newObjectiveDoc._id, // Link to the newly created objective
            createdAt: new Date(), // Mongoose timestamps will handle this but explicit for type
        }));
        const createdTasks = await TaskCollection.insertMany(tasksToInsert);
        createdTaskIds.push(...createdTasks.map(taskDoc => taskDoc._id.toString()));

        // Update the objective with the IDs of the created tasks
        newObjectiveDoc.tasks = createdTasks.map(t => t._id);
        await newObjectiveDoc.save();
    }
    
    // Populate tasks for the returned objective
    const populatedObjectiveDoc = await ObjectiveCollection.findById(newObjectiveDoc._id)
      .populate<{ tasks: ITask[] }>('tasks')
      .exec();

    revalidatePath("/");
    if (!populatedObjectiveDoc) {
        // Should not happen if creation was successful
        return { error: "Failed to retrieve the newly created objective with tasks."};
    }
    return serializeDocument<Objective>(populatedObjectiveDoc);

  } catch (error: any) {
    console.error("Error adding objective:", error);
    return { error: "Failed to add objective. " + error.message };
  }
}

export async function updateObjectiveAction(objectiveId: string, newDescription: string): Promise<Objective | { error: string }> {
  await dbConnect();
  if (!objectiveId) return { error: "Objective ID is required." };
  if (!newDescription.trim()) return { error: "Objective description cannot be empty." };

  try {
    const updatedObjectiveDoc = await ObjectiveCollection.findByIdAndUpdate(
      objectiveId,
      { description: newDescription },
      { new: true, runValidators: true }
    ).populate<{ tasks: ITask[] }>('tasks');

    if (!updatedObjectiveDoc) {
      return { error: "Objective not found." };
    }
    revalidatePath("/");
    return serializeDocument<Objective>(updatedObjectiveDoc);
  } catch (error: any) {
    console.error("Error updating objective:", error);
    return { error: "Failed to update objective. " + error.message };
  }
}

export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus, objectiveId: string): Promise<{success: boolean, task?: Task} | {success: boolean, error?: string}> {
  await dbConnect();
  if (!taskId) return { success: false, error: "Task ID is required." };

  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      { status: newStatus },
      { new: true, runValidators: true }
    );

    if (!updatedTaskDoc) {
      return { success: false, error: "Task not found." };
    }
    revalidatePath("/");
    // We might need to revalidate the specific objective's path if using dynamic paths
    // For now, revalidatePath("/") covers it.
    return { success: true, task: serializeDocument<Task>(updatedTaskDoc) };
  } catch (error: any) {
    console.error("Error updating task status:", error);
    return { success: false, error: "Failed to update task status. " + error.message };
  }
}

export async function updateTaskAction(
  taskId: string,
  objectiveId: string, // objectiveId might not be directly used if taskId is globally unique
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt'>>
): Promise<Task | { error: string }> {
  await dbConnect();
  if (!taskId) return { error: "Task ID is required." };

  // Sanitize updates: remove objectiveId if present as it shouldn't be changed here
  const { objectiveId: _, ...validUpdates } = updates;
  
  // Ensure dueDate is correctly formatted if provided
  if (validUpdates.dueDate === null) { // Explicitly set to null if clearing
    validUpdates.dueDate = undefined;
  } else if (validUpdates.dueDate) {
    validUpdates.dueDate = new Date(validUpdates.dueDate);
  }


  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      validUpdates,
      { new: true, runValidators: true }
    );

    if (!updatedTaskDoc) {
      return { error: "Task not found." };
    }
    revalidatePath("/");
    return serializeDocument<Task>(updatedTaskDoc);
  } catch (error: any) {
    console.error("Error updating task:", error);
    return { error: "Failed to update task. " + error.message };
  }
}

    