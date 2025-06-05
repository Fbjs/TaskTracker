
"use client";

import type { Objective, Task, TaskPriority } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, differenceInDays, addDays, eachDayOfInterval, parseISO, isValid, startOfDay } from 'date-fns';

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

const DAY_WIDTH = 40; // pixels - Reverted to 40 if it was changed, for consistency.

export const CustomGanttChartView = ({ objectives }: CustomGanttChartViewProps) => {
  if (!objectives || objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No objectives to display in Gantt chart.</p>;
  }

  return (
    <div className="space-y-8">
      {objectives.map((objective) => {
        const tasksWithDates = objective.tasks.filter(task => {
          const start = getValidDate(task.startDate || task.createdAt);
          const end = getValidDate(task.dueDate);
          // Ensure start and end dates are valid and end is not before start (at the day level)
          return start && end && startOfDay(end).getTime() >= startOfDay(start).getTime();
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

        const allTaskStartDates = tasksWithDates.map(t => startOfDay(getValidDate(t.startDate || t.createdAt)!));
        const allTaskEndDates = tasksWithDates.map(t => startOfDay(getValidDate(t.dueDate)!));

        let overallMinDate = startOfDay(new Date(Math.min(...allTaskStartDates.map(d => d.getTime()))));
        let tempOverallMaxDate = startOfDay(new Date(Math.max(...allTaskEndDates.map(d => d.getTime()))));
        
        // Fallbacks and validation for date range
        if (!isValid(overallMinDate) && tasksWithDates.length > 0) {
            overallMinDate = startOfDay(getValidDate(tasksWithDates[0].startDate || tasksWithDates[0].createdAt)!);
        }
        if (!isValid(tempOverallMaxDate) && tasksWithDates.length > 0) {
            tempOverallMaxDate = startOfDay(getValidDate(tasksWithDates[0].dueDate)!);
             if (!isValid(tempOverallMaxDate) && isValid(overallMinDate)) tempOverallMaxDate = overallMinDate;
        }
        if (isValid(overallMinDate) && isValid(tempOverallMaxDate) && tempOverallMaxDate.getTime() < overallMinDate.getTime()) {
            tempOverallMaxDate = overallMinDate;
        }
        
        const overallMaxDate = tempOverallMaxDate;

        let chartDays: Date[] = [];
        if (isValid(overallMinDate) && isValid(overallMaxDate) && overallMaxDate.getTime() >= overallMinDate.getTime()) {
           // Ensure the range ends on the last day, not the day after.
           chartDays = eachDayOfInterval({ start: overallMinDate, end: overallMaxDate }); 
        } else {
           if (isValid(overallMinDate)) chartDays = [overallMinDate];
           else if (isValid(overallMaxDate)) { 
             chartDays = [overallMaxDate];
             overallMinDate = overallMaxDate;
           } else { 
             return (
                  <Card key={objective.id} className="shadow-lg">
                    <CardHeader><CardTitle className="font-headline">{objective.description}</CardTitle></CardHeader>
                    <CardContent><p className="text-destructive">Error: Invalid date range for Gantt chart header (Objective: {objective.description}).</p></CardContent>
                  </Card>
                );
           }
        }

        return (
          <Card key={objective.id} className="shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="font-headline">{objective.description}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="relative pt-8">

                  {/* Header Row */}
                  <div className="flex sticky top-0 z-10 bg-background/80 backdrop-blur-sm mb-1">
                    {/* Fixed Task Header Cell */}
                    <div className="sticky left-0 z-20 bg-background/80 backdrop-blur-sm w-[200px] md:w-[300px] flex-shrink-0 p-2 border-r border-b font-semibold text-xs text-muted-foreground">Task</div>
                    {/* Date Headers */}
                    {chartDays.map((day, dayIdx) => (
                      <div
                        key={`day-header-${objective.id}-${dayIdx}`}
                        className="flex-shrink-0 text-center p-1 border-r border-b"
                        style={{ width: `${DAY_WIDTH}px` }}
                      >
                        <div className="text-xs text-muted-foreground">{format(day, 'd')}</div>
                        <div className="text-xxs text-muted-foreground/70 -mt-0.5">{format(day, 'MMM')}</div>
                      </div>
                    ))}
                  </div>

                  {/* Task Rows */}
                  {tasksWithDates.map((task) => {
                    const taskStartRaw = getValidDate(task.startDate || task.createdAt)!;
                    const taskEndRaw = getValidDate(task.dueDate)!;

                    // Normalize dates to the start of the day for calculations
                    const taskStart = startOfDay(taskStartRaw);
                    const taskEnd = startOfDay(taskEndRaw);

                    // Ensure task end is not before task start for duration calculation
                    const validatedTaskEnd = taskEnd.getTime() < taskStart.getTime() ? taskStart : taskEnd;

                    const startDayIndex = differenceInDays(taskStart, overallMinDate);
                    const durationDays = Math.max(1, differenceInDays(validatedTaskEnd, taskStart) + 1); 

                    const barOffset = startDayIndex * DAY_WIDTH;
                    const barWidth = (durationDays * DAY_WIDTH) -1 ; // -1 to fit within day cell borders

                    const priorityColor = PRIORITY_COLORS[task.priority] || 'bg-gray-400';

                    return (
                      <div key={task.id} className="flex items-center border-b hover:bg-muted/30 h-10">
                        {/* Fixed Task Description Cell */}
                        <div
                          className="sticky left-0 z-10 bg-background/50 backdrop-blur-sm w-[200px] md:w-[300px] flex-shrink-0 p-2 text-xs border-r truncate"
                          title={task.description}
                        >
                          {task.description}
                        </div>
                        {/* Bar Container */}
                        <div className="relative h-full" style={{ width: `${chartDays.length * DAY_WIDTH}px`}}>
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-6 rounded shadow-md ${priorityColor}`}
                            style={{
                              left: `${barOffset}px`,
                              width: `${Math.max(0, barWidth)}px`, // Ensure width is not negative
                            }}
                            title={`${format(taskStartRaw, 'MMM d')} - ${format(taskEndRaw, 'MMM d')}`}
                          >
                            {/* Text removed from inside the bar */}
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
