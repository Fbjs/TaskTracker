import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { LogoIcon } from "@/components/icons/LogoIcon";

interface AppHeaderProps {
  onAddObjective: () => void;
}

export const AppHeader = ({ onAddObjective }: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoIcon className="h-7 w-7 text-accent" />
          <h1 className="text-2xl font-bold font-headline tracking-tight">TaskTracker</h1>
        </div>
        <Button onClick={onAddObjective} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Objective
        </Button>
      </div>
    </header>
  );
};
