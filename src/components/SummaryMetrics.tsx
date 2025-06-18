
import type { Objective, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ListTodo, GanttChartSquare, AlertOctagon } from 'lucide-react';

interface SummaryMetricsProps {
  objectives: Objective[];
}

const calculateOverallProgress = (objectives: Objective[]): number => {
  if (objectives.length === 0) return 0;
  const totalTasks = objectives.reduce((sum, obj) => sum + obj.tasks.length, 0);
  if (totalTasks === 0) return 0;
  const completedTasks = objectives.reduce(
    (sum, obj) =>
      sum + obj.tasks.filter((task) => task.status === "Done").length,
    0
  );
  return (completedTasks / totalTasks) * 100;
};

const countTasksByStatus = (objectives: Objective[]) => {
  const counts: { [key: string]: number } = {
    "To Do": 0,
    "In Progress": 0,
    "Blocked": 0,
    "Done": 0,
  };
  objectives.forEach(obj => {
    obj.tasks.forEach(task => {
      counts[task.status]++;
    });
  });
  return counts;
};

export const SummaryMetrics = ({ objectives }: SummaryMetricsProps) => {
  const totalObjectives = objectives.length;
  const totalTasks = objectives.reduce((sum, obj) => sum + obj.tasks.length, 0);
  const overallProgress = calculateOverallProgress(objectives);
  const tasksByStatus = countTasksByStatus(objectives);

  const metrics = [
    { title: "Objetivos Totales", value: totalObjectives, icon: <GanttChartSquare className="h-5 w-5 text-muted-foreground" /> },
    { title: "Tareas Totales", value: totalTasks, icon: <ListTodo className="h-5 w-5 text-muted-foreground" /> },
    { title: "Tareas Por Hacer", value: tasksByStatus["To Do"], icon: <ListTodo className="h-5 w-5 text-muted-foreground" /> },
    { title: "Tareas En Progreso", value: tasksByStatus["In Progress"], icon: <CheckCircle2 className="h-5 w-5 text-muted-foreground" /> },
    { title: "Tareas Bloqueadas", value: tasksByStatus["Blocked"], icon: <AlertOctagon className="h-5 w-5 text-muted-foreground" /> },
    { title: "Tareas Hechas", value: tasksByStatus["Done"], icon: <CheckCircle2 className="h-5 w-5 text-muted-foreground" /> },
  ];

  return (
    <div className="mb-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body">{metric.title}</CardTitle>
              {metric.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-sm font-medium font-body">Progreso General</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="w-full h-3" />
          <p className="text-xs text-muted-foreground mt-1">{overallProgress.toFixed(0)}% completado</p>
        </CardContent>
      </Card>
    </div>
  );
};
