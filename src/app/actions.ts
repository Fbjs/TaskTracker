
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
import mongoose from "mongoose";

const SALT_ROUNDS = 10;

// Helper to convert Mongoose document to a plain object compatible with frontend types
function serializeDocument<T extends { _id: any, createdAt?: any, updatedAt?: any, password?: string, memberIds?: any[], tasks?: any[], assigneeId?: any }>(doc: any): Omit<T, 'password'> {
  if (!doc) return null as unknown as Omit<T, 'password'>;
  const plainObject = doc.toObject ? doc.toObject({ getters: true, versionKey: false }) : { ...doc };

  plainObject.id = plainObject._id?.toString();
  delete plainObject._id;
  delete plainObject.password; 

  if (plainObject.createdAt && typeof plainObject.createdAt === 'string') {
    plainObject.createdAt = new Date(plainObject.createdAt);
  }
  if (plainObject.updatedAt && typeof plainObject.updatedAt === 'string') {
    plainObject.updatedAt = new Date(plainObject.updatedAt);
  }
  if (plainObject.dueDate && typeof plainObject.dueDate === 'string') {
    plainObject.dueDate = new Date(plainObject.dueDate);
  }
  
  if (plainObject.ownerId && typeof plainObject.ownerId !== 'string') {
    plainObject.ownerId = plainObject.ownerId.toString();
  }

  if (plainObject.memberIds && Array.isArray(plainObject.memberIds)) {
    plainObject.memberIds = plainObject.memberIds.map((id: any) => id.toString());
  }
  
  if (plainObject.assigneeId && typeof plainObject.assigneeId !== 'string') {
    if (plainObject.assigneeId.email) { // If populated
        plainObject.assignee = {
            id: plainObject.assigneeId._id.toString(),
            email: plainObject.assigneeId.email,
        }
    }
    plainObject.assigneeId = plainObject.assigneeId._id?.toString() || plainObject.assigneeId.toString();
  }


  if (plainObject.tasks && Array.isArray(plainObject.tasks)) {
    plainObject.tasks = plainObject.tasks.map((task: any) => serializeDocument<Task>(task));
  }
  
  if (plainObject.userId && typeof plainObject.userId !== 'string') {
    plainObject.userId = plainObject.userId.toString();
  }
  if (plainObject.workspaceId && typeof plainObject.workspaceId !== 'string') {
    plainObject.workspaceId = plainObject.workspaceId.toString();
  }
   if (plainObject.objectiveId && typeof plainObject.objectiveId !== 'string') {
    plainObject.objectiveId = plainObject.objectiveId.toString();
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
    if (error.code === 11000) { 
        return { error: "User with this email already exists." };
    }
    return { error: "Failed to register user. " + (error.message || "Please try again.") };
  }
}

export async function loginUserAction(email: string, passwordPlain: string): Promise<User | { error: string }> {
  await dbConnect();
  try {
    const userDoc = await UserCollection.findOne({ email: email.toLowerCase() }).lean();
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
    const userWorkspacesDocs = await WorkspaceCollection.find({ 
      $or: [{ ownerId: userId }, { memberIds: userId }] 
    }).lean();
    userWorkspaces = userWorkspacesDocs.map(doc => serializeDocument<IWorkspace>(doc) as Workspace);


    if (userWorkspaces.length === 0) {
      const defaultWorkspaceData = {
        name: "My First Workspace",
        ownerId: new mongoose.Types.ObjectId(userId),
        memberIds: [new mongoose.Types.ObjectId(userId)] // Owner is also a member
      };
      const newWsDoc = await WorkspaceCollection.create(defaultWorkspaceData);
      const createdWorkspace = serializeDocument<IWorkspace>(newWsDoc) as Workspace; 
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
        .populate<{ tasks: ITask[] }>({
            path: 'tasks',
            populate: {
                path: 'assigneeId', // Populate assignee details for each task
                select: 'email _id' // Select only email and id
            }
        })
        .lean(); 

      objectives = objectivesDocs.map(objDoc => serializeDocument<IObjective>(objDoc) as Objective);

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
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const ownerExists = await UserCollection.findById(ownerObjectId);
    if (!ownerExists) {
        return { error: "Owner user not found." };
    }

    const newWorkspaceDoc = await WorkspaceCollection.create({ 
      name, 
      ownerId: ownerObjectId,
      memberIds: [ownerObjectId] // Owner is automatically a member
    });
    revalidatePath("/");
    return serializeDocument<IWorkspace>(newWorkspaceDoc) as Workspace;
  } catch (error: any) {
    console.error("Error creating workspace:", error);
    if (error.code === 11000) { 
      return { error: "A workspace with this name might already exist or other unique constraint violation." };
    }
    return { error: "Failed to create workspace. " + error.message };
  }
}

export async function addMemberToWorkspaceAction(workspaceId: string, memberEmail: string, currentUserId: string): Promise<Workspace | { error: string }> {
  await dbConnect();
  if (!workspaceId || !memberEmail || !currentUserId) {
    return { error: "Workspace ID, member email, and current user ID are required." };
  }

  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) {
      return { error: "Workspace not found." };
    }
    if (workspace.ownerId.toString() !== currentUserId) {
      return { error: "Only the workspace owner can add members." };
    }

    const memberToAdd = await UserCollection.findOne({ email: memberEmail.toLowerCase() });
    if (!memberToAdd) {
      return { error: `User with email ${memberEmail} not found.` };
    }

    if (workspace.memberIds.map(id => id.toString()).includes(memberToAdd._id.toString())) {
      return { error: `User ${memberEmail} is already a member of this workspace.` };
    }

    workspace.memberIds.push(memberToAdd._id);
    await workspace.save();
    revalidatePath("/");
    return serializeDocument<IWorkspace>(workspace) as Workspace;
  } catch (error: any) {
    console.error("Error adding member to workspace:", error);
    return { error: "Failed to add member. " + error.message };
  }
}

