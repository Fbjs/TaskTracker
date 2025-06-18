
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
import { addMemberToWorkspaceAction, getWorkspaceMembersAction, removeMemberFromWorkspaceAction } from "@/app/actions"; 
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
  const { toast } = useToast();

  const isOwner = workspace.ownerId === currentUserId;

  const fetchMembers = useCallback(async () => {
    if (!isOpen || !workspace.id) return;
    setIsLoadingMembers(true);
    const result = await getWorkspaceMembersAction(workspace.id);
    if ("error" in result) {
      toast({ title: "Error", description: `No se pudieron cargar los miembros: ${result.error}`, variant: "destructive" });
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
      toast({ title: "Error de Validación", description: "El correo del miembro no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (!isOwner) {
      toast({ title: "Permiso Denegado", description: "Solo el propietario del espacio de trabajo puede añadir miembros.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addMemberToWorkspaceAction(workspace.id, memberEmail, currentUserId);
      if ("error" in result) {
        toast({ title: "Error al Añadir Miembro", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Miembro Añadido", description: `Usuario ${memberEmail} añadido al espacio de trabajo.` });
        setMemberEmail("");
        onMembersChanged(result);
        fetchMembers();
      }
    } catch (error: any) {
      toast({ title: "Error", description: `No se pudo añadir miembro. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemoveMember = async (memberIdToRemove: string) => {
    if (!isOwner) {
      toast({ title: "Permiso Denegado", description: "Solo el propietario del espacio de trabajo puede eliminar miembros.", variant: "destructive" });
      return;
    }
    setIsRemovingMember(memberIdToRemove);
    try {
      const result = await removeMemberFromWorkspaceAction(workspace.id, memberIdToRemove, currentUserId);
      if ("error" in result) {
        toast({ title: "Error al Eliminar Miembro", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Miembro Eliminado", description: `Miembro eliminado correctamente.` });
        onMembersChanged(result);
        fetchMembers();
      }
    } catch (error: any) {
      toast({ title: "Error", description: `No se pudo eliminar miembro. ${error.message}`, variant: "destructive" });
    } finally {
      setIsRemovingMember(null);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Administrar Miembros para {workspace.name}</DialogTitle>
          <DialogDescription>
            {isOwner ? "Añade o elimina miembros de este espacio de trabajo." : "Ver miembros de este espacio de trabajo."}
          </DialogDescription>
        </DialogHeader>
        
        {isOwner && (
          <form onSubmit={handleAddMember} className="space-y-3 py-2" id="add-member-form">
            <div>
              <Label htmlFor="member-email">Añadir Miembro por Correo</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="member-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
                  disabled={isSubmitting}
                />
                <Button type="submit" size="icon" disabled={isSubmitting || !memberEmail.trim() || isRemovingMember !== null}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Miembros Actuales:</h4>
          {isLoadingMembers ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length > 0 ? (
            <ScrollArea className="h-[150px] border rounded-md p-2">
              <ul className="space-y-1">
                {members.map((member) => (
                  <li key={member.id} className="flex justify-between items-center text-sm p-1.5 hover:bg-muted/50 rounded">
                    <span>{member.email} {member.id === workspace.ownerId && "(Propietario)"}</span>
                    {isOwner && member.id !== workspace.ownerId && (
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive hover:text-destructive" 
                                title="Eliminar miembro"
                                disabled={isRemovingMember === member.id}
                            >
                              {isRemovingMember === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                             <AlertDialogDescription>
                               Esta acción eliminará a {member.email} del espacio de trabajo. Perderá acceso a sus objetivos y tareas. Cualquier tarea actualmente asignada a este miembro quedará sin asignar. Esto no se puede deshacer.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel disabled={isRemovingMember === member.id}>Cancelar</AlertDialogCancel>
                             <AlertDialogAction onClick={() => handleConfirmRemoveMember(member.id)} disabled={isRemovingMember === member.id}>
                               {isRemovingMember === member.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                               Confirmar Eliminación
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No se encontraron miembros (excepto el propietario, si aplica).</p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isRemovingMember !== null || isSubmitting}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
