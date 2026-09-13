import { useEffect, useState } from "react";
import { ChatContext } from "./context/ChatContext.js";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";

export default function App() {
  const SESSION_STORAGE_KEY = "chatapp.session";
  const SETTINGS_STORAGE_KEY = "chatapp.settings.v1";

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.access_token || !parsed?.user?.id) return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  const [session, setSession] = useState(() => loadStoredSession());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const pref = String(parsed?.theme || "dark");
      const reduceMotion = Boolean(parsed?.reduceMotion);

      if (reduceMotion) document.body.dataset.reduceMotion = "1";
      else delete document.body.dataset.reduceMotion;

      if (pref === "system") {
        const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
        const apply = () => {
          try {
            document.body.dataset.theme = mq?.matches ? "dark" : "light";
          } catch (_e) {}
        };
        apply();
        mq?.addEventListener?.("change", apply);
        return () => mq?.removeEventListener?.("change", apply);
      }

      document.body.dataset.theme = pref === "light" ? "light" : "dark";
    } catch (_e) {}
  }, []);

  useEffect(() => {
    try {
      const page = session ? "home" : "auth";
      document.body.dataset.page = page;
      document.documentElement.dataset.page = page;
    } catch (_e) {}
    return () => {
      try {
        delete document.body.dataset.page;
        delete document.documentElement.dataset.page;
      } catch (_e) {}
    };
  }, [session]);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (_e) {}
  }, [session]);

  return (
    <ChatContext.Provider value={{ session, setSession }}>
      {session ? <Home session={session} onLogout={() => setSession(null)} /> : <Register onSignedIn={setSession} />}
    </ChatContext.Provider>
  );
}
