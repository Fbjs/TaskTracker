
"use server";

import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/dbConnect";
import UserCollection from "@/models/User"; 
import WorkspaceCollection from "@/models/Workspace"; 
import ObjectiveCollection from "@/models/Objective"; 
import TaskCollection from "@/models/Task"; 
import type { Objective, Task, TaskStatus, User, Workspace, AISuggestions, TaskPriority } from "@/types";
import type { ITask } from "@/models/Task";
import type { IObjective } from "@/models/Objective";
import type { IWorkspace } from "@/models/Workspace";
import type { IUser } from "@/models/User";
import { suggestTasks as genkitSuggestTasks, type SuggestTasksInput, type SuggestTasksOutput } from "@/ai/flows/suggest-tasks";
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Helper to convert Mongoose document to a plain object compatible with frontend types
// Handles _id -> id conversion and ensures dates are Date objects
// Excludes password field for User objects
function serializeDocument<T extends { _id: any, createdAt?: any, updatedAt?: any, password?: string }>(doc: any): Omit<T, 'password'> {
  if (!doc) return null as unknown as Omit<T, 'password'>;
  const plainObject = doc.toObject ? doc.toObject({ getters: true, versionKey: false }) : { ...doc };

  plainObject.id = plainObject._id?.toString();
  delete plainObject._id;
  delete plainObject.password; // Ensure password is not sent to client

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

  return plainObject as Omit<T, 'password'>;
}

export async function registerUserAction(email: string, passwordPlain: string): Promise<User | { error: string }> {
  await dbConnect();
  try {
    const existingUser = await UserCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return { error: "User with this email already exists." };
    }

    if (passwordPlain.length < 6) {
      return { error: "Password must be at least 6 characters long."};
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
    const newUserDoc = await UserCollection.create({ email: email.toLowerCase(), password: hashedPassword });
    
    return serializeDocument<IUser>(newUserDoc) as User;
  } catch (error: any) {
    console.error("Error registering user:", error);
    if (error.code === 11000) { // Duplicate key error
        return { error: "User with this email already exists." };
    }
    return { error: "Failed to register user. " + (error.message || "Please try again.") };
  }
}

export async function loginUserAction(email: string, passwordPlain: string): Promise<User | { error: string }> {
  await dbConnect();
  try {
    const userDoc = await UserCollection.findOne({ email: email.toLowerCase() });
    if (!userDoc || !userDoc.password) {
      return { error: "Invalid email or password." };
    }

    const isMatch = await bcrypt.compare(passwordPlain, userDoc.password);
    if (!isMatch) {
      return { error: "Invalid email or password." };
    }
    
    return serializeDocument<IUser>(userDoc) as User;
  } catch (error: any) {
    console.error("Error logging in user:", error);
    return { error: "Failed to log in. " + (error.message || "Please try again.") };
  }
}