export async function getWorkspaceMembersAction(workspaceId: string): Promise<User[] | { error: string }> {
  await dbConnect();
  if (!workspaceId) {
    return { error: "Workspace ID is required." };
  }
  try {
    const workspace = await WorkspaceCollection.findById(workspaceId).populate<{ memberIds: IUser[] }>('memberIds', 'email _id').lean();
    if (!workspace) {
      return { error: "Workspace not found." };
    }
    return workspace.memberIds.map(member => serializeDocument<IUser>(member) as User);
  } catch (error: any) {
    console.error("Error fetching workspace members:", error);
    return { error: "Failed to fetch workspace members. " + error.message };
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
  tasksData: { description: string; assigneeId?: string }[],
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
    // Validate workspace and user membership (optional, but good practice)
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) return { error: "Workspace not found." };
    if (!workspace.memberIds.map(id => id.toString()).includes(userId)) {
        return { error: "User is not a member of this workspace." };
    }


    const newObjectiveDoc = await ObjectiveCollection.create({
      description,
      userId: new mongoose.Types.ObjectId(userId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      tasks: [] 
    });

    if (tasksData.length > 0) {
        const tasksToInsert = tasksData
            .filter(td => td.description.trim() !== "")
            .map(taskInput => ({
                description: taskInput.description,
                assigneeId: taskInput.assigneeId ? new mongoose.Types.ObjectId(taskInput.assigneeId) : undefined,
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
      .populate<{ tasks: ITask[] }>({
          path: 'tasks',
          populate: { path: 'assigneeId', select: 'email _id' }
      })
      .exec();

    revalidatePath("/");
    if (!populatedObjectiveDoc) {
        return { error: "Failed to retrieve the newly created objective with tasks."};
    }
    
    return serializeDocument<IObjective>(populatedObjectiveDoc) as Objective;


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
    ).populate<{ tasks: ITask[] }>({
        path: 'tasks',
        populate: { path: 'assigneeId', select: 'email _id' }
    });

    if (!updatedObjectiveDoc) {
      return { error: "Objective not found." };
    }
    revalidatePath("/");
    return serializeDocument<IObjective>(updatedObjectiveDoc) as Objective;

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
    ).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');

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
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt' | 'assignee'>> & { assigneeId?: string | null}
): Promise<Task | { error: string }> {
  await dbConnect();
  if (!taskId) return { error: "Task ID is required." };

  const { objectiveId: _, assignee, ...validUpdates } = updates; // exclude assignee object if present
  
  if (validUpdates.dueDate === null) { 
    (validUpdates as any).dueDate = undefined; // Handle null dueDate
  } else if (validUpdates.dueDate) {
    (validUpdates as any).dueDate = new Date(validUpdates.dueDate);
  }

  if (validUpdates.assigneeId === null) {
    (validUpdates as any).assigneeId = undefined; // Unassign
  } else if (validUpdates.assigneeId) {
     // Validate assigneeId is a member of the workspace
     const taskDoc = await TaskCollection.findById(taskId).populate('objectiveId');
     if (taskDoc && taskDoc.objectiveId) {
         const objective = await ObjectiveCollection.findById(taskDoc.objectiveId).populate('workspaceId');
         if (objective && objective.workspaceId && (objective.workspaceId as unknown as IWorkspace).memberIds) {
             const workspace = objective.workspaceId as unknown as IWorkspace;
             if (!workspace.memberIds.map(id => id.toString()).includes(validUpdates.assigneeId)) {
                 return { error: "Assignee is not a member of this workspace." };
             }
             (validUpdates as any).assigneeId = new mongoose.Types.ObjectId(validUpdates.assigneeId);
         } else {
            return { error: "Could not verify workspace membership for assignee."};
         }
     } else {
        return { error: "Could not find task or objective to verify assignee."};
     }
  }


  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      validUpdates,
      { new: true, runValidators: true }
    ).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');


    if (!updatedTaskDoc) {
      return { error: "Task not found." };
    }
    revalidatePath("/");
    return serializeDocument<ITask>(updatedTaskDoc) as Task;
  } catch (error: any)
{
    console.error("Error updating task:", error);
    return { error: "Failed to update task. " + error.message };
  }
}
