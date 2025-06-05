
"use client";

import type { Objective, Task, TaskPriority } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, differenceInDays, addDays, eachDayOfInterval, parseISO, isValid, max } from 'date-fns';

interface CustomGanttChartViewProps {
  objectives: Objective[];
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low: "bg-green-500",
  Medium: "bg-yellow-500",
  High: "bg-red-500",
};

const getValidDate = (dateInput: Date | string | undefined): Date | null => {
  if (!dateInput) return null;
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  return isValid(date) ? date : null;
};

export const CustomGanttChartView = ({ objectives }: CustomGanttChartViewProps) => {
  if (!objectives || objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No objectives to display in Gantt chart.</p>;
  }

  return (
    <div className="space-y-8">
      {objectives.map((objective, objIndex) => {
        const tasksWithDates = objective.tasks.filter(task => {
          const start = getValidDate(task.startDate || task.createdAt);
          const end = getValidDate(task.dueDate);
          // Ensure both start and end dates are valid, and end is not before start
          return start && end && end.getTime() >= start.getTime();
        });

        if (tasksWithDates.length === 0) {
          return (
            <Card key={objective.id} className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline">{objective.description}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">This objective has no tasks with valid start and due dates for Gantt view.</p>
              </CardContent>
            </Card>
          );
        }

        const allStartDates = tasksWithDates.map(t => getValidDate(t.startDate || t.createdAt)!);
        const allEndDates = tasksWithDates.map(t => getValidDate(t.dueDate)!);

        const overallMinDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
        // Ensure overallMaxDate is at least overallMinDate or one day after if they are the same
        let tempOverallMaxDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
        if (isValid(overallMinDate) && isValid(tempOverallMaxDate) && tempOverallMaxDate.getTime() < overallMinDate.getTime()) {
            tempOverallMaxDate = overallMinDate;
        }
        const overallMaxDate = isValid(tempOverallMaxDate) ? tempOverallMaxDate : addDays(overallMinDate,1);


        let chartDays: Date[] = [];
        if (isValid(overallMinDate) && isValid(overallMaxDate) && overallMaxDate.getTime() >= overallMinDate.getTime()) {
           chartDays = eachDayOfInterval({ start: overallMinDate, end: addDays(overallMaxDate, 1) }); 
        } else {
           return (
            <Card key={objective.id} className="shadow-lg">
              <CardHeader><CardTitle className="font-headline">{objective.description}</CardTitle></CardHeader>
              <CardContent><p className="text-destructive">Error: Invalid date range for Gantt chart (Objective: {objective.description}). Min: {overallMinDate.toString()}, Max: {overallMaxDate.toString()}</p></CardContent>
            </Card>
          );
        }
        
        const DAY_WIDTH = 40; 

        return (
          <Card key={objective.id} className="shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="font-headline">{objective.description}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="relative pt-8"> 
                  
                  <div className="flex sticky top-0 z-10 bg-background/80 backdrop-blur-sm mb-1">
                    <div className="sticky left-0 z-20 bg-background/80 backdrop-blur-sm min-w-[150px] md:min-w-[200px] p-2 border-r border-b font-semibold text-xs text-muted-foreground">Task</div>
                    {chartDays.map((day, dayIdx) => (
                      <div
                        key={`day-header-${dayIdx}`}
                        className="flex-shrink-0 text-center p-1 border-r border-b"
                        style={{ width: `${DAY_WIDTH}px` }}
                      >
                        <div className="text-xs text-muted-foreground">{format(day, 'd')}</div>
                        <div className="text-xxs text-muted-foreground/70 -mt-0.5">{format(day, 'MMM')}</div>
                      </div>
                    ))}
                  </div>

                  
                  {tasksWithDates.map((task, taskIdx) => {
                    const taskStart = getValidDate(task.startDate || task.createdAt)!;
                    const taskEnd = getValidDate(task.dueDate)!;

                    // Ensure taskStart is not after taskEnd, if so, make taskEnd same as taskStart for 1 day duration
                    const validatedTaskEnd = taskEnd.getTime() < taskStart.getTime() ? taskStart : taskEnd;

                    const startDayIndex = differenceInDays(taskStart, overallMinDate);
                    
                    // Calculate duration based on validatedTaskEnd
                    const durationDays = Math.max(0, differenceInDays(validatedTaskEnd, taskStart)) + 1; 

                    const barOffset = startDayIndex * DAY_WIDTH;
                    const barWidth = durationDays * DAY_WIDTH - 2; 

                    const priorityColor = PRIORITY_COLORS[task.priority] || 'bg-gray-500';

                    return (
                      <div key={task.id} className="flex items-center border-b hover:bg-muted/30 h-10">
                        <div className="sticky left-0 z-10 bg-background/50 backdrop-blur-sm min-w-[150px] md:min-w-[200px] p-2 text-xs border-r truncate" title={task.description}>
                          {task.description}
                        </div>
                        <div className="relative h-full" style={{ width: `${chartDays.length * DAY_WIDTH}px`}}>
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-6 rounded shadow ${priorityColor}`}
                            style={{
                              left: `${barOffset}px`,
                              width: `${barWidth}px`,
                              minWidth: `${Math.max(0, DAY_WIDTH - 2)}px` // Ensure minWidth is not negative
                            }}
                            title={`${task.description} (${format(taskStart, 'MMM d')} - ${format(validatedTaskEnd, 'MMM d')})`}
                          >
                           {/* Task name removed from here */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Ensure text-xxs is defined in globals.css if not already:
// .text-xxs { font-size: 0.625rem; /* 10px */ }
// Or use an existing Tailwind class like text-[10px]
