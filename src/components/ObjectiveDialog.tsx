
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Objective, User, Task as TaskType } from "@/types"; // Renamed Task to TaskType to avoid conflict
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
import { Sparkles, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleSuggestTasks, addObjectiveAction, updateObjectiveAction, getWorkspaceMembersAction } from "@/app/actions";

interface ObjectiveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectiveSaved: (objective: Objective) => void;
  objectiveToEdit?: Objective | null;
  currentWorkspaceId?: string;
  currentUserId?: string;
}

interface EditableTask {
  id?: string; // Present for existing tasks
  description: string;
  assigneeId?: string;
  isNew?: boolean; // True if added in this dialog session
  isDeleted?: boolean; // True if marked for deletion
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

  const resetDialogState = useCallback(() => {
    if (isEditMode && objectiveToEdit) {
      setObjectiveDescription(objectiveToEdit.description);
      setTasks(
        objectiveToEdit.tasks.map((task) => ({
          id: task.id,
          description: task.description,
          assigneeId: task.assigneeId || undefined,
        }))
      );
      setAiPrompt("");
    } else {
      setObjectiveDescription("");
      setTasks([{ description: "", isNew: true }]);
      setAiPrompt("");
    }
    setIsAiLoading(false);
    setIsSubmitting(false);
  }, [isEditMode, objectiveToEdit]);

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
      setTasks(result.tasks.map(task => ({ description: task.taskDescription, assigneeId: undefined, isNew: true })));
      toast({ title: "AI Suggestions Applied", description: "Review and assign tasks to workspace members." });
    }
  };

  const handleTaskChange = (index: number, field: keyof EditableTask, value: string | boolean | undefined) => {
    const newTasks = [...tasks];
    (newTasks[index] as any)[field] = value; // Type assertion for flexibility
    setTasks(newTasks);
  };

  const handleAddTask = () => {
    setTasks([...tasks, { description: "", isNew: true }]);
  };

  const handleRemoveTask = (index: number) => {
    const taskToRemove = tasks[index];
    if (taskToRemove.isNew) {
      // If it's a new task (not yet saved), remove it directly from the array
      setTasks(tasks.filter((_, i) => i !== index));
    } else {
      // If it's an existing task, mark it for deletion
      const newTasks = [...tasks];
      newTasks[index].isDeleted = !newTasks[index].isDeleted; // Toggle deletion state
      setTasks(newTasks);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectiveDescription.trim()) {
      toast({ title: "Validation Error", description: "Objective description cannot be empty.", variant: "destructive" });
      return;
    }

    const activeTasks = tasks.filter(task => !task.isDeleted);
    if (activeTasks.some(task => !task.description.trim()) && activeTasks.length > 0) {
       if (activeTasks.length === 1 && activeTasks[0].description.trim() === "" && !activeTasks[0].assigneeId && activeTasks[0].isNew) {
        // Allow submitting with no tasks if the single default empty new task is untouched
      } else if (activeTasks.some(task => !task.description.trim())) {
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
      if (isEditMode && objectiveToEdit) {
        const newTasksData = tasks
          .filter(t => t.isNew && !t.isDeleted && t.description.trim() !== "")
          .map(t => ({ description: t.description, assigneeId: t.assigneeId === "unassigned" ? undefined : t.assigneeId }));
        
        const tasksToDeleteIds = tasks
          .filter(t => !t.isNew && t.isDeleted && t.id)
          .map(t => t.id!);

        // For existing tasks that are not new and not deleted, check if they were modified.
        // This part is tricky if we want to allow editing existing task details here.
        // For now, this dialog focuses on adding/deleting tasks from an objective.
        // To edit existing task details (description, assignee), user should use TaskDialog.

        const result = await updateObjectiveAction(
            objectiveToEdit.id, 
            objectiveDescription,
            newTasksData,
            tasksToDeleteIds
        );

        if ("error" in result) {
          toast({ title: "Error Updating Objective", description: result.error, variant: "destructive" });
        } else {
          onObjectiveSaved(result);
          toast({ title: "Objective Updated", description: `"${result.description}" has been successfully updated.` });
          onOpenChange(false);
        }
      } else { // Create mode
        const tasksToSubmit = tasks
          .filter(t => !t.isDeleted && t.description.trim() !== "")
          .map(t => ({ description: t.description, assigneeId: t.assigneeId === "unassigned" ? undefined : t.assigneeId }));

        const result = await addObjectiveAction(
          objectiveDescription,
          tasksToSubmit,
          currentUserId,
          currentWorkspaceId
        );
        if ("error" in result) {
            toast({ title: "Error Adding Objective", description: result.error, variant: "destructive" });
        } else {
            onObjectiveSaved(result);
            toast({ title: "Objective Added", description: `"${result.description}" has been successfully created.` });
            onOpenChange(false);
        }
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
        setWorkspaceMembers([]); // Clear members when dialog truly closes
        // Resetting state is now handled by useEffect on isOpen
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
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

            {/* Task management section - now available in both create and edit modes */}
            <div>
              <Label className="font-semibold">Tasks</Label>
              {tasks.map((task, index) => (
                !task.isDeleted || task.isNew ? ( // Show if not deleted OR if new (new tasks marked deleted are just hidden)
                <div key={task.id || `new-${index}`} className={`mt-2 p-3 border rounded-md space-y-2 ${task.isDeleted && !task.isNew ? 'bg-red-100 dark:bg-red-900/30 opacity-70' : 'bg-muted/30'}`}>
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={task.description}
                      onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                      placeholder={`Task ${index + 1} description`}
                      className={`flex-grow ${task.isDeleted && !task.isNew ? 'line-through' : ''}`}
                      rows={2}
                      disabled={task.isDeleted && !task.isNew}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTask(index)} title={task.isDeleted && !task.isNew ? "Undo Remove" : "Remove Task"}>
                      {task.isDeleted && !task.isNew ? <PlusCircle className="h-4 w-4 text-green-600" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div>
                   <Select
                      value={task.assigneeId || "unassigned"}
                      onValueChange={(value: string) => handleTaskChange(index, "assigneeId", value === "unassigned" ? undefined : value)}
                      disabled={isLoadingMembers || (task.isDeleted && !task.isNew)}
                    >
                    <SelectTrigger className="mt-1">
                       <SelectValue placeholder={isLoadingMembers ? "Loading members..." : "Assign to (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {workspaceMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                ) : null 
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddTask} className="mt-2">
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


    