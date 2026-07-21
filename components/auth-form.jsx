"use client";

import { useState } from "react";

export default function AuthForm({ authError, onToggleTheme, supabase, theme }) {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState(authError);
  const [mode, setMode] = useState("sign-in");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setSubmitting(true);

    const credentials = { email: email.trim(), password };
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    setSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    setPassword("");

    if (mode === "sign-up" && !result.data.session) {
      setStatusMessage("Check your email to confirm your account.");
    }
  }

  function changeMode() {
    setMode((currentMode) => (currentMode === "sign-in" ? "sign-up" : "sign-in"));
    setErrorMessage("");
    setStatusMessage("");
  }

  return (
    <main className={`auth-shell${theme === "dark" ? " is-dark" : ""}`} aria-label="Journal account">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Journal</h1>
        <p className="auth-intro">
          {mode === "sign-in" ? "Sign in to open your pages." : "Create your writing space."}
        </p>

        <label className="auth-field">
          <span>Email</span>
          <input
            autoComplete="email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {(errorMessage || statusMessage) && (
          <p className={`auth-message${errorMessage ? " is-error" : ""}`} aria-live="polite">
            {errorMessage || statusMessage}
          </p>
        )}

        <button className="auth-submit" disabled={submitting} type="submit">
          {submitting ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>

        <button className="auth-switch" onClick={changeMode} type="button">
          {mode === "sign-in" ? "Create an account" : "Already have an account?"}
        </button>
      </form>

      <button className="auth-theme" onClick={onToggleTheme} type="button">
        {theme === "dark" ? "Light" : "Dark"}
      </button>
    </main>
  );
}
