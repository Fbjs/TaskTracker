
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, User, GripVertical, AlertTriangle, CheckCircle, CircleDot, Circle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { es } from 'date-fns/locale';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, sourceStatus: TaskStatus) => void;
  onEditTask: (task: Task) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  Low: "bg-green-500 hover:bg-green-600",
  Medium: "bg-yellow-500 hover:bg-yellow-600",
  High: "bg-red-500 hover:bg-red-600",
};

const translateStatusToSpanish = (status: TaskStatus): string => {
  switch (status) {
    case "To Do": return "Por Hacer";
    case "In Progress": return "En Progreso";
    case "Blocked": return "Bloqueado";
    case "Done": return "Hecho";
    default: return status;
  }
};

const translatePriorityToSpanish = (priority: TaskPriority): string => {
  switch (priority) {
    case "Low": return "Baja";
    case "Medium": return "Media";
    case "High": return "Alta";
    default: return priority;
  }
};

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  "To Do": <Circle className="h-4 w-4" />,
  "In Progress": <CircleDot className="h-4 w-4 text-blue-500" />,
  "Blocked": <AlertTriangle className="h-4 w-4 text-orange-500" />,
  "Done": <CheckCircle className="h-4 w-4 text-green-500" />,
};

export const TaskCard = ({ task, isDragging, onDragStart, onEditTask }: TaskCardProps) => {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task.id, task.status)}
      className={`mb-3 p-0.5 cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition-all duration-200 ease-in-out ${isDragging ? "opacity-50 ring-2 ring-accent" : ""}`}
    >
      <CardHeader className="p-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium font-body leading-tight break-words w-[calc(100%-3rem)]">{task.description}</CardTitle>
          <div className="flex flex-col items-end gap-1">
            <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 cursor-grab" />
            <Button variant="ghost" size="icon" className="h-6 w-6 mt-1" onClick={() => onEditTask(task)} aria-label="Editar tarea">
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            {statusIcons[task.status]}
            {translateStatusToSpanish(task.status)}
          </Badge>
          <Badge className={`${priorityColors[task.priority]} text-white`}>{translatePriorityToSpanish(task.priority)}</Badge>
        </div>
        {task.dueDate && (
          <div className="flex items-center text-muted-foreground mb-1">
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>{format(new Date(task.dueDate), "MMM d, yyyy", { locale: es })}</span>
          </div>
        )}
        {task.assignee && task.assignee.email && (
          <div className="flex items-center text-muted-foreground">
            <User className="mr-2 h-4 w-4" />
            <span>{task.assignee.email}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
