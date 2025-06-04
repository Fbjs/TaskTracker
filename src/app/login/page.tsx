
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogoIcon } from "@/components/icons/LogoIcon";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if ("error" in result) {
      toast({ title: "Login Failed", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Logged In", description: `Welcome back, ${result.email}!` });
      router.push("/");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-muted/40">
      <div className="flex items-center gap-2 mb-8">
        <LogoIcon className="h-8 w-8 text-accent" />
        <h1 className="text-3xl font-bold font-headline tracking-tight">TaskTracker</h1>
      </div>
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Login</CardTitle>
          <CardDescription>Enter your credentials to access your TaskTracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting || authLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting || authLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
              {isSubmitting || authLoading ? <Loader2 className="animate-spin" /> : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm">
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary underline hover:no-underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
