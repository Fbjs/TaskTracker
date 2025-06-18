
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
import { isValid } from "date-fns";

const SALT_ROUNDS = 10;

function serializeDocument<T extends { _id: any, createdAt?: any, updatedAt?: any, password?: string, memberIds?: any[], tasks?: any[], assigneeId?: any, startDate?: any, dueDate?: any }>(doc: any): Omit<T, 'password'> {
  if (!doc) return null as unknown as Omit<T, 'password'>;
  const plainObject = doc.toObject ? doc.toObject({ getters: true, versionKey: false }) : { ...doc };

  plainObject.id = plainObject._id?.toString();
  delete plainObject._id;
  delete plainObject.password;

  if (plainObject.createdAt && !(plainObject.createdAt instanceof Date)) {
    plainObject.createdAt = new Date(plainObject.createdAt);
  }
  if (plainObject.updatedAt && !(plainObject.updatedAt instanceof Date)) {
    plainObject.updatedAt = new Date(plainObject.updatedAt);
  }
  
  if (Object.prototype.hasOwnProperty.call(plainObject, 'startDate')) {
    if (plainObject.startDate && !(plainObject.startDate instanceof Date)) {
        const parsedStartDate = new Date(plainObject.startDate);
        if (isValid(parsedStartDate)) {
            plainObject.startDate = parsedStartDate;
        } else {
            delete plainObject.startDate; 
        }
    } else if (!plainObject.startDate) {
        delete plainObject.startDate;
    }
  }
  if (Object.prototype.hasOwnProperty.call(plainObject, 'dueDate')) {
      if (plainObject.dueDate && !(plainObject.dueDate instanceof Date)) {
          const parsedDueDate = new Date(plainObject.dueDate);
          if (isValid(parsedDueDate)) {
              plainObject.dueDate = parsedDueDate;
          } else {
              delete plainObject.dueDate;
          }
      } else if (!plainObject.dueDate) {
          delete plainObject.dueDate;
      }
  }


  if (plainObject.ownerId && typeof plainObject.ownerId !== 'string') {
    plainObject.ownerId = plainObject.ownerId.toString();
  }

  if (plainObject.memberIds && Array.isArray(plainObject.memberIds)) {
    plainObject.memberIds = plainObject.memberIds.map((id: any) => id.toString());
  }

  if (plainObject.assigneeId && typeof plainObject.assigneeId !== 'string') {
    if (plainObject.assigneeId.email) { 
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
      return { error: "Un usuario con este correo electrónico ya existe." };
    }

    if (passwordPlain.length < 6) {
      return { error: "La contraseña debe tener al menos 6 caracteres."};
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
    const newUserDoc = await UserCollection.create({ email: email.toLowerCase(), password: hashedPassword });

    return serializeDocument<IUser>(newUserDoc) as User;
  } catch (error: any) {
    console.error("Error registering user:", error);
    if (error.code === 11000) {
        return { error: "Un usuario con este correo electrónico ya existe." };
    }
    return { error: "No se pudo registrar el usuario. " + (error.message || "Por favor, inténtalo de nuevo.") };
  }
}

export async function loginUserAction(email: string, passwordPlain: string): Promise<User | { error: string }> {
  await dbConnect();
  try {
    const userDoc = await UserCollection.findOne({ email: email.toLowerCase() }).lean();
    if (!userDoc || !userDoc.password) {
      return { error: "Correo electrónico o contraseña inválidos." };
    }

    const isMatch = await bcrypt.compare(passwordPlain, userDoc.password);
    if (!isMatch) {
      return { error: "Correo electrónico o contraseña inválidos." };
    }

    return serializeDocument<IUser>(userDoc) as User;
  } catch (error: any) {
    console.error("Error logging in user:", error);
    return { error: "No se pudo iniciar sesión. " + (error.message || "Por favor, inténtalo de nuevo.") };
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
        name: "Mi Primer Espacio de Trabajo",
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
    return { error: "El nombre del espacio de trabajo no puede estar vacío." };
  }
  if (!ownerId) {
    return { error: "Se requiere el ID del propietario para crear un espacio de trabajo."}
  }

  try {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const ownerExists = await UserCollection.findById(ownerObjectId);
    if (!ownerExists) {
        return { error: "Usuario propietario no encontrado." };
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
      return { error: "Un espacio de trabajo con este nombre ya podría existir u otra violación de restricción única." };
    }
    return { error: "No se pudo crear el espacio de trabajo. " + error.message };
  }
}

export async function addMemberToWorkspaceAction(workspaceId: string, memberEmail: string, currentUserId: string): Promise<Workspace | { error: string }> {
  await dbConnect();
  if (!workspaceId || !memberEmail || !currentUserId) {
    return { error: "Se requieren el ID del espacio de trabajo, el correo del miembro y el ID del usuario actual." };
  }

  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) {
      return { error: "Espacio de trabajo no encontrado." };
    }
    if (workspace.ownerId.toString() !== currentUserId) {
      return { error: "Solo el propietario del espacio de trabajo puede añadir miembros." };
    }

    const memberToAdd = await UserCollection.findOne({ email: memberEmail.toLowerCase() }).select('_id email');
    if (!memberToAdd) {
      return { error: `Usuario con correo ${memberEmail} no encontrado.` };
    }

    if (workspace.memberIds.map(id => id.toString()).includes(memberToAdd._id.toString())) {
      return { error: `El usuario ${memberEmail} ya es miembro de este espacio de trabajo.` };
    }

    workspace.memberIds.push(memberToAdd._id);
    await workspace.save();
    revalidatePath("/");
    return serializeDocument<IWorkspace>(workspace) as Workspace;
  } catch (error: any) {
    console.error("Error adding member to workspace:", error);
    return { error: "No se pudo añadir miembro. " + error.message };
  }
}

