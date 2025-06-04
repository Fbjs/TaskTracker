"use client";

import { useEffect, useState, useCallback } from "react";
import type { Objective, Task, TaskStatus, AISuggestions } from "@/types";
import { AppHeader } from "@/components/AppHeader";
import { SummaryMetrics } from "@/components/SummaryMetrics";
import { ObjectiveDashboard } from "@/components/ObjectiveDashboard";
import { GanttChartView } from "@/components/GanttChartView";
import { ObjectiveDialog } from "@/components/ObjectiveDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, BarChartHorizontalBig, Loader2 } from "lucide-react";
import { getInitialData, updateTaskStatusAction, addObjectiveAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInitialData();
      // Ensure dates are Date objects
      const processedObjectives = data.objectives.map(obj => ({
        ...obj,
        tasks: obj.tasks.map(task => ({
          ...task,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          createdAt: new Date(task.createdAt),
        })),
      }));
      setObjectives(processedObjectives);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddObjective = () => {
    setIsObjectiveDialogOpen(true);
  };

  const handleObjectiveAdded = (newObjectiveData: Objective) => {
     // Process dates for the new objective
    const processedNewObjective = {
      ...newObjectiveData,
      tasks: newObjectiveData.tasks.map(task => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        createdAt: new Date(task.createdAt),
      })),
    };
    setObjectives(prev => [...prev, processedNewObjective]);
    setIsObjectiveDialogOpen(false); // Close dialog after adding
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => {
    if (newStatus === oldStatus) return;

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
        // Revert UI change if server update fails
        setObjectives(prevObjectives =>
          prevObjectives.map(obj =>
            obj.id === objectiveId
              ? {
                  ...obj,
                  tasks: obj.tasks.map(task =>
                    task.id === taskId ? { ...task, status: oldStatus } : task
                  ),
                }
              : obj
          )
        );
        toast({ title: "Update Failed", description: "Could not update task status.", variant: "destructive" });
      } else {
        toast({ title: "Task Updated", description: `Task moved to ${newStatus}.` });
      }
    } catch (error) {
      // Revert UI change on error
      setObjectives(prevObjectives =>
        prevObjectives.map(obj =>
          obj.id === objectiveId
            ? {
                ...obj,
                tasks: obj.tasks.map(task =>
                  task.id === taskId ? { ...task, status: oldStatus } : task
                ),
              }
            : obj
        )
      );
      toast({ title: "Error", description: "An error occurred while updating task status.", variant: "destructive" });
    }
  };

  const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("sourceStatus", sourceStatus);
    setDraggingTaskId(taskId);
    // Add a subtle drag image if desired
    // e.dataTransfer.setDragImage(e.currentTarget, 0, 0); 
  };
  
  const handleTaskDragEnd = () => {
    setDraggingTaskId(null);
  };


  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onAddObjective={handleAddObjective} />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background" onDragEnd={handleTaskDragEnd}>
      <AppHeader onAddObjective={handleAddObjective} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <SummaryMetrics objectives={objectives} />
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[300px] mb-6">
            <TabsTrigger value="dashboard" className="font-body">
              <LayoutGrid className="mr-2 h-4 w-4" /> Board View
            </TabsTrigger>
            <TabsTrigger value="gantt" className="font-body">
              <BarChartHorizontalBig className="mr-2 h-4 w-4" /> Gantt View
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <ObjectiveDashboard 
              objectives={objectives} 
              onTaskStatusChange={handleTaskStatusChange}
              onTaskDragStart={handleTaskDragStart}
              draggingTaskId={draggingTaskId}
            />
          </TabsContent>
          <TabsContent value="gantt">
            <GanttChartView objectives={objectives} />
          </TabsContent>
        </Tabs>
      </main>
      <ObjectiveDialog 
        isOpen={isObjectiveDialogOpen} 
        onOpenChange={setIsObjectiveDialogOpen}
        onObjectiveAdded={handleObjectiveAdded}
      />
    </div>
  );
}
