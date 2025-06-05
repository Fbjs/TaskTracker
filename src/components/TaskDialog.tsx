
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority, User, Workspace } from "@/types"; 
import { ALL_TASK_STATUSES, ALL_TASK_PRIORITIES } from "@/types"; 
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Users } from "lucide-react";
import { format } from "date-fns"; 
import { useToast } from "@/hooks/use-toast";
import { updateTaskAction, getWorkspaceMembersAction } from "@/app/actions";

interface TaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  objectiveId: string;
  onTaskSaved: (updatedTask: Task) => void;
  currentWorkspaceId?: string; // Added to fetch members
}

export const TaskDialog = ({ 
  isOpen, 
  onOpenChange, 
  task, 
  objectiveId, 
  onTaskSaved,
  currentWorkspaceId 
}: TaskDialogProps) => {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("To Do");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined); // Stores User ID
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && task) {
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setAssigneeId(task.assigneeId || undefined);
      setIsSubmitting(false);
    }
  }, [isOpen, task]);

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
    }
  }, [isOpen, currentWorkspaceId, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: "Validation Error", description: "Task description cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Partial<Omit<Task, 'id' | 'objectiveId' | 'createdAt' | 'assignee'>> & { assigneeId?: string | null } = {
        description,
        status,
        priority,
        dueDate,
        assigneeId: assigneeId || null, // Send null to unassign
      };
      
      const result = await updateTaskAction(task.id, objectiveId, updates);
      if ("error" in result) {
         toast({ title: "Error updating task", description: result.error, variant: "destructive" });
      } else {
        onTaskSaved(result); // The result is already serialized by the action
        toast({ title: "Task Updated", description: `"${description}" has been successfully updated.` });
        onOpenChange(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setWorkspaceMembers([]); // Clear members when dialog closes
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Task</DialogTitle>
          <DialogDescription>
            Update the details for your task.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4" id="task-dialog-form">
          <div>
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}>
                <SelectTrigger id="task-status" className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TASK_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                <SelectTrigger id="task-priority" className="mt-1">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TASK_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="task-due-date">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal mt-1"
                      id="task-due-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
               <Select 
                  value={assigneeId} 
                  onValueChange={(value: string) => setAssigneeId(value === "unassigned" ? undefined : value)}
                  disabled={isLoadingMembers}
                >
                <SelectTrigger id="task-assignee" className="mt-1">
                  <SelectValue placeholder={isLoadingMembers ? "Loading members..." : "Select assignee"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {workspaceMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="task-dialog-form" disabled={isSubmitting || isLoadingMembers}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
