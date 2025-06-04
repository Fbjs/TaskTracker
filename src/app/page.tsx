
"use client";

import { useEffect, useState, useCallback } from "react";
import type { Objective, Task, TaskStatus, AISuggestions } from "@/types";
import { AppHeader } from "@/components/AppHeader";
import { SummaryMetrics } from "@/components/SummaryMetrics";
import { ObjectiveDashboard } from "@/components/ObjectiveDashboard";
import { GanttChartView } from "@/components/GanttChartView";
import { TableView } from "@/components/TableView"; // New import
import { ObjectiveDialog } from "@/components/ObjectiveDialog";
import { TaskDialog } from "@/components/TaskDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, BarChartHorizontalBig, Loader2, ListTree } from "lucide-react"; // Added ListTree
import { getInitialData, updateTaskStatusAction, updateObjectiveAction, updateTaskAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [currentObjectiveIdForTask, setCurrentObjectiveIdForTask] = useState<string | null>(null);

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  const processRawObjective = useCallback((rawObj: Objective): Objective => {
    return {
      ...rawObj,
      tasks: rawObj.tasks.map(task => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        createdAt: new Date(task.createdAt),
      })),
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInitialData();
      setObjectives(data.objectives.map(processRawObjective));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  }, [toast, processRawObjective]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddObjectiveClick = () => {
    setEditingObjective(null);
    setIsObjectiveDialogOpen(true);
  };

  const handleEditObjectiveClick = (objective: Objective) => {
    setEditingObjective(objective);
    setIsObjectiveDialogOpen(true);
  };
  
  const handleObjectiveSaved = (savedObjective: Objective) => {
    const processedSavedObjective = processRawObjective(savedObjective);
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

    const originalObjectives = objectives.map(obj => ({...obj, tasks: [...obj.tasks]})); 

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


  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onAddObjective={handleAddObjectiveClick} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background" onDragEnd={handleTaskDragEnd}>
      <AppHeader onAddObjective={handleAddObjectiveClick} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <SummaryMetrics objectives={objectives} />
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 md:w-auto md:max-w-lg mb-6">
            <TabsTrigger value="dashboard" className="font-body">
              <LayoutGrid className="mr-2 h-4 w-4" /> Board View
            </TabsTrigger>
            <TabsTrigger value="gantt" className="font-body">
              <BarChartHorizontalBig className="mr-2 h-4 w-4" /> Gantt View
            </TabsTrigger>
            <TabsTrigger value="table" className="font-body"> {/* New Tab */}
              <ListTree className="mr-2 h-4 w-4" /> Table View
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <ObjectiveDashboard 
              objectives={objectives} 
              onTaskStatusChange={handleTaskStatusChange}
              onTaskDragStart={handleTaskDragStart}
              draggingTaskId={draggingTaskId}
              onEditObjective={handleEditObjectiveClick}
              onEditTask={handleEditTaskClick}
            />
          </TabsContent>
          <TabsContent value="gantt">
            <GanttChartView objectives={objectives} />
          </TabsContent>
          <TabsContent value="table"> {/* New Tab Content */}
            <TableView objectives={objectives} />
          </TabsContent>
        </Tabs>
      </main>
      <ObjectiveDialog 
        isOpen={isObjectiveDialogOpen} 
        onOpenChange={setIsObjectiveDialogOpen}
        onObjectiveSaved={handleObjectiveSaved}
        objectiveToEdit={editingObjective}
      />
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
