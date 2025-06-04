
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Objective, Task, TaskStatus, AISuggestions, Workspace } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { SummaryMetrics } from "@/components/SummaryMetrics";
import { ObjectiveDashboard } from "@/components/ObjectiveDashboard";
import { GanttChartView } from "@/components/GanttChartView";
import { TableView } from "@/components/TableView";
import { ObjectiveDialog } from "@/components/ObjectiveDialog";
import { TaskDialog } from "@/components/TaskDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, BarChartHorizontalBig, Loader2, ListTree } from "lucide-react";
import { getInitialData, updateTaskStatusAction, updateObjectiveAction, updateTaskAction, createWorkspaceAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const processRawObjective = useCallback((rawObj: Objective): Objective => {
    return {
      ...rawObj,
      userId: rawObj.userId || user?.id, // Assign current user if not present
      workspaceId: rawObj.workspaceId || currentWorkspace?.id, // Assign current workspace
      tasks: rawObj.tasks.map(task => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        createdAt: new Date(task.createdAt),
      })),
    };
  }, [user?.id, currentWorkspace?.id]);

  const loadData = useCallback(async () => {
    if (!user) return; // Don't load if no user
    setIsLoadingData(true);
    try {
      // In a real app, getInitialData would be scoped by user/workspace
      const data = await getInitialData(user.id); // Pass userId for potential future filtering
      setWorkspaces(data.workspaces.map(ws => ({...ws, ownerId: ws.ownerId || user.id }))); // Ensure ownerId
      
      // Set current workspace (e.g., first one, or last used from localStorage)
      if (data.workspaces.length > 0) {
        const lastSelectedWorkspaceId = localStorage.getItem("tasktracker-lastWorkspace");
        const foundWorkspace = data.workspaces.find(ws => ws.id === lastSelectedWorkspaceId);
        setCurrentWorkspace(foundWorkspace || data.workspaces[0]);
      } else {
        setCurrentWorkspace(null);
      }

      // Objectives will be filtered by currentWorkspace below
      setObjectives(data.objectives.map(processRawObjective));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
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
      toast({ title: "No Workspace", description: "Please select or create a workspace first.", variant: "default"});
      return;
    }
    setEditingObjective(null);
    setIsObjectiveDialogOpen(true);
  };

  const handleEditObjectiveClick = (objective: Objective) => {
    setEditingObjective(objective);
    setIsObjectiveDialogOpen(true);
  };
  
  const handleObjectiveSaved = (savedObjective: Objective) => {
    // Ensure workspaceId is set from currentWorkspace
    const objectiveWithWorkspace = {
      ...savedObjective,
      workspaceId: savedObjective.workspaceId || currentWorkspace?.id,
      userId: savedObjective.userId || user?.id,
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
    const processedSavedTask = {
      ...savedTask,
      dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : undefined,
      createdAt: new Date(savedTask.createdAt),
    };

    setObjectives(prevObjectives =>
      prevObjectives.map(obj => {
        if (obj.id === processedSavedTask.objectiveId) {
          return {
            ...obj,
            tasks: obj.tasks.map(t => t.id === processedSavedTask.id ? processedSavedTask : t),
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
      if (!result.success) {
        setObjectives(originalObjectives.map(processRawObjective)); 
        toast({ title: "Update Failed", description: "Could not update task status.", variant: "destructive" });
      } else {
        toast({ title: "Task Updated", description: `Task moved to ${newStatus}.` });
      }
    } catch (error) {
      setObjectives(originalObjectives.map(processRawObjective)); 
      toast({ title: "Error", description: "An error occurred while updating task status.", variant: "destructive" });
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

  const handleWorkspaceCreated = async (newWorkspaceName: string) => {
    if (!user) return; // Should not happen if this dialog is open
    const result = await createWorkspaceAction(newWorkspaceName, user.id);
    if ("error" in result) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      setWorkspaces(prev => [...prev, result]);
      setCurrentWorkspace(result); // Select the newly created workspace
      toast({ title: "Workspace Created", description: `Workspace "${result.name}" added.` });
      return result; // Return the created workspace
    }
    return undefined;
  };

  const filteredObjectives = objectives.filter(obj => obj.workspaceId === currentWorkspace?.id);

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
          onWorkspaceCreated={(ws) => { /* WorkspaceDialog handles this directly now */ }}
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
        onWorkspaceCreated={(newWs) => { // This callback is for AppHeader if it needs to react
            setWorkspaces(prev => [...prev, newWs]);
            setCurrentWorkspace(newWs);
        }}
      />
      <main className="flex-grow container mx-auto px-4 py-8">
        {!currentWorkspace && workspaces.length > 0 && (
          <div className="text-center py-10 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-3">Welcome, {user?.email}!</h2>
            <p className="text-muted-foreground mb-4">Please select a workspace to get started or create a new one.</p>
          </div>
        )}
        {!currentWorkspace && workspaces.length === 0 && user && (
           <div className="text-center py-10 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-3">Welcome, {user?.email}!</h2>
            <p className="text-muted-foreground mb-4">Create your first workspace to begin organizing your objectives.</p>
            {/* Button to open WorkspaceDialog can be added here if AppHeader's isn't sufficient */}
          </div>
        )}

        {currentWorkspace && (
          <>
            <SummaryMetrics objectives={filteredObjectives} />
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 md:w-auto md:max-w-lg mb-6">
                <TabsTrigger value="dashboard" className="font-body">
                  <LayoutGrid className="mr-2 h-4 w-4" /> Board View
                </TabsTrigger>
                <TabsTrigger value="gantt" className="font-body">
                  <BarChartHorizontalBig className="mr-2 h-4 w-4" /> Gantt View
                </TabsTrigger>
                <TabsTrigger value="table" className="font-body">
                  <ListTree className="mr-2 h-4 w-4" /> Table View
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <ObjectiveDashboard 
                  objectives={filteredObjectives} 
                  onTaskStatusChange={handleTaskStatusChange}
                  onTaskDragStart={handleTaskDragStart}
                  draggingTaskId={draggingTaskId}
                  onEditObjective={handleEditObjectiveClick}
                  onEditTask={handleEditTaskClick}
                />
              </TabsContent>
              <TabsContent value="gantt">
                <GanttChartView objectives={filteredObjectives} />
              </TabsContent>
              <TabsContent value="table">
                <TableView objectives={filteredObjectives} />
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
          // Pass workspaceId and userId to the dialog if it's adapted to use them
          // For now, they are added in processRawObjective and handleObjectiveSaved
          currentWorkspaceId={currentWorkspace?.id}
          currentUserId={user?.id}
        />
      )}
      {editingTask && currentObjectiveIdForTask && (
        <TaskDialog
          isOpen={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          task={editingTask}
          objectiveId={currentObjectiveIdForTask}
          onTaskSaved={handleTaskSaved}
        />
      )}
    </div>
  );
}
