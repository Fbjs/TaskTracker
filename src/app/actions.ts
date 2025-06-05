
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
function serializeDocument<T extends { _id: any, createdAt?: any, updatedAt?: any, password?: string, memberIds?: any[], tasks?: any[], assigneeId?: any, startDate?: any, dueDate?: any }>(doc: any): Omit<T, 'password'> {
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
  if (plainObject.startDate && typeof plainObject.startDate === 'string') {
    plainObject.startDate = new Date(plainObject.startDate);
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
        memberIds: [new mongoose.Types.ObjectId(userId)]
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
                path: 'assigneeId',
                select: 'email _id'
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
      memberIds: [ownerObjectId]
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

    const memberToAdd = await UserCollection.findOne({ email: memberEmail.toLowerCase() }).select('_id email');
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

export async function removeMemberFromWorkspaceAction(workspaceId: string, memberIdToRemove: string, currentUserId: string): Promise<Workspace | { error: string }> {
  await dbConnect();
  if (!workspaceId || !memberIdToRemove || !currentUserId) {
    return { error: "Workspace ID, member ID to remove, and current user ID are required." };
  }

  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) {
      return { error: "Workspace not found." };
    }

    if (workspace.ownerId.toString() !== currentUserId) {
      return { error: "Only the workspace owner can remove members." };
    }

    if (workspace.ownerId.toString() === memberIdToRemove) {
      return { error: "The workspace owner cannot be removed." };
    }

    const memberExists = workspace.memberIds.map(id => id.toString()).includes(memberIdToRemove);
    if (!memberExists) {
      return { error: "User is not a member of this workspace or already removed." };
    }

    workspace.memberIds = workspace.memberIds.filter(id => id.toString() !== memberIdToRemove);
    await workspace.save();

    const objectivesInWorkspace = await ObjectiveCollection.find({ workspaceId: workspace._id });
    const objectiveIds = objectivesInWorkspace.map(obj => obj._id);

    await TaskCollection.updateMany(
      { objectiveId: { $in: objectiveIds }, assigneeId: new mongoose.Types.ObjectId(memberIdToRemove) },
      { $unset: { assigneeId: "" } }
    );

    revalidatePath("/");
    return serializeDocument<IWorkspace>(workspace) as Workspace;
  } catch (error: any) {
    console.error("Error removing member from workspace:", error);
    return { error: "Failed to remove member. " + error.message };
  }
}

export async function getWorkspaceMembersAction(workspaceId: string): Promise<User[] | { error: string }> {
  await dbConnect();
  if (!workspaceId) {
    return { error: "Workspace ID is required." };
  }
  try {
    const workspace = await WorkspaceCollection.findById(workspaceId).populate<{ memberIds: IUser[] }>({
        path: 'memberIds',
        select: 'email _id'
    }).lean();
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
  tasksData: { description: string; assigneeId?: string; startDate?: Date; dueDate?: Date }[],
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

  let newObjectiveDoc: IObjective | null = null;
  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) return { error: "Workspace not found." };
    if (!workspace.memberIds.map(id => id.toString()).includes(userId)) {
        return { error: "User is not a member of this workspace." };
    }

    newObjectiveDoc = await ObjectiveCollection.create({
      description,
      userId: new mongoose.Types.ObjectId(userId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      tasks: []
    });

    if (tasksData && tasksData.length > 0) {
        const tasksToInsert = tasksData
            .filter(td => td.description && td.description.trim() !== "")
            .map(taskInput => {
                if (taskInput.assigneeId && !workspace.memberIds.map(id => id.toString()).includes(taskInput.assigneeId)) {
                    throw new Error(`Assignee with ID ${taskInput.assigneeId} is not a member of this workspace.`);
                }
                return {
                    description: taskInput.description,
                    assigneeId: taskInput.assigneeId ? new mongoose.Types.ObjectId(taskInput.assigneeId) : undefined,
                    startDate: taskInput.startDate ? new Date(taskInput.startDate) : undefined,
                    dueDate: taskInput.dueDate ? new Date(taskInput.dueDate) : undefined,
                    status: "To Do" as TaskStatus,
                    priority: "Medium" as TaskPriority,
                    objectiveId: newObjectiveDoc!._id,
                    createdAt: new Date(),
                }
            });

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
        const fallbackObjective = await ObjectiveCollection.findById(newObjectiveDoc._id).lean();
        if (fallbackObjective) return serializeDocument<IObjective>(fallbackObjective) as Objective;
        return { error: "Failed to retrieve the newly created objective with tasks."};
    }

    return serializeDocument<IObjective>(populatedObjectiveDoc) as Objective;

  } catch (error: any) {
     if (newObjectiveDoc && !newObjectiveDoc.isNew) {
        const fallbackObjective = await ObjectiveCollection.findById(newObjectiveDoc._id)
          .populate<{ tasks: ITask[] }>({
              path: 'tasks',
              populate: { path: 'assigneeId', select: 'email _id' }
          }).exec();
        if (fallbackObjective) return serializeDocument<IObjective>(fallbackObjective) as Objective;
    }
    console.error("Error adding objective:", error);
    return { error: "Failed to add objective. " + error.message };
  }
}

