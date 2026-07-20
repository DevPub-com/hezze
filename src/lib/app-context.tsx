"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { ArchiveReference } from "@/domains/archive/model/archive.model";
import { fetchArchivesList } from "@/domains/archive/api/analyze.action";
import { fetchUserBookmarks, setBookmark } from "@/domains/archive/api/bookmark.action";

interface AppDataContextValue {
  archiveList: ArchiveReference[];
  setArchiveList: React.Dispatch<React.SetStateAction<ArchiveReference[]>>;
  addArchive: (archive: ArchiveReference) => void;
  user: User | null;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string | null;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  mySaved: Set<string>;
  toggleSaved: (id: string) => void;
  markSaved: (id: string) => void;
  tracked: Set<string>;
  toggleTracked: (id: string) => void;
  markTracked: (id: string) => void;
  isCreating: boolean;
  setIsCreating: React.Dispatch<React.SetStateAction<boolean>>;
  authModalOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [archiveList, setArchiveList] = useState<ArchiveReference[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mySaved, setMySaved] = useState<Set<string>>(new Set());
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const list = await fetchArchivesList();
        setArchiveList(list);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : "데이터 로드에 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBookmarks() {
      if (!user) {
        if (!cancelled) {
          setMySaved(new Set());
          setTracked(new Set());
        }
        return;
      }
      try {
        const { saved, tracked } = await fetchUserBookmarks();
        if (!cancelled) {
          setMySaved(new Set(saved));
          setTracked(new Set(tracked));
        }
      } catch {
        // 북마크 로드 실패는 조용히 무시합니다.
      }
    }
    loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleSaved = useCallback((id: string) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const active = !mySaved.has(id);
    setMySaved((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
    setBookmark(id, "saved", active).catch(() => {
      setMySaved((prev) => {
        const next = new Set(prev);
        if (active) next.delete(id);
        else next.add(id);
        return next;
      });
      setErrorMessage("My HETJE 저장에 실패했습니다.");
    });
  }, [user, mySaved]);

  const toggleTracked = useCallback((id: string) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const active = !tracked.has(id);
    setTracked((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
    setBookmark(id, "tracked", active).catch(() => {
      setTracked((prev) => {
        const next = new Set(prev);
        if (active) next.delete(id);
        else next.add(id);
        return next;
      });
      setErrorMessage("Tomorrow 추적 저장에 실패했습니다.");
    });
  }, [user, tracked]);

  const addArchive = useCallback((archive: ArchiveReference) => {
    setArchiveList((prev) => [archive, ...prev]);
  }, []);

  const markSaved = useCallback((id: string) => {
    setMySaved((prev) => new Set(prev).add(id));
    if (user) {
      setBookmark(id, "saved", true).catch(() => {});
    }
  }, [user]);

  const markTracked = useCallback((id: string) => {
    setTracked((prev) => new Set(prev).add(id));
    if (user) {
      setBookmark(id, "tracked", true).catch(() => {});
    }
  }, [user]);

  const openAuth = useCallback(() => setAuthModalOpen(true), []);
  const closeAuth = useCallback(() => setAuthModalOpen(false), []);

  const signOut = useCallback(async () => {
    try {
      await getSupabaseClient().auth.signOut();
      setUser(null);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "로그아웃 실패");
    }
  }, []);

  const value: AppDataContextValue = {
    archiveList,
    setArchiveList,
    addArchive,
    user,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    searchQuery,
    setSearchQuery,
    mySaved,
    toggleSaved,
    markSaved,
    tracked,
    toggleTracked,
    markTracked,
    isCreating,
    setIsCreating,
    authModalOpen,
    openAuth,
    closeAuth,
    signOut,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}
