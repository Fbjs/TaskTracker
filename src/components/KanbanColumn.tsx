
import type { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskDrop: (taskId: string, targetStatus: TaskStatus, sourceStatus: TaskStatus) => void;
  onTaskDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  draggingTaskId: string | null;
  onEditTask: (task: Task) => void;
}

const translateStatusToSpanish = (status: TaskStatus): string => {
  switch (status) {
    case "To Do": return "Por Hacer";
    case "In Progress": return "En Progreso";
    case "Blocked": return "Bloqueado";
    case "Done": return "Hecho";
    default: return status;
  }
};

export const KanbanColumn = ({ status, tasks, onTaskDrop, onTaskDragStart, draggingTaskId, onEditTask }: KanbanColumnProps) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const sourceStatus = e.dataTransfer.getData("sourceStatus") as TaskStatus;
    if (taskId && sourceStatus) {
       onTaskDrop(taskId, status, sourceStatus);
    }
  };

  return (
    <Card 
      className="flex-1 min-w-[280px] max-w-[320px] h-full flex flex-col bg-muted/50 shadow-inner"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardHeader className="p-3 border-b">
        <CardTitle className="text-md font-semibold font-headline capitalize">{translateStatusToSpanish(status)}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex-grow overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aún no hay tareas.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onDragStart={onTaskDragStart}
              isDragging={draggingTaskId === task.id}
              onEditTask={onEditTask}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
