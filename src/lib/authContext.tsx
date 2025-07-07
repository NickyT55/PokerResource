"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Profile {
  first_name: string;
  last_name: string;
}

interface AuthContextType {
  user: any;
  loading: boolean;
  profile: Profile | null;
  setProfile: (profile: Profile) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profile: null,
  setProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfileState] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setProfileState(null);
      return;
    }
    supabase
      .from("profile")
      .select()
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileState({ first_name: data.first_name, last_name: data.last_name });
        else setProfileState(null);
      });
  }, [user]);

  const setProfile = async (profile: Profile) => {
    if (!user) return;
    await supabase.from("profile").upsert({ id: user.id, ...profile });
    setProfileState(profile);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfileState(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, profile, setProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 