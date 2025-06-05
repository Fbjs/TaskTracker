
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Objective, AISuggestions, SuggestedTask, User } from "@/types";
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
import { Sparkles, PlusCircle, Trash2, Loader2, Users } from "lucide-react";
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

interface NewTask {
  description: string;
  assigneeId?: string; // Changed from assignee
}

export const ObjectiveDialog = ({ 
  isOpen, 
  onOpenChange, 
  onObjectiveSaved, 
  objectiveToEdit,
  currentWorkspaceId,
  currentUserId 
}: ObjectiveDialogProps) => {
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [tasks, setTasks] = useState<NewTask[]>([{ description: "" }]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!objectiveToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && objectiveToEdit) {
        setObjectiveDescription(objectiveToEdit.description);
        setAiPrompt(""); 
        setTasks([]); 
      } else {
        setObjectiveDescription("");
        setAiPrompt("");
        setTasks([{ description: "" }]);
      }
      setIsAiLoading(false);
      setIsSubmitting(false);
    }
  }, [isOpen, isEditMode, objectiveToEdit]);

  const fetchMembers = useCallback(async () => {
    if (isOpen && !isEditMode && currentWorkspaceId) { // Only fetch for new objectives
      setIsLoadingMembers(true);
      const result = await getWorkspaceMembersAction(currentWorkspaceId);
      if ("error" in result) {
        toast({ title: "Error", description: `Failed to load workspace members: ${result.error}`, variant: "destructive" });
        setWorkspaceMembers([]);
      } else {
        setWorkspaceMembers(result);
      }
      setIsLoadingMembers(false);
    } else {
      setWorkspaceMembers([]); // Clear if edit mode or no workspace ID
    }
  }, [isOpen, isEditMode, currentWorkspaceId, toast]);

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
      // AI still suggests assignee string, we'll let user pick from members
      setTasks(result.tasks.map(task => ({ description: task.taskDescription, assigneeId: undefined })));
      toast({ title: "AI Suggestions Applied", description: "Review and assign tasks to workspace members." });
    }
  };

  const handleTaskChange = (index: number, field: keyof NewTask, value: string) => {
    const newTasks = [...tasks];
    newTasks[index][field] = value;
    setTasks(newTasks);
  };

  const handleAddTask = () => {
    setTasks([...tasks, { description: "" }]);
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectiveDescription.trim()) {
      toast({ title: "Validation Error", description: "Objective description cannot be empty.", variant: "destructive" });
      return;
    }
    if (!isEditMode && tasks.some(task => !task.description.trim()) && tasks.length > 0) {
       if (tasks.length === 1 && tasks[0].description.trim() === "" && !tasks[0].assigneeId) {
        // Allow submitting with no tasks if the single default empty task is untouched
      } else if (tasks.some(task => !task.description.trim())) {
        toast({ title: "Validation Error", description: "All task descriptions must be filled.", variant: "destructive" });
        return;
      }
    }

    if (!isEditMode && (!currentWorkspaceId || !currentUserId)) {
      toast({ title: "Error", description: "User or Workspace context is missing.", variant: "destructive" });
      return;
    }


    setIsSubmitting(true);
    try {
      if (isEditMode && objectiveToEdit) {
        const result = await updateObjectiveAction(objectiveToEdit.id, objectiveDescription);
        if ("error" in result) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
          onObjectiveSaved(result);
          toast({ title: "Objective Updated", description: `"${result.description}" has been successfully updated.` });
          onOpenChange(false);
        }
      } else {
        const tasksToSubmit = tasks
          .filter(t => t.description.trim() !== "")
          .map(t => ({ ...t, assigneeId: t.assigneeId === "unassigned" ? undefined : t.assigneeId }));

        const result = await addObjectiveAction(
          objectiveDescription, 
          tasksToSubmit,
          currentUserId, 
          currentWorkspaceId 
        );
        if("error" in result){
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
      if(!open) setWorkspaceMembers([]);
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

            {!isEditMode && (
              <div>
                <Label className="font-semibold">Tasks</Label>
                {tasks.map((task, index) => (
                  <div key={index} className="mt-2 p-3 border rounded-md space-y-2 bg-muted/30">
                    <div className="flex items-start gap-2">
                      <Textarea
                        value={task.description}
                        onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                        placeholder={`Task ${index + 1} description`}
                        className="flex-grow"
                        rows={2}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTask(index)} disabled={tasks.length === 1 && !isEditMode && !task.description && !task.assigneeId}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                     <Select 
                        value={task.assigneeId} 
                        onValueChange={(value: string) => handleTaskChange(index, "assigneeId", value === "unassigned" ? "" : value)}
                        disabled={isLoadingMembers}
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
                ))}
                <Button type="button" variant="outline" size="sm" onClick={handleAddTask} className="mt-2">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                </Button>
              </div>
            )}
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
