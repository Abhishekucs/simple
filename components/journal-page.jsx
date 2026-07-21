"use client";

import { useEffect, useState } from "react";
import AuthForm from "./auth-form";
import JournalApp from "./journal-app";
import { createClient } from "../lib/supabase/client";

const THEME_KEY = "simple-journal-theme";

export default function JournalPage() {
  const [authStatus, setAuthStatus] = useState("loading");
  const [authError, setAuthError] = useState("");
  const [theme, setTheme] = useState("light");
  const [user, setUser] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }

    let isActive = true;
    let authStateChanged = false;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive || authStateChanged) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setAuthStatus("signed-out");
        return;
      }

      setUser(data.session?.user ?? null);
      setAuthStatus(data.session ? "signed-in" : "signed-out");
    }

    void loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      authStateChanged = true;
      setAuthError("");
      setUser(session?.user ?? null);
      setAuthStatus(session ? "signed-in" : "signed-out");
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  if (authStatus === "loading") {
    return (
      <main className={`auth-shell${theme === "dark" ? " is-dark" : ""}`} aria-label="Loading journal">
        <p className="journal-loading">Just start</p>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthForm
        authError={authError}
        onToggleTheme={toggleTheme}
        supabase={supabase}
        theme={theme}
      />
    );
  }

  return (
    <JournalApp
      key={user.id}
      onToggleTheme={toggleTheme}
      supabase={supabase}
      theme={theme}
      user={user}
    />
  );
}
