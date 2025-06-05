
"use client";

import type { Objective, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, differenceInDays, addDays, eachDayOfInterval, parseISO, isValid } from 'date-fns';

interface CustomGanttChartViewProps {
  objectives: Objective[];
}

const GANTT_TASK_COLORS = [
  'bg-sky-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

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
          return start && end && end >= start;
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
        const overallMaxDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));
        
        let chartDays: Date[] = [];
        if (isValid(overallMinDate) && isValid(overallMaxDate) && overallMaxDate >= overallMinDate) {
           chartDays = eachDayOfInterval({ start: overallMinDate, end: addDays(overallMaxDate, 1) }); // Add 1 day to include end date fully
        } else {
           return (
            <Card key={objective.id} className="shadow-lg">
              <CardHeader><CardTitle className="font-headline">{objective.description}</CardTitle></CardHeader>
              <CardContent><p className="text-destructive">Error: Invalid date range for Gantt chart.</p></CardContent>
            </Card>
          );
        }
        
        const DAY_WIDTH = 40; // Width of each day cell in pixels

        return (
          <Card key={objective.id} className="shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="font-headline">{objective.description}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="relative pt-8"> {/* Space for date headers */}
                  {/* Date Headers */}
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

                  {/* Task Rows */}
                  {tasksWithDates.map((task, taskIdx) => {
                    const taskStart = getValidDate(task.startDate || task.createdAt)!;
                    const taskEnd = getValidDate(task.dueDate)!;

                    const startDayIndex = differenceInDays(taskStart, overallMinDate);
                    const endDayIndex = differenceInDays(taskEnd, overallMinDate);
                    const durationDays = Math.max(0, differenceInDays(taskEnd, taskStart)) + 1; // Inclusive of start and end day

                    const barOffset = startDayIndex * DAY_WIDTH;
                    const barWidth = durationDays * DAY_WIDTH - 2; // -2 for slight padding within cells

                    return (
                      <div key={task.id} className="flex items-center border-b hover:bg-muted/30 h-10">
                        <div className="sticky left-0 z-10 bg-background/50 backdrop-blur-sm min-w-[150px] md:min-w-[200px] p-2 text-xs border-r truncate" title={task.description}>
                          {task.description}
                        </div>
                        <div className="relative h-full" style={{ width: `${chartDays.length * DAY_WIDTH}px`}}>
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-6 rounded text-white text-xs flex items-center px-2 truncate shadow ${GANTT_TASK_COLORS[taskIdx % GANTT_TASK_COLORS.length]}`}
                            style={{
                              left: `${barOffset}px`,
                              width: `${barWidth}px`,
                              minWidth: `${DAY_WIDTH -2}px`
                            }}
                            title={`${task.description} (${format(taskStart, 'MMM d')} - ${format(taskEnd, 'MMM d')})`}
                          >
                           {task.description}
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

// Helper for extra small text, if needed
// Add to globals.css if used:
// .text-xxs { font-size: 0.625rem; /* 10px */ }
