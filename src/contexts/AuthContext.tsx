
"use client";

import type { User } from "@/types";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  signup: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load user from localStorage on initial load
    try {
      const storedUser = localStorage.getItem("tasktracker-user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem("tasktracker-user"); // Clear corrupted data
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem("tasktracker-user", JSON.stringify(userData));
    } catch (error) {
      console.error("Failed to save user to localStorage", error);
    }
  };

  const signup = (userData: User) => {
    // In a real app, this would involve an API call to create a user
    setUser(userData);
     try {
      localStorage.setItem("tasktracker-user", JSON.stringify(userData));
    } catch (error) {
      console.error("Failed to save user to localStorage", error);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("tasktracker-user");
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
