
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Objective, Task, TaskStatus, AISuggestions, Workspace, ObjectivePriority } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { SummaryMetrics } from "@/components/SummaryMetrics";
import { ObjectiveDashboard } from "@/components/ObjectiveDashboard";
import { CustomGanttChartView } from "@/components/CustomGanttChartView";
import { TableView } from "@/components/TableView";
import { ObjectiveDialog } from "@/components/ObjectiveDialog";
import { TaskDialog } from "@/components/TaskDialog";
import { ManageMembersDialog } from "@/components/ManageMembersDialog"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, BarChartHorizontalBig, Loader2, ListTree, Users } from "lucide-react"; 
import { getInitialData, updateTaskStatusAction, addObjectiveAction, updateObjectiveAction, updateTaskAction, createWorkspaceAction } from "@/app/actions"; // Added addObjectiveAction
import { useToast } from "@/hooks/use-toast";


const priorityOrder: Record<ObjectivePriority, number> = {
  High: 1,
  Medium: 2,
  Low: 3,
};

export default function Home() {
  const { user, isLoading: authIsLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [currentObjectiveIdForTask, setCurrentObjectiveIdForTask] = useState<string | null>(null);
  
  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false); 

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const processSingleTask = useCallback((task: Task): Task => {
    return {
      ...task,
      startDate: task.startDate ? new Date(task.startDate) : undefined,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
    };
  }, []);
  
  const processRawObjective = useCallback((rawObj: Objective): Objective => {
    return {
      ...rawObj,
      userId: rawObj.userId || user?.id, 
      workspaceId: rawObj.workspaceId || currentWorkspace?.id, 
      priority: rawObj.priority || "Medium", // Default priority
      isArchived: rawObj.isArchived || false, // Default isArchived
      createdAt: rawObj.createdAt ? new Date(rawObj.createdAt) : new Date(),
      tasks: rawObj.tasks?.map(processSingleTask) || [],
    };
  }, [user?.id, currentWorkspace?.id, processSingleTask]);


  const loadData = useCallback(async () => {
    if (!user) return; 
    setIsLoadingData(true);
    try {
      const data = await getInitialData(user.id); 
      setWorkspaces(data.workspaces.map(ws => ({...ws, ownerId: ws.ownerId || user.id, memberIds: ws.memberIds || [user.id] })));
      
      if (data.workspaces.length > 0) {
        const lastSelectedWorkspaceId = localStorage.getItem("tasktracker-lastWorkspace");
        const foundWorkspace = data.workspaces.find(ws => ws.id === lastSelectedWorkspaceId);
        setCurrentWorkspace(foundWorkspace || data.workspaces[0]);
      } else {
        setCurrentWorkspace(null); 
      }

      setObjectives(data.objectives.map(processRawObjective));
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
      console.error("Failed to load data", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [user, toast, processRawObjective]);

  useEffect(() => {
    if (!authIsLoading && !user) {
      router.push("/login");
    } else if (user) {
      loadData();
    }
  }, [authIsLoading, user, router, loadData]);
  
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem("tasktracker-lastWorkspace", currentWorkspace.id);
    }
  }, [currentWorkspace]);

  const handleAddObjectiveClick = () => {
    if (!currentWorkspace) {
      toast({ title: "Sin Espacio de Trabajo", description: "Por favor, selecciona o crea un espacio de trabajo primero.", variant: "default"});
      return;
    }
    setEditingObjective(null);
    setIsObjectiveDialogOpen(true);
  };

  const handleEditObjectiveClick = (objective: Objective) => {
    setEditingObjective(objective);
    setIsObjectiveDialogOpen(true);
  };
  
  const handleObjectiveSaved = (savedObjectiveResult: Objective | { error: string }) => {
     if ("error" in savedObjectiveResult) {
      toast({ title: "Error", description: savedObjectiveResult.error, variant: "destructive" });
      return;
    }
    const savedObjective = savedObjectiveResult;
    const objectiveWithWorkspace = {
      ...savedObjective,
      workspaceId: savedObjective.workspaceId || currentWorkspace?.id,
      userId: savedObjective.userId || user?.id,
      priority: savedObjective.priority || "Medium",
      isArchived: savedObjective.isArchived || false,
      createdAt: savedObjective.createdAt ? new Date(savedObjective.createdAt) : new Date(),
    };
    const processedSavedObjective = processRawObjective(objectiveWithWorkspace);
    if (editingObjective) {
      setObjectives(prev => prev.map(obj => obj.id === processedSavedObjective.id ? processedSavedObjective : obj));
    } else {
      setObjectives(prev => [...prev, processedSavedObjective]);
    }
    setIsObjectiveDialogOpen(false);
    setEditingObjective(null);
  };

  const handleEditTaskClick = (task: Task, objectiveId: string) => {
    setEditingTask(task);
    setCurrentObjectiveIdForTask(objectiveId);
    setIsTaskDialogOpen(true);
  };

  const handleTaskSaved = (savedTask: Task) => {
     const processedSavedTask = processSingleTask(savedTask);

    setObjectives(prevObjectives =>
      prevObjectives.map(obj => {
        if (obj.id === processedSavedTask.objectiveId) {
          const taskExists = obj.tasks.some(t => t.id === processedSavedTask.id);
          return {
            ...obj,
            tasks: taskExists 
                    ? obj.tasks.map(t => t.id === processedSavedTask.id ? processedSavedTask : t)
                    : [...obj.tasks, processedSavedTask], 
          };
        }
        return obj;
      })
    );
    setIsTaskDialogOpen(false);
    setEditingTask(null);
    setCurrentObjectiveIdForTask(null);
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => {
    if (newStatus === oldStatus) return;
    const originalObjectives = JSON.parse(JSON.stringify(objectives)); 

    setObjectives(prevObjectives =>
      prevObjectives.map(obj =>
        obj.id === objectiveId
          ? {
              ...obj,
              tasks: obj.tasks.map(task =>
                task.id === taskId ? { ...task, status: newStatus } : task
              ),
            }
          : obj
      )
    );

    try {
      const result = await updateTaskStatusAction(taskId, newStatus, objectiveId);
      if (!result.success || !result.task) {
        setObjectives(originalObjectives.map(processRawObjective)); 
        toast({ title: "Actualización Fallida", description: result.error || "No se pudo actualizar el estado de la tarea.", variant: "destructive" });
      } else {
        
        setObjectives(prevObjectives =>
          prevObjectives.map(obj =>
            obj.id === objectiveId
              ? {
                  ...obj,
                  tasks: obj.tasks.map(t =>
                    t.id === taskId ? processSingleTask(result.task!) : t 
                  ),
                }
              : obj
          )
        );
        toast({ title: "Tarea Actualizada", description: `Tarea movida a ${newStatus}.` });
      }
    } catch (error) {
      setObjectives(originalObjectives.map(processRawObjective)); 
      toast({ title: "Error", description: "Ocurrió un error al actualizar el estado de la tarea.", variant: "destructive" });
    }
  };

  const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("sourceStatus", sourceStatus);
    setDraggingTaskId(taskId);
  };
  
  const handleTaskDragEnd = () => {
    setDraggingTaskId(null);
  };

  const handleWorkspaceSelected = (workspaceId: string) => {
    const selected = workspaces.find(ws => ws.id === workspaceId);
    if (selected) {
      setCurrentWorkspace(selected);
    }
  };

  const handleWorkspaceCreated = (newWs: Workspace) => {
    setWorkspaces(prev => [...prev, newWs]);
    setCurrentWorkspace(newWs);
  };

  const handleOpenManageMembers = () => {
    if (!currentWorkspace) {
      toast({ title: "Ningún Espacio de Trabajo Seleccionado", description: "Por favor, selecciona un espacio de trabajo para administrar sus miembros.", variant: "default"});
      return;
    }
    setIsManageMembersDialogOpen(true);
  };
  
  const handleMembersChanged = (updatedWorkspace: Workspace) => {
    setWorkspaces(prev => prev.map(ws => ws.id === updatedWorkspace.id ? updatedWorkspace : ws));
    if (currentWorkspace?.id === updatedWorkspace.id) {
      setCurrentWorkspace(updatedWorkspace);
    }
    loadData();
  };


  const filteredAndSortedObjectives = objectives
    .filter(obj => obj.workspaceId === currentWorkspace?.id && !obj.isArchived)
    .sort((a, b) => {
      const priorityComparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityComparison !== 0) {
        return priorityComparison;
      }
      // Orden secundario por fecha de creación (más recientes primero)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });


  if (authIsLoading || (!user && !authIsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  if (isLoadingData && user) {
     return (
      <div className="flex flex-col min-h-screen">
        <AppHeader 
          onAddObjective={handleAddObjectiveClick} 
          workspaces={workspaces}
          currentWorkspace={currentWorkspace || undefined}
          onWorkspaceSelected={handleWorkspaceSelected}
          onWorkspaceCreated={handleWorkspaceCreated}
          onManageMembers={handleOpenManageMembers} 
        />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background" onDragEnd={handleTaskDragEnd}>
      <AppHeader 
        onAddObjective={handleAddObjectiveClick} 
        workspaces={workspaces}
        currentWorkspace={currentWorkspace || undefined}
        onWorkspaceSelected={handleWorkspaceSelected}
        onWorkspaceCreated={handleWorkspaceCreated}
        onManageMembers={handleOpenManageMembers} 
      />
      <main className="flex-grow container mx-auto px-4 py-8">
        {!currentWorkspace && workspaces.length > 0 && (
          <div className="text-center py-10 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-3">¡Bienvenido, {user?.email}!</h2>
            <p className="text-muted-foreground mb-4">Por favor, selecciona un espacio de trabajo para comenzar o crea uno nuevo.</p>
          </div>
        )}
        {!currentWorkspace && workspaces.length === 0 && user && (
           <div className="text-center py-10 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-3">¡Bienvenido, {user?.email}!</h2>
            <p className="text-muted-foreground mb-4">Crea tu primer espacio de trabajo para empezar a organizar tus objetivos.</p>
          </div>
        )}

        {currentWorkspace && (
          <>
            <SummaryMetrics objectives={filteredAndSortedObjectives} />
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 md:w-auto md:max-w-lg mb-6">
                <TabsTrigger value="dashboard" className="font-body">
                  <LayoutGrid className="mr-2 h-4 w-4" /> Vista Tablero
                </TabsTrigger>
                <TabsTrigger value="gantt" className="font-body">
                  <BarChartHorizontalBig className="mr-2 h-4 w-4" /> Vista Gantt
                </TabsTrigger>
                <TabsTrigger value="table" className="font-body">
                  <ListTree className="mr-2 h-4 w-4" /> Vista Tabla
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <ObjectiveDashboard 
                  objectives={filteredAndSortedObjectives} 
                  onTaskStatusChange={handleTaskStatusChange}
                  onTaskDragStart={handleTaskDragStart}
                  draggingTaskId={draggingTaskId}
                  onEditObjective={handleEditObjectiveClick}
                  onEditTask={handleEditTaskClick}
                />
              </TabsContent>
              <TabsContent value="gantt">
                <CustomGanttChartView objectives={filteredAndSortedObjectives} />
              </TabsContent>
              <TabsContent value="table">
                <TableView objectives={filteredAndSortedObjectives} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      {currentWorkspace && (
        <ObjectiveDialog 
          isOpen={isObjectiveDialogOpen} 
          onOpenChange={setIsObjectiveDialogOpen}
          onObjectiveSaved={handleObjectiveSaved}
          objectiveToEdit={editingObjective}
          currentWorkspaceId={currentWorkspace?.id}
          currentUserId={user?.id}
        />
      )}
      {editingTask && currentObjectiveIdForTask && currentWorkspace && ( 
        <TaskDialog
          isOpen={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          task={editingTask}
          objectiveId={currentObjectiveIdForTask}
          onTaskSaved={handleTaskSaved}
          currentWorkspaceId={currentWorkspace.id} 
        />
      )}
      {currentWorkspace && user && ( 
         <ManageMembersDialog
          isOpen={isManageMembersDialogOpen}
          onOpenChange={setIsManageMembersDialogOpen}
          workspace={currentWorkspace}
          currentUserId={user.id}
          onMembersChanged={handleMembersChanged}
        />
      )}
    </div>
  );
}
