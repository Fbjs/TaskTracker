import type { Objective, TaskStatus } from "@/types";
import { KanbanBoard } from "./KanbanBoard";

interface ObjectiveDashboardProps {
  objectives: Objective[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, objectiveId: string) => void;
  onTaskDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  draggingTaskId: string | null;
}

export const ObjectiveDashboard = ({ objectives, onTaskStatusChange, onTaskDragStart, draggingTaskId }: ObjectiveDashboardProps) => {
  if (objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No objectives created yet. Click "Add Objective" to get started.</p>;
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
        />
      ))}
    </div>
  );
};