export async function removeMemberFromWorkspaceAction(workspaceId: string, memberIdToRemove: string, currentUserId: string): Promise<Workspace | { error: string }> {
  await dbConnect();
  if (!workspaceId || !memberIdToRemove || !currentUserId) {
    return { error: "Se requieren el ID del espacio de trabajo, el ID del miembro a eliminar y el ID del usuario actual." };
  }

  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) {
      return { error: "Espacio de trabajo no encontrado." };
    }

    if (workspace.ownerId.toString() !== currentUserId) {
      return { error: "Solo el propietario del espacio de trabajo puede eliminar miembros." };
    }

    if (workspace.ownerId.toString() === memberIdToRemove) {
      return { error: "El propietario del espacio de trabajo no puede ser eliminado." };
    }

    const memberExists = workspace.memberIds.map(id => id.toString()).includes(memberIdToRemove);
    if (!memberExists) {
      return { error: "El usuario no es miembro de este espacio de trabajo o ya fue eliminado." };
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
    return { error: "No se pudo eliminar miembro. " + error.message };
  }
}

export async function getWorkspaceMembersAction(workspaceId: string): Promise<User[] | { error: string }> {
  await dbConnect();
  if (!workspaceId) {
    return { error: "Se requiere el ID del espacio de trabajo." };
  }
  try {
    const workspace = await WorkspaceCollection.findById(workspaceId).populate<{ memberIds: IUser[] }>({
        path: 'memberIds',
        select: 'email _id'
    }).lean();
    if (!workspace) {
      return { error: "Espacio de trabajo no encontrado." };
    }
    return workspace.memberIds.map(member => serializeDocument<IUser>(member) as User);
  } catch (error: any) {
    console.error("Error fetching workspace members:", error);
    return { error: "No se pudieron obtener los miembros del espacio de trabajo. " + error.message };
  }
}


