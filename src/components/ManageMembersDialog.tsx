
"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, Workspace } from "@/types";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addMemberToWorkspaceAction, getWorkspaceMembersAction } from "@/app/actions"; 

interface ManageMembersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  currentUserId: string;
  onMembersChanged: (updatedWorkspace: Workspace) => void; 
}

export const ManageMembersDialog = ({
  isOpen,
  onOpenChange,
  workspace,
  currentUserId,
  onMembersChanged,
}: ManageMembersDialogProps) => {
  const [memberEmail, setMemberEmail] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isOwner = workspace.ownerId === currentUserId;

  const fetchMembers = useCallback(async () => {
    if (!isOpen || !workspace.id) return;
    setIsLoadingMembers(true);
    const result = await getWorkspaceMembersAction(workspace.id);
    if ("error" in result) {
      toast({ title: "Error", description: `Failed to load members: ${result.error}`, variant: "destructive" });
      setMembers([]);
    } else {
      setMembers(result);
    }
    setIsLoadingMembers(false);
  }, [isOpen, workspace.id, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      toast({ title: "Validation Error", description: "Member email cannot be empty.", variant: "destructive" });
      return;
    }
    if (!isOwner) {
      toast({ title: "Permission Denied", description: "Only the workspace owner can add members.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addMemberToWorkspaceAction(workspace.id, memberEmail, currentUserId);
      if ("error" in result) {
        toast({ title: "Error Adding Member", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Member Added", description: `User ${memberEmail} added to workspace.` });
        setMemberEmail(""); // Clear input
        onMembersChanged(result); // Notify parent of change
        fetchMembers(); // Refresh member list
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to add member. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Placeholder for remove member functionality
  const handleRemoveMember = async (memberIdToRemove: string) => {
     toast({ title: "Info", description: "Remove member functionality not yet implemented in this dialog.", variant: "default"});
    // TODO: Implement removeMemberFromWorkspaceAction and call it here
    // Example:
    // if (!isOwner) { ... return; }
    // const result = await removeMemberFromWorkspaceAction(workspace.id, memberIdToRemove, currentUserId);
    // ... handle result, refresh list ...
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Manage Members for {workspace.name}</DialogTitle>
          <DialogDescription>
            {isOwner ? "Add or remove members from this workspace." : "View members of this workspace."}
          </DialogDescription>
        </DialogHeader>
        
        {isOwner && (
          <form onSubmit={handleAddMember} className="space-y-3 py-2" id="add-member-form">
            <div>
              <Label htmlFor="member-email">Add Member by Email</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="member-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={isSubmitting}
                />
                <Button type="submit" size="icon" disabled={isSubmitting || !memberEmail.trim()}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Current Members:</h4>
          {isLoadingMembers ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length > 0 ? (
            <ScrollArea className="h-[150px] border rounded-md p-2">
              <ul className="space-y-1">
                {members.map((member) => (
                  <li key={member.id} className="flex justify-between items-center text-sm p-1.5 hover:bg-muted/50 rounded">
                    <span>{member.email} {member.id === workspace.ownerId && "(Owner)"}</span>
                    {isOwner && member.id !== workspace.ownerId && (
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleRemoveMember(member.id)} title="Remove member (not implemented)">
                         <XCircle className="h-4 w-4" />
                       </Button>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No members found (except the owner, if applicable).</p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
