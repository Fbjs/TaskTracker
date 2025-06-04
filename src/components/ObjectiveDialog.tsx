"use client";

import { useState, useEffect } from "react";
import type { AISuggestions, SuggestedTask } from "@/types";
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
import { Sparkles, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleSuggestTasks, addObjectiveAction } from "@/app/actions";

interface ObjectiveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectiveAdded: (newObjective: any) => void; // Adjust type as needed
}

interface NewTask {
  description: string;
  assignee?: string;
}

export const ObjectiveDialog = ({ isOpen, onOpenChange, onObjectiveAdded }: ObjectiveDialogProps) => {
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [tasks, setTasks] = useState<NewTask[]>([{ description: "", assignee: "" }]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Reset form when dialog opens
      setObjectiveDescription("");
      setAiPrompt("");
      setTasks([{ description: "", assignee: "" }]);
      setIsAiLoading(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleGetAiSuggestions = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "AI Prompt Empty", description: "Please enter a prompt for AI suggestions.", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    const result = await handleSuggestTasks(aiPrompt);
    setIsAiLoading(false);

    if ("error" in result) {
      toast({ title: "AI Suggestion Failed", description: result.error, variant: "destructive" });
    } else {
      setObjectiveDescription(result.objectiveDescription);
      setTasks(result.tasks.map(task => ({ description: task.taskDescription, assignee: task.assignee })));
      toast({ title: "AI Suggestions Applied", description: "Review and modify as needed." });
    }
  };

  const handleTaskChange = (index: number, field: keyof NewTask, value: string) => {
    const newTasks = [...tasks];
    newTasks[index][field] = value;
    setTasks(newTasks);
  };

  const handleAddTask = () => {
    setTasks([...tasks, { description: "", assignee: "" }]);
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
    if (tasks.some(task => !task.description.trim())) {
      toast({ title: "Validation Error", description: "All task descriptions must be filled.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newObjective = await addObjectiveAction(objectiveDescription, tasks.filter(t => t.description.trim()));
      onObjectiveAdded(newObjective);
      toast({ title: "Objective Added", description: `"${newObjective.description}" has been successfully created.` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add objective.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Objective</DialogTitle>
          <DialogDescription>
            Define your objective and its tasks. Use AI to help generate ideas.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6">
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div>
              <Label htmlFor="ai-prompt" className="font-semibold">AI Objective Prompt (Optional)</Label>
              <Textarea
                id="ai-prompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Increase Q3 sales by 15% through targeted digital marketing"
                className="mt-1"
              />
              <Button type="button" onClick={handleGetAiSuggestions} disabled={isAiLoading} size="sm" className="mt-2">
                {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Get AI Suggestions
              </Button>
            </div>

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
              {tasks.map((task, index) => (
                <div key={index} className="mt-2 p-3 border rounded-md space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input
                      value={task.description}
                      onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                      placeholder={`Task ${index + 1} description`}
                      required
                      className="flex-grow"
                    />
                     <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTask(index)} disabled={tasks.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    value={task.assignee || ""}
                    onChange={(e) => handleTaskChange(index, "assignee", e.target.value)}
                    placeholder="Assignee (optional)"
                  />
                </div>
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
          <Button type="submit" form="objective-dialog-form" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Objective
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Add a hidden form with id="objective-dialog-form" to make the submit button work from footer
// This is a workaround for Dialog + Form. A better way might be to use react-hook-form.
// For now, this is a simplified approach.
// The form is inside ScrollArea, the submit button is in DialogFooter.
// The form's actual onSubmit is handled by the Button's onClick, which calls handleSubmit.
// The form tag here is just to link via `form` attribute.
// A simpler way is to make the submit button call the submit handler directly,
// which is what is implemented above. The <form> tag can wrap the content within ScrollArea.
