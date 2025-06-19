
"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut, Briefcase, ChevronDown, Settings, UserCircle, Users, Check, Archive, ArchiveRestore } from "lucide-react";
import { LogoIcon } from "@/components/icons/LogoIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "@/types";
import type { ViewMode } from "@/app/page";
import { WorkspaceDialog } from "./WorkspaceDialog"; 


interface AppHeaderProps {
  onAddObjective: () => void;
  workspaces: Workspace[]; 
  currentWorkspace?: Workspace; 
  onWorkspaceSelected: (workspaceId: string) => void; 
  onWorkspaceCreated: (newWorkspace: Workspace) => void; 
  onManageMembers: () => void; 
  currentViewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
}

export const AppHeader = ({ 
  onAddObjective, 
  workspaces, 
  currentWorkspace, 
  onWorkspaceSelected,
  onWorkspaceCreated,
  onManageMembers,
  currentViewMode,
  onSetViewMode
}: AppHeaderProps) => {
  const { user, logout } = useAuth();
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

  const isOwner = currentWorkspace && user && currentWorkspace.ownerId === user.id;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoIcon className="h-16 w-16 text-accent" />
          <h1 className="text-2xl font-bold font-headline tracking-tight">TaskTracker</h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {workspaces && workspaces.length > 0 && (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span>{currentWorkspace ? currentWorkspace.name : "Seleccionar Espacio"}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Espacios de Trabajo</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {workspaces.map((ws) => (
                        <DropdownMenuItem key={ws.id} onClick={() => onWorkspaceSelected(ws.id)}>
                          {ws.name}
                          {currentWorkspace?.id === ws.id && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                       <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={() => setIsWorkspaceDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Nuevo Espacio
                      </DropdownMenuItem>
                      {currentWorkspace && isOwner && (
                        <DropdownMenuItem onClick={onManageMembers}>
                          <Users className="mr-2 h-4 w-4" />
                          Administrar Miembros
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
              )}
              {(!workspaces || workspaces.length === 0) && (
                <Button onClick={() => setIsWorkspaceDialogOpen(true)} size="sm" variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Espacio
                </Button>
              )}

              <Button onClick={onAddObjective} size="sm" disabled={!currentWorkspace || currentViewMode === 'archived'}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Objetivo
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserCircle className="h-6 w-6" />
                    <span className="sr-only">Menú de usuario</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Vista de Objetivos</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={currentViewMode} onValueChange={(value) => onSetViewMode(value as ViewMode)}>
                    <DropdownMenuRadioItem value="active">
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Activos
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="archived">
                      <Archive className="mr-2 h-4 w-4" />
                      Archivados
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Registrarse</Link>
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
      {user && (
        <WorkspaceDialog 
          isOpen={isWorkspaceDialogOpen} 
          onOpenChange={setIsWorkspaceDialogOpen}
          onWorkspaceCreated={onWorkspaceCreated} 
        />
      )}
    </header>
  );
};

