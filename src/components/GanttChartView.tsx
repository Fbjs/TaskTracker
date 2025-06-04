"use client";

import type { Objective, GanttTask } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format, differenceInDays, min, max } from 'date-fns';

interface GanttChartViewProps {
  objectives: Objective[];
}

const transformObjectivesToGanttData = (objectives: Objective[]): { name: string; tasks: GanttTask[] }[] => {
  return objectives.map(obj => ({
    name: obj.description,
    tasks: obj.tasks.map(task => ({
      ...task,
      name: task.description,
      start: task.createdAt, 
      end: task.dueDate || new Date(new Date(task.createdAt).setDate(new Date(task.createdAt).getDate() + 7)), // Default 7 days if no due date
    }))
  }));
};

// Color utility for Gantt bars
const GANTT_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const GanttChartView = ({ objectives }: GanttChartViewProps) => {
  const ganttData = transformObjectivesToGanttData(objectives);

  if (objectives.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No objectives to display in Gantt chart.</p>;
  }

  // Flatten all tasks to find overall date range for the chart
  const allTasks = ganttData.flatMap(obj => obj.tasks);
  if (allTasks.length === 0) {
     return <p className="text-center text-muted-foreground py-10">No tasks to display in Gantt chart.</p>;
  }

  const allDates = allTasks.flatMap(task => [new Date(task.start), new Date(task.end)]);
  const minDate = min(allDates);
  const maxDate = max(allDates);
  
  // Prepare data for Recharts BarChart (each bar is a task)
  // We'll represent tasks along a timeline. Y-axis could be task names.
  // For simplicity, let's make a bar chart where each objective has its tasks.
  // This is a simplified Gantt. A true Gantt is more complex.
  
  const chartData = allTasks.map((task, index) => ({
    taskName: task.name,
    objective: objectives.find(o => o.id === task.objectiveId)?.description || 'Unknown Objective',
    // Recharts expects 'range' as [startValue, endValue] for a bar
    // We need to convert dates to numerical values (e.g., days from minDate)
    timeRange: [
      differenceInDays(new Date(task.start), minDate),
      differenceInDays(new Date(task.end), minDate)
    ],
    id: task.id,
    colorIndex: index % GANTT_COLORS.length, // Cycle through colors
  }));


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Project Timeline (Gantt View)</CardTitle>
      </CardHeader>
      <CardContent className="h-[600px] pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              domain={[0, differenceInDays(maxDate, minDate)]}
              tickFormatter={(tick) => format(new Date(minDate.getTime() + tick * 24 * 60 * 60 * 1000), 'MMM d')}
              label={{ value: "Timeline (Days from start)", position: "insideBottom", offset: -5 }}
            />
            <YAxis 
              dataKey="taskName" 
              type="category" 
              width={150} 
              tick={{fontSize: 10, width: 140}} 
              interval={0}
            />
            <Tooltip
              formatter={(value: [number, number], name, props) => {
                const task = allTasks.find(t => t.id === props.payload.id);
                if (!task) return ["Invalid data", ""];
                return [
                  `${format(new Date(task.start), 'MMM d')} - ${format(new Date(task.end), 'MMM d')}`,
                  `Duration: ${differenceInDays(new Date(task.end), new Date(task.start))} days`
                ];
              }}
              labelFormatter={(label) => `Task: ${label}`}
            />
            <Legend />
            <Bar dataKey="timeRange" name="Task Duration" >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={GANTT_COLORS[entry.colorIndex]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

