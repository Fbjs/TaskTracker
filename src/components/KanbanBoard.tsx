import type { Objective, Task, TaskStatus, ALL_TASK_STATUSES } from "@/types";
import { KanbanColumn } from "./KanbanColumn";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface KanbanBoardProps {
  objective: Objective;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => void;
  onTaskDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  draggingTaskId: string | null;
  onEditObjective: (objective: Objective) => void;
  onEditTask: (task: Task, objectiveId: string) => void;
}

const statuses: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];

export const KanbanBoard = ({ objective, onTaskStatusChange, onTaskDragStart, draggingTaskId, onEditObjective, onEditTask }: KanbanBoardProps) => {
  const tasksByStatus = (status: TaskStatus) => {
    return objective.tasks.filter((task) => task.status === status);
  };

  const objectiveProgress = () => {
    if (objective.tasks.length === 0) return 0;
    const doneTasks = objective.tasks.filter(task => task.status === "Done").length;
    return (doneTasks / objective.tasks.length) * 100;
  };

  return (
    <div className="p-4 mb-8 border rounded-lg shadow-lg bg-card">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold font-headline mb-1">{objective.description}</h2>
          <Button variant="ghost" size="icon" onClick={() => onEditObjective(objective)} aria-label="Edit objective">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={objectiveProgress()} className="h-2.5 w-full max-w-md" />
          <span className="text-sm text-muted-foreground">{objectiveProgress().toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus(status)}
            onTaskDrop={(taskId, targetStatus, sourceStatus) => onTaskStatusChange(taskId, targetStatus, sourceStatus, objective.id)}
            onTaskDragStart={onTaskDragStart}
            draggingTaskId={draggingTaskId}
            onEditTask={(task) => onEditTask(task, objective.id)}
          />
        ))}
      </div>
    </div>
  );
};
