
"use client";

import type { Objective, GanttTask, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format, differenceInDays, min, max, addDays } from 'date-fns';

interface GanttChartViewProps {
  objectives: Objective[];
}

const GANTT_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const calculateTaskEnd = (task: Task): Date => {
  if (task.dueDate) return new Date(task.dueDate);
  // Default to 7 days after creation if no due date
  return addDays(new Date(task.createdAt), 7);
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
          start: new Date(task.createdAt),
          end: calculateTaskEnd(task),
        }));

        const allObjectiveDates = objectiveTasks.flatMap(task => [task.start, task.end]);
        const objectiveMinDate = min(allObjectiveDates);
        const objectiveMaxDate = max(allObjectiveDates);
        
        // Ensure minDate and maxDate are different if all tasks have same start/end
        const displayMaxDate = differenceInDays(objectiveMaxDate, objectiveMinDate) === 0 
          ? addDays(objectiveMaxDate, 1) 
          : objectiveMaxDate;

        const chartData = objectiveTasks.map((task, taskIndex) => ({
          taskName: task.name,
          timeRange: [
            differenceInDays(task.start, objectiveMinDate),
            differenceInDays(task.end, objectiveMinDate)
          ],
          id: task.id,
          colorIndex: taskIndex % GANTT_COLORS.length,
          originalTask: task, // Keep original task for tooltip
        }));
        
        const yAxisWidth = Math.max(150, ...chartData.map(d => d.taskName.length * 6)); // Adjust width based on label length


        return (
          <Card key={objective.id} className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">{objective.description}</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-6"> {/* Adjust height as needed per chart */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: yAxisWidth + 10, bottom: 20 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, differenceInDays(displayMaxDate, objectiveMinDate)]}
                    tickFormatter={(tick) => format(addDays(objectiveMinDate, tick), 'MMM d')}
                    label={{ value: "Timeline", position: "insideBottom", offset: -10 }}
                    allowDuplicatedCategory={false}
                  />
                  <YAxis
                    dataKey="taskName"
                    type="category"
                    width={yAxisWidth}
                    tick={{ fontSize: 10, width: yAxisWidth - 5 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(value: [number, number], name, props) => {
                      const task = props.payload.originalTask as GanttTask | undefined;
                      if (!task) return ["Invalid data", ""];
                      const duration = differenceInDays(task.end, task.start);
                      return [
                        `${format(task.start, 'MMM d')} - ${format(task.end, 'MMM d')}`,
                        `Duration: ${Math.max(0,duration)} days` // Ensure duration is not negative
                      ];
                    }}
                    labelFormatter={(label, payload) => {
                       const task = payload?.[0]?.payload?.originalTask as GanttTask | undefined;
                       return `Task: ${task?.name || label}`;
                    }}
                  />
                  <Legend wrapperStyle={{paddingTop: '10px'}}/>
                  <Bar dataKey="timeRange" name="Task Duration">
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
