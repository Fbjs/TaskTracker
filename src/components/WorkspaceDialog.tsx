
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
  onWorkspaceCreated: (newWorkspace: Workspace) => void;
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
      toast({ title: "Error", description: "Debes iniciar sesión para crear un espacio de trabajo.", variant: "destructive" });
      return;
    }
    if (!workspaceName.trim()) {
      toast({ title: "Error de Validación", description: "El nombre del espacio de trabajo no puede estar vacío.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createWorkspaceAction(workspaceName, user.id);
      if ("error" in result) {
        toast({ title: "Error al Crear Espacio de Trabajo", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Espacio de Trabajo Creado", description: `El espacio de trabajo "${result.name}" se ha creado correctamente.` });
        onWorkspaceCreated(result);
        onOpenChange(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo crear el espacio de trabajo.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Crear Nuevo Espacio de Trabajo</DialogTitle>
          <DialogDescription>
            Dale un nombre a tu nuevo espacio de trabajo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4" id="workspace-dialog-form">
          <div>
            <Label htmlFor="workspace-name">Nombre del Espacio de Trabajo</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="ej., Equipo de Marketing Q3"
              required
              className="mt-1"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="workspace-dialog-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear Espacio de Trabajo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
