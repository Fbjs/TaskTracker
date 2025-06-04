
"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut, Briefcase, ChevronDown, Settings, UserCircle } from "lucide-react";
import { LogoIcon } from "@/components/icons/LogoIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "@/types";
import { WorkspaceDialog } from "./WorkspaceDialog"; // Import WorkspaceDialog


interface AppHeaderProps {
  onAddObjective: () => void;
  workspaces: Workspace[]; // Pass workspaces for selector
  currentWorkspace?: Workspace; // Pass current workspace
  onWorkspaceSelected: (workspaceId: string) => void; // Callback for workspace selection
  onWorkspaceCreated: (newWorkspace: Workspace) => void; // Callback for workspace creation
}

export const AppHeader = ({ 
  onAddObjective, 
  workspaces, 
  currentWorkspace, 
  onWorkspaceSelected,
  onWorkspaceCreated 
}: AppHeaderProps) => {
  const { user, logout } = useAuth();
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoIcon className="h-7 w-7 text-accent" />
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
                        <span>{currentWorkspace ? currentWorkspace.name : "Select Workspace"}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {workspaces.map((ws) => (
                        <DropdownMenuItem key={ws.id} onClick={() => onWorkspaceSelected(ws.id)}>
                          {ws.name}
                        </DropdownMenuItem>
                      ))}
                       <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={() => setIsWorkspaceDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              )}
              {(!workspaces || workspaces.length === 0) && (
                <Button onClick={() => setIsWorkspaceDialogOpen(true)} size="sm" variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Workspace
                </Button>
              )}

              <Button onClick={onAddObjective} size="sm" disabled={!currentWorkspace}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Objective
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserCircle className="h-6 w-6" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign Up</Link>
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
          onWorkspaceCreated={onWorkspaceCreated} // Pass the callback
        />
      )}
    </header>
  );
};
