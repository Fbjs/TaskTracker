
import type { Objective, Task, TaskStatus, ObjectivePriority } from "@/types";
import { KanbanColumn } from "./KanbanColumn";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

interface KanbanBoardProps {
  objective: Objective;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => void;
  onTaskDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  draggingTaskId: string | null;
  onEditObjective: (objective: Objective) => void;
  onEditTask: (task: Task, objectiveId: string) => void;
}

const statuses: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];

const objectivePriorityTranslations: Record<ObjectivePriority, string> = {
  "High": "Alta",
  "Medium": "Media",
  "Low": "Baja",
};

const ObjectivePriorityIcons: Record<ObjectivePriority, React.ElementType> = {
  High: ShieldAlert,
  Medium: ShieldCheck,
  Low: ShieldQuestion,
};

const objectivePriorityColors: Record<ObjectivePriority, string> = {
  High: "bg-red-500 hover:bg-red-600 border-red-500",
  Medium: "bg-yellow-500 hover:bg-yellow-600 border-yellow-500",
  Low: "bg-green-500 hover:bg-green-600 border-green-500",
};


export const KanbanBoard = ({ objective, onTaskStatusChange, onTaskDragStart, draggingTaskId, onEditObjective, onEditTask }: KanbanBoardProps) => {
  const tasksByStatus = (status: TaskStatus) => {
    return objective.tasks.filter((task) => task.status === status);
  };

  const objectiveProgress = () => {
    if (objective.tasks.length === 0) return 0;
    const doneTasks = objective.tasks.filter(task => task.status === "Done").length;
    return (doneTasks / objective.tasks.length) * 100;
  };

  const PriorityIcon = ObjectivePriorityIcons[objective.priority || "Medium"];

  return (
    <div className="p-4 mb-8 border rounded-lg shadow-lg bg-card">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold font-headline mb-1">{objective.description}</h2>
            {objective.priority && (
              <Badge 
                className={`${objectivePriorityColors[objective.priority]} text-white text-xs`}
                title={`Prioridad: ${objectivePriorityTranslations[objective.priority]}`}
              >
                <PriorityIcon className="h-3.5 w-3.5 mr-1" />
                {objectivePriorityTranslations[objective.priority]}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onEditObjective(objective)} aria-label="Editar objetivo">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
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