export async function updateObjectiveAction(
  objectiveId: string,
  newDescription: string,
  newTasksData: { description: string; assigneeId?: string; startDate?: Date; dueDate?: Date }[] = [],
  tasksToDeleteIds: string[] = [],
  tasksToUpdateData: { id: string; description?: string; assigneeId?: string | null; startDate?: Date | null; dueDate?: Date | null }[] = []
): Promise<Objective | { error: string }> {
  await dbConnect();
  if (!objectiveId) return { error: "Objective ID is required." };

  try {
    const objective = await ObjectiveCollection.findById(objectiveId);
    if (!objective) return { error: "Objective not found." };

    if (newDescription.trim()) {
      objective.description = newDescription.trim();
    }

    const workspace = await WorkspaceCollection.findById(objective.workspaceId);
    if (!workspace) return { error: "Associated workspace not found. Cannot validate members." };

    if (tasksToDeleteIds.length > 0) {
      await TaskCollection.deleteMany({ _id: { $in: tasksToDeleteIds }, objectiveId: objective._id });
      objective.tasks = objective.tasks.filter(taskId => !tasksToDeleteIds.includes(taskId.toString()));
    }

    if (tasksToUpdateData.length > 0) {
      for (const taskUpdate of tasksToUpdateData) {
        const taskToUpdateDoc = await TaskCollection.findById(taskUpdate.id);
        if (taskToUpdateDoc && taskToUpdateDoc.objectiveId.toString() === objectiveId) {
          const updateFields: any = { $set: {}, $unset: {} };

          if (Object.prototype.hasOwnProperty.call(taskUpdate, 'description')) {
            updateFields.$set.description = taskUpdate.description;
          }

          if (Object.prototype.hasOwnProperty.call(taskUpdate, 'assigneeId')) {
            if (taskUpdate.assigneeId === null || taskUpdate.assigneeId === undefined || taskUpdate.assigneeId.trim() === "") {
              updateFields.$unset.assigneeId = "";
            } else {
              if (!workspace.memberIds.map(id => id.toString()).includes(taskUpdate.assigneeId)) {
                throw new Error(`Cannot assign task ${taskUpdate.description || taskToUpdateDoc.description}: User ${taskUpdate.assigneeId} is not a member of the workspace.`);
              }
              updateFields.$set.assigneeId = new mongoose.Types.ObjectId(taskUpdate.assigneeId);
            }
          }

          if (Object.prototype.hasOwnProperty.call(taskUpdate, 'startDate')) {
            if (taskUpdate.startDate === null || taskUpdate.startDate === undefined) {
              updateFields.$unset.startDate = "";
            } else {
              updateFields.$set.startDate = new Date(taskUpdate.startDate);
            }
          }

          if (Object.prototype.hasOwnProperty.call(taskUpdate, 'dueDate')) {
            if (taskUpdate.dueDate === null || taskUpdate.dueDate === undefined) {
              updateFields.$unset.dueDate = "";
            } else {
              updateFields.$set.dueDate = new Date(taskUpdate.dueDate);
            }
          }

          if (Object.keys(updateFields.$set).length === 0) delete updateFields.$set;
          if (Object.keys(updateFields.$unset).length === 0) delete updateFields.$unset;

          if (Object.keys(updateFields).length > 0) {
            await TaskCollection.findByIdAndUpdate(taskUpdate.id, updateFields);
          }
        }
      }
    }

    if (newTasksData.length > 0) {
        const newTasksToCreate = newTasksData
            .filter(td => td.description && td.description.trim() !== "")
            .map(taskInput => {
                if (taskInput.assigneeId && !workspace.memberIds.map(id => id.toString()).includes(taskInput.assigneeId)) {
                    throw new Error(`Cannot create task ${taskInput.description}: User ${taskInput.assigneeId} is not a member of the workspace.`);
                }
                return {
                    description: taskInput.description,
                    assigneeId: taskInput.assigneeId ? new mongoose.Types.ObjectId(taskInput.assigneeId) : undefined,
                    startDate: taskInput.startDate ? new Date(taskInput.startDate) : undefined,
                    dueDate: taskInput.dueDate ? new Date(taskInput.dueDate) : undefined,
                    status: "To Do" as TaskStatus,
                    priority: "Medium" as TaskPriority,
                    objectiveId: objective._id,
                    createdAt: new Date(),
                };
            });

        if (newTasksToCreate.length > 0) {
            const createdNewTasks = await TaskCollection.insertMany(newTasksToCreate);
            objective.tasks.push(...createdNewTasks.map(t => t._id as mongoose.Types.ObjectId));
        }
    }

    await objective.save();

    const populatedObjective = await ObjectiveCollection.findById(objective.id)
        .populate<{ tasks: ITask[] }>({
            path: 'tasks',
            populate: { path: 'assigneeId', select: 'email _id' }
        })
        .exec();

    if (!populatedObjective) return { error: "Failed to repopulate objective after update."};

    revalidatePath("/");
    return serializeDocument<IObjective>(populatedObjective) as Objective;

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
  objectiveId: string, // Keep for context, though not directly used in this simplified update
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt' | 'assignee'>> & { assigneeId?: string | null}
): Promise<Task | { error: string }> {
  await dbConnect();
  if (!taskId) return { error: "Task ID is required." };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { objectiveId: _, assignee, ...rawUpdates } = updates;

  const updatesForSet: any = {};
  const updatesToUnset: any = {};


  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'description')) {
    updatesForSet.description = rawUpdates.description;
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'status')) {
    updatesForSet.status = rawUpdates.status;
  }
  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'priority')) {
    updatesForSet.priority = rawUpdates.priority;
  }


  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'startDate')) {
    if (rawUpdates.startDate === null || rawUpdates.startDate === undefined || rawUpdates.startDate === "") {
      updatesToUnset.startDate = "";
    } else if (rawUpdates.startDate) {
      updatesForSet.startDate = new Date(rawUpdates.startDate);
    }
  }


  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'dueDate')) {
    if (rawUpdates.dueDate === null || rawUpdates.dueDate === undefined || rawUpdates.dueDate === "") {
      updatesToUnset.dueDate = "";
    } else if (rawUpdates.dueDate) {
      updatesForSet.dueDate = new Date(rawUpdates.dueDate);
    }
  }


  if (Object.prototype.hasOwnProperty.call(rawUpdates, 'assigneeId')) {
    if (rawUpdates.assigneeId === null || rawUpdates.assigneeId === undefined || rawUpdates.assigneeId.trim() === "") {
      updatesToUnset.assigneeId = "";
    } else {
      const taskDocForWorkspaceCheck = await TaskCollection.findById(taskId).populate({
        path: 'objectiveId',
        select: 'workspaceId',
        populate: {
            path: 'workspaceId',
            select: 'memberIds'
        }
      });

      if (taskDocForWorkspaceCheck && taskDocForWorkspaceCheck.objectiveId && (taskDocForWorkspaceCheck.objectiveId as any).workspaceId) {
          const workspace = (taskDocForWorkspaceCheck.objectiveId as any).workspaceId as IWorkspace;
          if (workspace && workspace.memberIds) {
              if (!workspace.memberIds.map(id => id.toString()).includes(rawUpdates.assigneeId)) {
                  return { error: "Assignee is not a member of this workspace." };
              }
              updatesForSet.assigneeId = new mongoose.Types.ObjectId(rawUpdates.assigneeId);
          } else {
             return { error: "Could not verify workspace membership for assignee. Workspace details missing."};
          }
      } else {
         return { error: "Could not find task or objective to verify assignee."};
      }
    }
  }

  const finalUpdateQuery: any = {};
  if (Object.keys(updatesForSet).length > 0) {
    finalUpdateQuery.$set = updatesForSet;
  }
  if (Object.keys(updatesToUnset).length > 0) {
    finalUpdateQuery.$unset = updatesToUnset;
  }

  if (Object.keys(finalUpdateQuery).length === 0) {
     const currentTaskDoc = await TaskCollection.findById(taskId).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');
     if (!currentTaskDoc) return { error: "Task not found."};
     return serializeDocument<ITask>(currentTaskDoc) as Task;
  }

  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      finalUpdateQuery,
      { new: true, runValidators: true }
    ).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');


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