export async function getInitialData(userId?: string): Promise<{ objectives: Objective[]; workspaces: Workspace[] }> {
  await dbConnect();

  if (!userId) {
    return { objectives: [], workspaces: [] };
  }

  let userWorkspaces: Workspace[] = [];
  try {
    const userWorkspacesDocs = await WorkspaceCollection.find({ ownerId: userId }).lean(); // lean for plain objects
    userWorkspaces = userWorkspacesDocs.map(doc => ({
        ...doc,
        id: doc._id.toString(),
        _id: undefined, // remove _id
        ownerId: doc.ownerId.toString(), // ensure ownerId is string
    }));


    if (userWorkspaces.length === 0) {
      const defaultWorkspaceData: Omit<IWorkspace, '_id' | 'createdAt' | 'updatedAt' | 'memberIds'> & { ownerId: string } = {
        name: "My First Workspace",
        ownerId: userId,
      };
      const newWsDoc = await WorkspaceCollection.create(defaultWorkspaceData);
      const createdWorkspace = serializeDocument<IWorkspace>(newWsDoc) as Workspace; // cast to Workspace after serialization
      userWorkspaces.push(createdWorkspace);
    }
  } catch (error) {
    console.error("Error fetching or creating workspaces:", error);
    return { objectives: [], workspaces: [] };
  }

  let objectives: Objective[] = [];
  if (userWorkspaces.length > 0) {
    const workspaceIds = userWorkspaces.map(ws => ws.id);
    try {
      const objectivesDocs = await ObjectiveCollection.find({ workspaceId: { $in: workspaceIds } })
        .populate<{ tasks: ITask[] }>('tasks') 
        .lean(); 

      objectives = objectivesDocs.map(objDoc => {
        const serializedObj = {
            ...objDoc,
            id: objDoc._id.toString(),
            _id: undefined,
            userId: objDoc.userId?.toString(),
            workspaceId: objDoc.workspaceId?.toString(),
            tasks: objDoc.tasks ? objDoc.tasks.map(taskDoc => ({
                ...taskDoc,
                id: taskDoc._id.toString(),
                _id: undefined, 
                objectiveId: taskDoc.objectiveId?.toString(),
                createdAt: taskDoc.createdAt ? new Date(taskDoc.createdAt) : new Date(),
                dueDate: taskDoc.dueDate ? new Date(taskDoc.dueDate) : undefined,
            })) : [],
        } as Objective;
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
    const ownerExists = await UserCollection.findById(ownerId);
    if (!ownerExists) {
        return { error: "Owner user not found." };
    }

    const newWorkspaceDoc = await WorkspaceCollection.create({ name, ownerId });
    revalidatePath("/");
    return serializeDocument<IWorkspace>(newWorkspaceDoc) as Workspace;
  } catch (error: any) {
    console.error("Error creating workspace:", error);
    if (error.code === 11000) { 
      return { error: "A workspace with this name might already exist for the user or other unique constraint violation." };
    }
    return { error: "Failed to create workspace. " + error.message };
  }
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
    const newObjectiveDoc = await ObjectiveCollection.create({
      description,
      userId,
      workspaceId,
      tasks: [] 
    });

    if (tasksData.length > 0) {
        const tasksToInsert = tasksData
            .filter(td => td.description.trim() !== "")
            .map(taskInput => ({
                description: taskInput.description,
                assignee: taskInput.assignee || undefined,
                status: "To Do" as TaskStatus,
                priority: "Medium" as TaskPriority,
                objectiveId: newObjectiveDoc._id, 
                createdAt: new Date(), 
        }));
        
        if (tasksToInsert.length > 0) {
            const createdTasks = await TaskCollection.insertMany(tasksToInsert);
            newObjectiveDoc.tasks = createdTasks.map(t => t._id);
            await newObjectiveDoc.save();
        }
    }
    
    const populatedObjectiveDoc = await ObjectiveCollection.findById(newObjectiveDoc._id)
      .populate<{ tasks: ITask[] }>('tasks')
      .exec();

    revalidatePath("/");
    if (!populatedObjectiveDoc) {
        return { error: "Failed to retrieve the newly created objective with tasks."};
    }
    // Manually serialize here to ensure tasks are also serialized correctly
    const objectiveWithSerializedTasks = serializeDocument<IObjective>(populatedObjectiveDoc);
    if (populatedObjectiveDoc.tasks) {
      objectiveWithSerializedTasks.tasks = populatedObjectiveDoc.tasks.map(taskDoc => serializeDocument<ITask>(taskDoc) as Task);
    }
    return objectiveWithSerializedTasks as Objective;


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
    const objectiveWithSerializedTasks = serializeDocument<IObjective>(updatedObjectiveDoc);
    if (updatedObjectiveDoc.tasks) {
      objectiveWithSerializedTasks.tasks = updatedObjectiveDoc.tasks.map(taskDoc => serializeDocument<ITask>(taskDoc) as Task);
    }
    return objectiveWithSerializedTasks as Objective;

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
    return { success: true, task: serializeDocument<ITask>(updatedTaskDoc) as Task };
  } catch (error: any) {
    console.error("Error updating task status:", error);
    return { success: false, error: "Failed to update task status. " + error.message };
  }
}

export async function updateTaskAction(
  taskId: string,
  objectiveId: string, 
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt'>>
): Promise<Task | { error: string }> {
  await dbConnect();
  if (!taskId) return { error: "Task ID is required." };

  const { objectiveId: _, ...validUpdates } = updates;
  
  if (validUpdates.dueDate === null) { 
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
    return serializeDocument<ITask>(updatedTaskDoc) as Task;
  } catch (error: any) {
    console.error("Error updating task:", error);
    return { error: "Failed to update task. " + error.message };
  }
}
