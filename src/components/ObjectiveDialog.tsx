
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Objective, User, Task as TaskType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sparkles, PlusCircle, Trash2, Loader2, CalendarIcon } from "lucide-react";
import { format, isValid } from "date-fns"; 
import { useToast } from "@/hooks/use-toast";
import { handleSuggestTasks, addObjectiveAction, updateObjectiveAction, getWorkspaceMembersAction } from "@/app/actions";

interface ObjectiveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectiveSaved: (objective: Objective | { error: string } ) => void;
  objectiveToEdit?: Objective | null;
  currentWorkspaceId?: string;
  currentUserId?: string;
}

interface EditableTask {
  tempId: string; 
  id?: string; 
  description: string;
  assigneeId?: string;
  startDate?: Date; 
  dueDate?: Date;   
  isNew?: boolean; 
  isDeleted?: boolean; 
}

export const ObjectiveDialog = ({
  isOpen,
  onOpenChange,
  onObjectiveSaved,
  objectiveToEdit,
  currentWorkspaceId,
  currentUserId,
}: ObjectiveDialogProps) => {
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!objectiveToEdit;

  const generateTempId = useCallback((): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback UUID generator
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
      d += performance.now(); 
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c === 'x' ? r : (r&0x3|0x8)).toString(16);
    });
  }, []);

  const parseDate = (dateInput: Date | string | undefined): Date | undefined => {
    if (!dateInput) return undefined;
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return isValid(date) ? date : undefined;
  };


  const resetDialogState = useCallback(() => {
    if (isEditMode && objectiveToEdit) {
      setObjectiveDescription(objectiveToEdit.description);
      setTasks(
        objectiveToEdit.tasks.map((task: TaskType) => ({
          tempId: generateTempId(),
          id: task.id,
          description: task.description,
          assigneeId: task.assigneeId || undefined,
          startDate: parseDate(task.startDate),
          dueDate: parseDate(task.dueDate),
          isNew: false,
          isDeleted: false,
        }))
      );
      setAiPrompt("");
    } else {
      setObjectiveDescription("");
      setTasks([{ tempId: generateTempId(), description: "", isNew: true, isDeleted: false, startDate: undefined, dueDate: undefined }]);
      setAiPrompt("");
    }
    setIsAiLoading(false);
    setIsSubmitting(false);
  }, [isEditMode, objectiveToEdit, generateTempId]);

  useEffect(() => {
    if (isOpen) {
      resetDialogState();
    }
  }, [isOpen, resetDialogState]);

  const fetchMembers = useCallback(async () => {
    if (isOpen && currentWorkspaceId) {
      setIsLoadingMembers(true);
      const result = await getWorkspaceMembersAction(currentWorkspaceId);
      if ("error" in result) {
        toast({ title: "Error", description: `Failed to load workspace members: ${result.error}`, variant: "destructive" });
        setWorkspaceMembers([]);
      } else {
        setWorkspaceMembers(result);
      }
      setIsLoadingMembers(false);
    } else if (!isOpen) {
      setWorkspaceMembers([]);
    }
  }, [isOpen, currentWorkspaceId, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);


  const handleGetAiSuggestions = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "AI Prompt Empty", description: "Please enter a prompt for AI suggestions.", variant: "default" });
      return;
    }
    setIsAiLoading(true);
    const result = await handleSuggestTasks(aiPrompt);
    setIsAiLoading(false);

    if ("error" in result) {
      toast({ title: "AI Suggestion Failed", description: result.error, variant: "destructive" });
    } else {
      setObjectiveDescription(result.objectiveDescription);
      setTasks(result.tasks.map(task => ({ 
        tempId: generateTempId(), 
        description: task.taskDescription, 
        assigneeId: undefined, 
        startDate: undefined,
        dueDate: undefined,
        isNew: true, 
        isDeleted: false 
      })));
      toast({ title: "AI Suggestions Applied", description: "Review and assign tasks to workspace members." });
    }
  };

  const handleTaskChange = (taskTempId: string, field: keyof Omit<EditableTask, 'tempId' | 'id'>, value: string | boolean | Date | undefined) => {
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.tempId === taskTempId ? { ...task, [field]: value } : task
      )
    );
  };

  const handleAddTask = () => {
    setTasks(currentTasks => [
      ...currentTasks, 
      { tempId: generateTempId(), description: "", isNew: true, isDeleted: false, startDate: undefined, dueDate: undefined }
    ]);
  };

  const handleRemoveTask = (taskTempId: string) => {
    setTasks(currentTasks => {
      const taskToRemove = currentTasks.find(t => t.tempId === taskTempId);
      if (!taskToRemove) return currentTasks;

      if (taskToRemove.isNew) { 
        return currentTasks.filter(t => t.tempId !== taskTempId);
      } else { 
        return currentTasks.map(t =>
          t.tempId === taskTempId ? { ...t, isDeleted: !t.isDeleted } : t
        );
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectiveDescription.trim()) {
      toast({ title: "Validation Error", description: "Objective description cannot be empty.", variant: "destructive" });
      return;
    }

    const activeTasks = tasks.filter(task => !task.isDeleted);
    const tasksWithEmptyDescriptions = activeTasks.filter(task => !task.description.trim());

    if (tasksWithEmptyDescriptions.length > 0) {
        // Allow submission if ALL tasks with empty descriptions are ALSO new AND have no assignee/dates
        const allProblemTasksAreTrulyEmptyAndNew = tasksWithEmptyDescriptions.every(
            task => task.isNew && !task.assigneeId && !task.startDate && !task.dueDate
        );
        if (!allProblemTasksAreTrulyEmptyAndNew) {
            toast({ title: "Validation Error", description: "All active task descriptions must be filled.", variant: "destructive" });
            return;
        }
    }


    if (!currentWorkspaceId || !currentUserId) {
      toast({ title: "Error", description: "User or Workspace context is missing.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      if (isEditMode && objectiveToEdit) {
        const newTasksData = tasks
          .filter(t => t.isNew && !t.isDeleted && t.description.trim() !== "")
          .map(t => ({ 
            description: t.description, 
            assigneeId: t.assigneeId === "unassigned" ? undefined : t.assigneeId,
            startDate: t.startDate || undefined, // Pass Date object or undefined
            dueDate: t.dueDate || undefined,     // Pass Date object or undefined
           }));
        
        const tasksToDeleteIds = tasks
          .filter(t => !t.isNew && t.isDeleted && t.id)
          .map(t => t.id!);
        
        const tasksToUpdateData = tasks
          .filter(t => !t.isNew && !t.isDeleted && t.id)
          .map(t => {
            // For tasksToUpdate, we send the current values. The action will compare.
            // Send null if date is undefined in dialog state to indicate clearing
            return {
                id: t.id!,
                description: t.description,
                assigneeId: t.assigneeId === "unassigned" ? null : (t.assigneeId || null),
                startDate: t.startDate || null, 
                dueDate: t.dueDate || null,
            };
          });

        result = await updateObjectiveAction(
            objectiveToEdit.id, 
            objectiveDescription,
            newTasksData,
            tasksToDeleteIds,
            tasksToUpdateData 
        );

      } else { 
        const tasksToSubmit = tasks
          .filter(t => !t.isDeleted && t.description.trim() !== "")
          .map(t => ({ 
            description: t.description, 
            assigneeId: t.assigneeId === "unassigned" ? undefined : t.assigneeId,
            startDate: t.startDate || undefined,
            dueDate: t.dueDate || undefined,
          }));

        result = await addObjectiveAction(
          objectiveDescription,
          tasksToSubmit,
          currentUserId,
          currentWorkspaceId
        );
      }

      if ("error" in result) {
        toast({ title: `Error ${isEditMode ? 'Updating' : 'Adding'} Objective`, description: result.error, variant: "destructive" });
      } else {
        onObjectiveSaved(result);
        toast({ title: `Objective ${isEditMode ? 'Updated' : 'Added'}`, description: `"${result.description}" has been successfully ${isEditMode ? 'updated' : 'created'}.` });
        onOpenChange(false);
      }

    } catch (error: any) {
      toast({ title: "Error", description: `Failed to ${isEditMode ? 'update' : 'add'} objective. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setWorkspaceMembers([]); 
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditMode ? "Edit Objective" : "Add New Objective"}</DialogTitle>
          {!isEditMode && (
            <DialogDescription>
              Define your objective and its tasks. Use AI to help generate ideas.
            </DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6">
          <form onSubmit={handleSubmit} className="space-y-6 py-4" id="objective-dialog-form">
            {!isEditMode && (
              <div>
                <Label htmlFor="ai-prompt" className="font-semibold">AI Objective Prompt (Optional)</Label>
                <Textarea
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Increase Q3 sales by 15% through targeted digital marketing"
                  className="mt-1"
                />
                <Button type="button" onClick={handleGetAiSuggestions} disabled={isAiLoading || isLoadingMembers} size="sm" className="mt-2">
                  {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Get AI Suggestions
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor="objective-description" className="font-semibold">Objective Description</Label>
              <Input
                id="objective-description"
                value={objectiveDescription}
                onChange={(e) => setObjectiveDescription(e.target.value)}
                placeholder="Objective title or description"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label className="font-semibold">Tasks</Label>
              <div className="mt-1 max-h-[300px] overflow-y-auto pr-2 py-1 space-y-3 border rounded-md bg-muted/10">
                {tasks.map((task) => (
                  (!task.isDeleted || (task.isDeleted && !task.isNew)) && ( 
                  <div 
                    key={task.tempId} 
                    className={`p-3 border rounded-md space-y-2 ${task.isDeleted && !task.isNew ? 'bg-red-100/50 dark:bg-red-900/20 opacity-70 line-through' : 'bg-background shadow-sm'}`}
                  >
                    <div className="flex items-start gap-2">
                      <Textarea
                        value={task.description}
                        onChange={(e) => handleTaskChange(task.tempId, "description", e.target.value)}
                        placeholder={`Task description`}
                        className={`flex-grow`}
                        rows={2}
                        disabled={task.isDeleted && !task.isNew}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTask(task.tempId)} title={task.isDeleted && !task.isNew ? "Undo Remove" : "Remove Task"}>
                        {task.isDeleted && !task.isNew ? <PlusCircle className="h-4 w-4 text-green-600" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        <div>
                            <Label htmlFor={`task-start-date-${task.tempId}`} className="text-xs">Start Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className="w-full justify-start text-left font-normal text-xs h-9 mt-0.5"
                                  id={`task-start-date-${task.tempId}`}
                                  disabled={(task.isDeleted && !task.isNew)}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {task.startDate && isValid(task.startDate) ? format(task.startDate, "PPP") : <span>Pick start</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={task.startDate}
                                  onSelect={(date) => handleTaskChange(task.tempId, "startDate", date || undefined)}
                                  initialFocus
                                  disabled={(task.isDeleted && !task.isNew)}
                                />
                              </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <Label htmlFor={`task-due-date-${task.tempId}`} className="text-xs">Due Date</Label>
                             <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className="w-full justify-start text-left font-normal text-xs h-9 mt-0.5"
                                  id={`task-due-date-${task.tempId}`}
                                  disabled={(task.isDeleted && !task.isNew)}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {task.dueDate && isValid(task.dueDate) ? format(task.dueDate, "PPP") : <span>Pick due</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={task.dueDate}
                                  onSelect={(date) => handleTaskChange(task.tempId, "dueDate", date || undefined)}
                                  initialFocus
                                  disabled={(date) => (task.isDeleted && !task.isNew) || (task.startDate && isValid(task.startDate) && date < task.startDate) || false }
                                />
                              </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                     <Select
                        value={task.assigneeId || "unassigned"}
                        onValueChange={(value: string) => handleTaskChange(task.tempId, "assigneeId", value === "unassigned" ? undefined : value)}
                        disabled={isLoadingMembers || (task.isDeleted && !task.isNew)}
                      >
                      <SelectTrigger className="mt-1 h-9 text-xs">
                         <SelectValue placeholder={isLoadingMembers ? "Loading..." : "Assign to"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {workspaceMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>{member.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )
                ))}
                 {tasks.filter(t => !t.isDeleted || (t.isDeleted && !t.isNew)).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3">No tasks added yet. Click "Add Task" below.</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddTask} className="mt-3">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Task
              </Button>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="objective-dialog-form" disabled={isSubmitting || isLoadingMembers}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditMode ? "Save Changes" : "Save Objective"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
