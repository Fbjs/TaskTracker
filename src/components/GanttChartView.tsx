
"use client";

import type { Objective, GanttTask, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format, differenceInDays, min, max, addDays, parseISO, isValid } from 'date-fns';

interface GanttChartViewProps {
  objectives: Objective[];
}

const GANTT_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const calculateTaskStart = (task: Task): Date => {
  const startDate = task.startDate ? (task.startDate instanceof Date ? task.startDate : parseISO(task.startDate as unknown as string)) : null;
  if (startDate && isValid(startDate)) return startDate;
  
  const createdAt = task.createdAt ? (task.createdAt instanceof Date ? task.createdAt : parseISO(task.createdAt as unknown as string)) : new Date();
  return isValid(createdAt) ? createdAt : new Date(); // Fallback to now if all else fails
};

const calculateTaskEnd = (task: Task): Date => {
  const dueDate = task.dueDate ? (task.dueDate instanceof Date ? task.dueDate : parseISO(task.dueDate as unknown as string)) : null;
  if (dueDate && isValid(dueDate)) return dueDate;
  
  const taskStart = calculateTaskStart(task);
  // Default to 7 days after start/creation if no due date
  return addDays(taskStart, 7);
};

export const GanttChartView = ({ objectives }: GanttChartViewProps) => {
  if (objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No objectives to display in Gantt chart.</p>;
  }

  return (
    <div className="space-y-8">
      {objectives.map((objective, objIndex) => {
        if (objective.tasks.length === 0) {
          return (
            <Card key={objective.id} className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline">{objective.description}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">This objective has no tasks.</p>
              </CardContent>
            </Card>
          );
        }

        const objectiveTasks: GanttTask[] = objective.tasks.map(task => ({
          ...task, 
          name: task.description,
          start: calculateTaskStart(task),
          end: calculateTaskEnd(task),
        }));

        const allObjectiveDates = objectiveTasks.flatMap(task => [task.start, task.end]);
        if (allObjectiveDates.some(d => !(d instanceof Date) || !isValid(d))) {
          // console.error("Invalid dates found in tasks for objective:", objective.description, objectiveTasks);
          return (
             <Card key={objective.id} className="shadow-lg">
              <CardHeader><CardTitle className="font-headline">{objective.description}</CardTitle></CardHeader>
              <CardContent><p className="text-destructive">Error: Invalid date data for Gantt chart for objective: {objective.description}. Please check task start and due dates.</p></CardContent>
            </Card>
          );
        }

        const objectiveMinDate = min(allObjectiveDates);
        let objectiveMaxDate = max(allObjectiveDates);

        if (differenceInDays(objectiveMaxDate, objectiveMinDate) === 0) {
          objectiveMaxDate = addDays(objectiveMaxDate, 1);
        }
        
        if (!isValid(objectiveMinDate) || !isValid(objectiveMaxDate)) {
           return (
             <Card key={objective.id} className="shadow-lg">
              <CardHeader><CardTitle className="font-headline">{objective.description}</CardTitle></CardHeader>
              <CardContent><p className="text-destructive">Error: Could not determine date range for Gantt chart for objective: {objective.description}.</p></CardContent>
            </Card>
          );
        }


        const chartData = objectiveTasks.map((task, taskIndex) => {
          const startOffset = differenceInDays(task.start, objectiveMinDate);
          const endOffset = differenceInDays(task.end, objectiveMinDate);
          const duration = Math.max(0, endOffset - startOffset) +1; // Duration should be at least 1 day for visibility

          return {
            taskName: task.name,
            ganttOffset: startOffset,    // Offset from objectiveMinDate to task start
            ganttDuration: duration,     // Duration of the task
            id: task.id,
            colorIndex: taskIndex % GANTT_COLORS.length,
            originalTask: task,
          };
        });

        const yAxisWidth = Math.max(150, ...chartData.map(d => d.taskName.length * 7)); 

        return (
          <Card key={objective.id} className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">{objective.description}</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: yAxisWidth - 100, bottom: 20 }} 
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, differenceInDays(objectiveMaxDate, objectiveMinDate) +1]} // +1 to include last day
                    tickFormatter={(tick) => {
                       try {
                        return format(addDays(objectiveMinDate, tick), 'MMM d');
                       } catch (e) { return ''; }
                    }}
                    label={{ value: "Timeline", position: "insideBottom", offset: -10 }}
                    allowDuplicatedCategory={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    dataKey="taskName"
                    type="category"
                    width={yAxisWidth}
                    tick={{ fontSize: 10, width: yAxisWidth - 5 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(value, name, props) => { 
                      const task = props.payload.originalTask as GanttTask | undefined;
                      if (!task || !task.start || !task.end || !isValid(task.start) || !isValid(task.end)) return ["Invalid data", ""];
                      
                      if (name === "Task Duration") {
                        const durationInDays = differenceInDays(task.end, task.start) +1;
                        return [
                          `${format(task.start, 'MMM d')} - ${format(task.end, 'MMM d')}`,
                          `Duration: ${Math.max(1, durationInDays)} day(s)`
                        ];
                      }
                      return null; 
                    }}
                    labelFormatter={(label, payload) => {
                       const task = payload?.[0]?.payload?.originalTask as GanttTask | undefined;
                       return `Task: ${task?.name || label}`;
                    }}
                  />
                  <Legend wrapperStyle={{paddingTop: '10px'}}/>
                  <Bar dataKey="ganttOffset" stackId="a" fill="transparent" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ganttDuration" stackId="a" name="Task Duration" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={`cell-${entry.id}`} fill={GANTT_COLORS[entry.colorIndex]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