export async function handleSuggestTasks(objectivePrompt: string): Promise<AISuggestions | { error: string }> {
  try {
    const input: SuggestTasksInput = { objectivePrompt };
    const result: SuggestTasksOutput = await genkitSuggestTasks(input);
    return result;
  } catch (error) {
    console.error("Error calling AI suggestion flow:", error);
    return { error: "No se pudieron obtener sugerencias de IA. Por favor, inténtalo de nuevo." };
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
    return { error: "Se requieren el ID de Usuario y el ID de Espacio de Trabajo para crear un objetivo." };
  }
  if (!description.trim()) {
    return { error: "La descripción del objetivo не может быть пустой." };
  }

  let newObjectiveDoc: IObjective | null = null;
  try {
    const workspace = await WorkspaceCollection.findById(workspaceId);
    if (!workspace) return { error: "Espacio de trabajo no encontrado." };
    if (!workspace.memberIds.map(id => id.toString()).includes(userId)) {
        return { error: "El usuario no es miembro de este espacio de trabajo." };
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
                    throw new Error(`El asignado con ID ${taskInput.assigneeId} no es miembro de este espacio de trabajo.`);
                }

                let effectiveStartDate: Date | undefined = undefined;
                if (taskInput.startDate) {
                    const dateToTest = taskInput.startDate instanceof Date ? taskInput.startDate : new Date(taskInput.startDate);
                    if (isValid(dateToTest)) {
                        effectiveStartDate = dateToTest;
                    }
                }

                let effectiveDueDate: Date | undefined = undefined;
                if (taskInput.dueDate) {
                    const dateToTest = taskInput.dueDate instanceof Date ? taskInput.dueDate : new Date(taskInput.dueDate);
                    if (isValid(dateToTest)) {
                        effectiveDueDate = dateToTest;
                    }
                }
                
                return {
                    description: taskInput.description,
                    assigneeId: taskInput.assigneeId ? new mongoose.Types.ObjectId(taskInput.assigneeId) : undefined,
                    startDate: effectiveStartDate,
                    dueDate: effectiveDueDate,
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
        return { error: "No se pudo recuperar el objetivo recién creado con tareas."};
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
    return { error: "No se pudo añadir el objetivo. " + error.message };
  }
}

export async function updateObjectiveAction(
  objectiveId: string,
  newDescription: string,
  newTasksData: { description: string; assigneeId?: string; startDate?: Date | null; dueDate?: Date | null }[] = [],
  tasksToDeleteIds: string[] = [],
  tasksToUpdateData: { id: string; description?: string; assigneeId?: string | null; startDate?: Date | null; dueDate?: Date | null }[] = []
): Promise<Objective | { error: string }> {
  await dbConnect();
  if (!objectiveId) return { error: "Se requiere el ID del objetivo." };

  try {
    const objective = await ObjectiveCollection.findById(objectiveId);
    if (!objective) return { error: "Objetivo no encontrado." };

    if (newDescription.trim()) {
      objective.description = newDescription.trim();
    }

    const workspace = await WorkspaceCollection.findById(objective.workspaceId);
    if (!workspace) return { error: "Espacio de trabajo asociado no encontrado. No se pueden validar miembros." };

    if (tasksToDeleteIds.length > 0) {
      await TaskCollection.deleteMany({ _id: { $in: tasksToDeleteIds }, objectiveId: objective._id });
      objective.tasks = objective.tasks.filter(taskId => !tasksToDeleteIds.includes(taskId.toString()));
    }

    if (tasksToUpdateData.length > 0) {
      for (const taskUpdate of tasksToUpdateData) {
        const taskDocToUpdate = await TaskCollection.findById(taskUpdate.id);
        if (!taskDocToUpdate || taskDocToUpdate.objectiveId.toString() !== objectiveId) continue;

        const updateQuery: { $set: any, $unset: any } = { $set: {}, $unset: {} };
        let changed = false;

        if (Object.prototype.hasOwnProperty.call(taskUpdate, 'description') && taskUpdate.description !== undefined && taskUpdate.description !== taskDocToUpdate.description) {
          updateQuery.$set.description = taskUpdate.description;
          changed = true;
        }
        
        if (Object.prototype.hasOwnProperty.call(taskUpdate, 'startDate')) {
            const clientStartDate = taskUpdate.startDate;
            if (clientStartDate === null) {
                if (taskDocToUpdate.startDate) {
                    updateQuery.$unset.startDate = "";
                    changed = true;
                }
            } else if (clientStartDate) {
                const parsedDate = clientStartDate instanceof Date ? clientStartDate : new Date(clientStartDate);
                if (isValid(parsedDate)) {
                    if (!taskDocToUpdate.startDate || new Date(taskDocToUpdate.startDate).getTime() !== parsedDate.getTime()) {
                        updateQuery.$set.startDate = parsedDate;
                        changed = true;
                    }
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(taskUpdate, 'dueDate')) {
            const clientDueDate = taskUpdate.dueDate;
            if (clientDueDate === null) {
                if (taskDocToUpdate.dueDate) {
                    updateQuery.$unset.dueDate = "";
                    changed = true;
                }
            } else if (clientDueDate) {
                const parsedDate = clientDueDate instanceof Date ? clientDueDate : new Date(clientDueDate);
                if (isValid(parsedDate)) {
                     if (!taskDocToUpdate.dueDate || new Date(taskDocToUpdate.dueDate).getTime() !== parsedDate.getTime()) {
                        updateQuery.$set.dueDate = parsedDate;
                        changed = true;
                    }
                }
            }
        }
        
        if (Object.prototype.hasOwnProperty.call(taskUpdate, 'assigneeId')) {
           const currentAssigneeId = taskDocToUpdate.assigneeId ? taskDocToUpdate.assigneeId.toString() : null;
           const newAssigneeId = taskUpdate.assigneeId;

           if ((newAssigneeId === null || newAssigneeId === undefined) && currentAssigneeId !== null) {
             updateQuery.$unset.assigneeId = "";
             changed = true;
           } else if (newAssigneeId && newAssigneeId !== "" && newAssigneeId !== currentAssigneeId) {
             if (!workspace.memberIds.map(id => id.toString()).includes(newAssigneeId)) {
                throw new Error(`No se puede asignar la tarea ${taskUpdate.description || taskDocToUpdate.description}: El usuario ${newAssigneeId} no es miembro del espacio de trabajo.`);
             }
             updateQuery.$set.assigneeId = new mongoose.Types.ObjectId(newAssigneeId);
             changed = true;
           }
        }

        if (Object.keys(updateQuery.$set).length === 0) delete updateQuery.$set;
        if (Object.keys(updateQuery.$unset).length === 0) delete updateQuery.$unset;

        if (changed && (updateQuery.$set || updateQuery.$unset)) {
          await TaskCollection.findByIdAndUpdate(taskUpdate.id, updateQuery);
        }
      }
    }

    if (newTasksData.length > 0) {
        const newTasksToCreate = newTasksData
            .filter(td => td.description && td.description.trim() !== "")
            .map(taskInput => {
                if (taskInput.assigneeId && !workspace.memberIds.map(id => id.toString()).includes(taskInput.assigneeId)) {
                    throw new Error(`No se puede crear la tarea ${taskInput.description}: El usuario ${taskInput.assigneeId} no es miembro del espacio de trabajo.`);
                }
                
                let effectiveStartDate: Date | undefined = undefined;
                if (taskInput.startDate) {
                    const dateToTest = taskInput.startDate instanceof Date ? taskInput.startDate : new Date(taskInput.startDate);
                    if (isValid(dateToTest)) {
                        effectiveStartDate = dateToTest;
                    }
                }

                let effectiveDueDate: Date | undefined = undefined;
                if (taskInput.dueDate) {
                    const dateToTest = taskInput.dueDate instanceof Date ? taskInput.dueDate : new Date(taskInput.dueDate);
                    if (isValid(dateToTest)) {
                        effectiveDueDate = dateToTest;
                    }
                }

                return {
                    description: taskInput.description,
                    assigneeId: taskInput.assigneeId ? new mongoose.Types.ObjectId(taskInput.assigneeId) : undefined,
                    startDate: effectiveStartDate,
                    dueDate: effectiveDueDate,
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

    if (!populatedObjective) return { error: "No se pudo volver a popular el objetivo después de la actualización."};

    revalidatePath("/");
    return serializeDocument<IObjective>(populatedObjective) as Objective;

  } catch (error: any) {
    console.error("Error updating objective:", error);
    return { error: "No se pudo actualizar el objetivo. " + error.message };
  }
}

export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus, objectiveId: string): Promise<{success: boolean, task?: Task} | {success: boolean, error?: string}> {
  await dbConnect();
  if (!taskId) return { success: false, error: "Se requiere el ID de la tarea." };

  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      { status: newStatus },
      { new: true, runValidators: true }
    ).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');

    if (!updatedTaskDoc) {
      return { success: false, error: "Tarea no encontrada." };
    }
    revalidatePath("/");
    return { success: true, task: serializeDocument<ITask>(updatedTaskDoc) as Task };
  } catch (error: any) {
    console.error("Error updating task status:", error);
    return { success: false, error: "No se pudo actualizar el estado de la tarea. " + error.message };
  }
}

export async function updateTaskAction(
  taskId: string,
  objectiveId: string, 
  updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt' | 'assignee'>> & { assigneeId?: string | null}
): Promise<Task | { error: string }> {
  await dbConnect();
  if (!taskId) return { error: "Se requiere el ID de la tarea." };

  const taskToUpdate = await TaskCollection.findById(taskId);
  if (!taskToUpdate) return { error: "Tarea no encontrada para actualizar." };

  const { objectiveId: _, assignee, ...rawUpdates } = updates;

  const updatePayload: { $set: any, $unset: any } = { $set: {}, $unset: {} };
  let changedFields = 0;

  if (rawUpdates.hasOwnProperty('description') && rawUpdates.description !== undefined && rawUpdates.description !== taskToUpdate.description) {
    updatePayload.$set.description = rawUpdates.description;
    changedFields++;
  }
  if (rawUpdates.hasOwnProperty('status') && rawUpdates.status !== undefined && rawUpdates.status !== taskToUpdate.status) {
    updatePayload.$set.status = rawUpdates.status;
    changedFields++;
  }
  if (rawUpdates.hasOwnProperty('priority') && rawUpdates.priority !== undefined && rawUpdates.priority !== taskToUpdate.priority) {
    updatePayload.$set.priority = rawUpdates.priority;
    changedFields++;
  }

  if (rawUpdates.hasOwnProperty('startDate')) {
    const clientStartDate = rawUpdates.startDate;
    if (clientStartDate === null) { 
      if (taskToUpdate.startDate) { 
        updatePayload.$unset.startDate = "";
        changedFields++;
      }
    } else if (clientStartDate instanceof Date || typeof clientStartDate === 'string') { 
      const newStartDate = clientStartDate instanceof Date ? clientStartDate : new Date(clientStartDate);
      if (isValid(newStartDate)) {
        if (!taskToUpdate.startDate || new Date(taskToUpdate.startDate).getTime() !== newStartDate.getTime()) {
          updatePayload.$set.startDate = newStartDate;
          changedFields++;
        }
      }
    }
  }

  if (rawUpdates.hasOwnProperty('dueDate')) {
    const clientDueDate = rawUpdates.dueDate;
    if (clientDueDate === null) { 
      if (taskToUpdate.dueDate) { 
        updatePayload.$unset.dueDate = "";
        changedFields++;
      }
    } else if (clientDueDate instanceof Date || typeof clientDueDate === 'string') { 
      const newDueDate = clientDueDate instanceof Date ? clientDueDate : new Date(clientDueDate);
      if (isValid(newDueDate)) {
         if (!taskToUpdate.dueDate || new Date(taskToUpdate.dueDate).getTime() !== newDueDate.getTime()) {
          updatePayload.$set.dueDate = newDueDate;
          changedFields++;
        }
      }
    }
  }
  
  if (rawUpdates.hasOwnProperty('assigneeId')) {
    const clientAssigneeId = rawUpdates.assigneeId; 
    if (clientAssigneeId === null || clientAssigneeId === undefined || clientAssigneeId.trim() === "") { 
      if (taskToUpdate.assigneeId) { 
        updatePayload.$unset.assigneeId = "";
        changedFields++;
      }
    } else { 
        const taskObjective = await ObjectiveCollection.findById(taskToUpdate.objectiveId).populate<{ workspaceId: IWorkspace }>('workspaceId');
        if (!taskObjective || !taskObjective.workspaceId || !(taskObjective.workspaceId as IWorkspace).memberIds) {
            return { error: "No se pudo verificar el espacio de trabajo para el asignado." };
        }
        const workspace = taskObjective.workspaceId as IWorkspace;
        if (!workspace.memberIds.map(id => id.toString()).includes(clientAssigneeId)) {
            return { error: "El asignado no es miembro de este espacio de trabajo." };
        }
        if (!taskToUpdate.assigneeId || taskToUpdate.assigneeId.toString() !== clientAssigneeId) {
            updatePayload.$set.assigneeId = new mongoose.Types.ObjectId(clientAssigneeId);
            changedFields++;
        }
    }
  }

  if (Object.keys(updatePayload.$set).length === 0) delete updatePayload.$set;
  if (Object.keys(updatePayload.$unset).length === 0) delete updatePayload.$unset;

  if (changedFields === 0 && Object.keys(updatePayload.$set).length === 0 && Object.keys(updatePayload.$unset).length === 0) {
     const currentTaskDoc = await TaskCollection.findById(taskId).populate<{ assigneeId: IUser }>('assigneeId', 'email _id').lean();
     if (!currentTaskDoc) return { error: "Tarea no encontrada."};
     return serializeDocument<ITask>(currentTaskDoc) as Task;
  }

  try {
    const updatedTaskDoc = await TaskCollection.findByIdAndUpdate(
      taskId,
      updatePayload,
      { new: true, runValidators: true }
    ).populate<{ assigneeId: IUser }>('assigneeId', 'email _id');

    if (!updatedTaskDoc) {
      return { error: "Tarea no encontrada o actualización fallida." };
    }
    revalidatePath("/");
    return serializeDocument<ITask>(updatedTaskDoc) as Task;
  } catch (error: any) {
    console.error("Error updating task in DB:", error);
    return { error: "No se pudo actualizar la tarea. " + error.message };
  }
}
