
import type { Objective, Task, TaskStatus } from "@/types";
import { KanbanBoard } from "./KanbanBoard";

interface ObjectiveDashboardProps {
  objectives: Objective[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => void;
  onTaskDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  draggingTaskId: string | null;
  onEditObjective: (objective: Objective) => void;
  onEditTask: (task: Task, objectiveId: string) => void;
}

export const ObjectiveDashboard = ({ objectives, onTaskStatusChange, onTaskDragStart, draggingTaskId, onEditObjective, onEditTask }: ObjectiveDashboardProps) => {
  if (objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">Aún no hay objetivos creados. Haz clic en "Añadir Objetivo" para empezar.</p>;
  }

  return (
    <div className="space-y-6">
      {objectives.map((objective) => (
        <KanbanBoard 
          key={objective.id} 
          objective={objective} 
          onTaskStatusChange={onTaskStatusChange}
          onTaskDragStart={onTaskDragStart}
          draggingTaskId={draggingTaskId}
          onEditObjective={onEditObjective}
          onEditTask={onEditTask}
        />
      ))}
    </div>
  );
};
