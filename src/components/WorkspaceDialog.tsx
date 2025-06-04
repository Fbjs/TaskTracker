
"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createWorkspaceAction } from "@/app/actions";
import type { Workspace } from "@/types";

interface WorkspaceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkspaceCreated: (newWorkspace: Workspace) => void; // Callback after successful creation
}

export const WorkspaceDialog = ({ isOpen, onOpenChange, onWorkspaceCreated }: WorkspaceDialogProps) => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setWorkspaceName("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to create a workspace.", variant: "destructive" });
      return;
    }
    if (!workspaceName.trim()) {
      toast({ title: "Validation Error", description: "Workspace name cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createWorkspaceAction(workspaceName, user.id);
      if ("error" in result) {
        toast({ title: "Error Creating Workspace", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Workspace Created", description: `Workspace "${result.name}" has been successfully created.` });
        onWorkspaceCreated(result); // Call the callback
        onOpenChange(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create workspace.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Create New Workspace</DialogTitle>
          <DialogDescription>
            Give your new workspace a name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4" id="workspace-dialog-form">
          <div>
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g., Q3 Marketing Team"
              required
              className="mt-1"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="workspace-dialog-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
