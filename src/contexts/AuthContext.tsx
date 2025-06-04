
"use client";

import type { User } from "@/types";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { registerUserAction, loginUserAction } from "@/app/actions"; // Import server actions

interface AuthContextType {
  user: User | null;
  login: (email: string, passwordPlain: string) => Promise<User | { error: string }>;
  signup: (email: string, passwordPlain: string) => Promise<User | { error: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("tasktracker-user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem("tasktracker-user"); 
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, passwordPlain: string): Promise<User | { error: string }> => {
    setIsLoading(true);
    const result = await loginUserAction(email, passwordPlain);
    if ("error" in result) {
      setUser(null); // Clear user on failed login
      localStorage.removeItem("tasktracker-user");
      setIsLoading(false);
      return result;
    } else {
      setUser(result);
      try {
        localStorage.setItem("tasktracker-user", JSON.stringify(result));
      } catch (error) {
        console.error("Failed to save user to localStorage", error);
      }
      setIsLoading(false);
      return result;
    }
  };

  const signup = async (email: string, passwordPlain: string): Promise<User | { error: string }> => {
    setIsLoading(true);
    const result = await registerUserAction(email, passwordPlain);
    if ("error" in result) {
      setUser(null); // Clear user on failed signup
      localStorage.removeItem("tasktracker-user");
      setIsLoading(false);
      return result;
    } else {
      setUser(result);
      try {
        localStorage.setItem("tasktracker-user", JSON.stringify(result));
      } catch (error) {
        console.error("Failed to save user to localStorage", error);
      }
      setIsLoading(false);
      return result;
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("tasktracker-user");
      // Optionally, clear workspace selection too
      localStorage.removeItem("tasktracker-lastWorkspace");
    } catch (error) {
      console.error("Failed to remove user from localStorage", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
