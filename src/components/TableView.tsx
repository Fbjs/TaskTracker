
"use client";

import type { Objective, Task, TaskPriority, TaskStatus, ObjectivePriority } from "@/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { es } from 'date-fns/locale';
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";


const translateStatusToSpanish = (status: TaskStatus): string => {
  switch (status) {
    case "To Do": return "Por Hacer";
    case "In Progress": return "En Progreso";
    case "Blocked": return "Bloqueado";
    case "Done": return "Hecho";
    default: return status;
  }
};

const translateTaskPriorityToSpanish = (priority: TaskPriority): string => {
  switch (priority) {
    case "Low": return "Baja";
    case "Medium": return "Media";
    case "High": return "Alta";
    default: return priority;
  }
};

const translateObjectivePriorityToSpanish = (priority: ObjectivePriority): string => {
  switch (priority) {
    case "Low": return "Baja";
    case "Medium": return "Media";
    case "High": return "Alta";
    default: return priority;
  }
};

const ObjectivePriorityIcons: Record<ObjectivePriority, React.ElementType> = {
  High: ShieldAlert,
  Medium: ShieldCheck,
  Low: ShieldQuestion,
};

const calculateObjectiveProgress = (tasks: Task[]): number => {
  if (!tasks || tasks.length === 0) return 0;
  const doneTasks = tasks.filter(task => task.status === "Done").length;
  return (doneTasks / tasks.length) * 100;
};

interface TableViewProps {
  objectives: Objective[];
}

export const TableView = ({ objectives }: TableViewProps) => {
  if (!objectives || objectives.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground shadow-md">
        No hay objetivos para mostrar. Haz clic en "Añadir Objetivo" para empezar.
      </Card>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-4">
      {objectives.map(objective => {
        const PriorityIcon = ObjectivePriorityIcons[objective.priority || "Medium"];
        return (
          <AccordionItem value={objective.id} key={objective.id} className="border-0">
            <Card className="shadow-lg overflow-hidden">
              <AccordionTrigger className="p-4 hover:no-underline bg-card hover:bg-muted/50 transition-colors rounded-t-lg data-[state=open]:rounded-b-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2 md:gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <PriorityIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" title={`Prioridad: ${translateObjectivePriorityToSpanish(objective.priority || "Medium")}`} />
                    <span className="text-lg font-semibold text-card-foreground text-left break-words">
                      {objective.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[200px] md:max-w-xs">
                    <Progress value={calculateObjectiveProgress(objective.tasks)} className="h-3 flex-grow" aria-label={`Progreso para ${objective.description}`} />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {calculateObjectiveProgress(objective.tasks).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0 border-t bg-card rounded-b-lg">
                {objective.tasks.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Tareas:</h4>
                    <ul className="space-y-3">
                      {objective.tasks.map(task => (
                        <li key={task.id} className="p-3 border rounded-md bg-muted/30 hover:bg-muted/60 transition-colors">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <p className="font-medium text-card-foreground flex-1 break-words">{task.description}</p>
                            <Badge
                              variant={task.status === "Done" ? "default" : (task.status === "Blocked" ? "destructive" : "secondary")}
                              className="whitespace-nowrap capitalize self-start sm:self-center"
                            >
                              {translateStatusToSpanish(task.status)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 space-y-1 sm:space-y-0 sm:flex sm:gap-4">
                            {task.priority && (
                              <span className="block sm:inline"><strong>Prioridad Tarea:</strong> {translateTaskPriorityToSpanish(task.priority)}</span>
                            )}
                            {task.assignee && task.assignee.email && (
                              <span className="block sm:inline"><strong>Asignado a:</strong> {task.assignee.email}</span>
                            )}
                            {task.dueDate && (
                              <span className="block sm:inline">
                                <strong>Vence:</strong> {format(task.dueDate instanceof Date ? task.dueDate : parseISO(task.dueDate as unknown as string), "MMM d, yyyy", { locale: es })}
                              </span>
                            )}
                             {task.startDate && (
                              <span className="block sm:inline">
                                <strong>Inicia:</strong> {format(task.startDate instanceof Date ? task.startDate : parseISO(task.startDate as unknown as string), "MMM d, yyyy", { locale: es })}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No hay tareas para este objetivo.</p>
                )}
              </AccordionContent>
            </Card>
          </AccordionItem>
        )
      })}
    </Accordion>
  );
};
