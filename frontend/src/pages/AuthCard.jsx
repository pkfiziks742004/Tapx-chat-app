import { useEffect, useRef, useState } from "react";
import { authApi } from "../api/api.js";

export default function AuthCard({ onSignedIn, initialTab = "signup" }) {
  const [tab, setTab] = useState(initialTab); // signup | login
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState(1); // for signup: 1 send OTP, 2 verify OTP, 3 set password
  const [pendingSession, setPendingSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [otpCooldownEmail, setOtpCooldownEmail] = useState("");
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const actionInFlightRef = useRef(false);
  const lastOtpRequestAtRef = useRef(0);

  const cleanEmail = email.trim().toLowerCase();
  const otpCooldownActive = otpCooldownSeconds > 0 && cleanEmail && cleanEmail === otpCooldownEmail;

  useEffect(() => {
    if (otpCooldownSeconds <= 0) return;
    const t = setTimeout(() => setOtpCooldownSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [otpCooldownSeconds]);

  function toAuthErrorMessage(err, fallback) {
    const status = err?.status;
    const code = err?.code;
    const message = String(err?.message || "");

    const isRateLimit =
      status === 429 || String(code || "").includes("rate") || message.toLowerCase().includes("rate limit");

    if (isRateLimit) {
      return "Too many OTP requests (429). Please wait and try again.";
    }
    if (code === "over_email_send_rate_limit") {
      return "Too many OTP emails sent. Please wait a bit and try again.";
    }
    if (code === "over_request_rate_limit") {
      return "Too many requests. Please wait a bit and try again.";
    }
    return message || fallback;
  }

  async function sendOtp() {
    const now = Date.now();
    if (actionInFlightRef.current) return;
    if (now - lastOtpRequestAtRef.current < 600) return; // throttle double-clicks
    lastOtpRequestAtRef.current = now;
    actionInFlightRef.current = true;
    setError("");
    setLoading(true);
    setLoadingAction("sendOtp");
    try {
      if (!cleanEmail) throw new Error("Email is required.");
      if (otpCooldownActive) {
        throw new Error(`Please wait ${otpCooldownSeconds}s before requesting another OTP.`);
      }

      await authApi.sendSignupOtp(cleanEmail);
      setStep(2);
      setOtpCooldownEmail(cleanEmail);
      setOtpCooldownSeconds(60);
    } catch (e) {
      setError(toAuthErrorMessage(e, "Could not send OTP."));
      if (e?.status === 429) {
        setOtpCooldownEmail(cleanEmail);
        setOtpCooldownSeconds((s) => Math.max(s, 60));
      }
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  async function verifyOtp() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setLoading(true);
    setLoadingAction("verifyOtp");
    try {
      const clean = email.trim().toLowerCase();
      const token = otp.trim();
      if (!token) throw new Error("OTP is required.");
      const { session } = await authApi.verifySignupOtp(clean, token);
      if (!session?.access_token) throw new Error("Could not create session.");
      setPendingSession(session);
      setStep(3);
    } catch (e) {
      setError(toAuthErrorMessage(e, "Invalid OTP."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  async function setNewPassword() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setLoading(true);
    setLoadingAction("setPassword");
    try {
      const strongEnough = password.length >= 8 && password.length <= 72;
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!strongEnough || !hasUpper || !hasLower || !hasNumber) {
        throw new Error("Password must be 8-72 chars with uppercase, lowercase, and a number.");
      }
      if (!pendingSession?.access_token) throw new Error("Missing session. Please verify OTP again.");
      await authApi.setPassword(pendingSession.access_token, password);
      onSignedIn(pendingSession);
    } catch (e) {
      setError(toAuthErrorMessage(e, "Could not set password."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  async function login() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setLoading(true);
    setLoadingAction("login");
    try {
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error("Email is required.");
      if (!password) throw new Error("Password is required.");
      const { session } = await authApi.login(clean, password);
      if (!session?.access_token) throw new Error("Login failed.");
      onSignedIn(session);
    } catch (e) {
      setError(toAuthErrorMessage(e, "Login failed."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  useEffect(() => {
    setError("");
    setOtp("");
    setPassword("");
    setPendingSession(null);
    setLoadingAction("");
    setOtpCooldownEmail("");
    setOtpCooldownSeconds(0);
    if (tab === "signup") setStep(1);
  }, [tab]);

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authHeader">
          <div className="brand">
            <div className="brandDot" aria-hidden="true">
              <img className="brandDotImg" src="/fev.png" alt="" />
            </div>
            <div>
              <div className="brandTitle">Tapx</div>
              <div className="brandSub">Real-time chat & calls</div>
            </div>
          </div>
          <div className="tabs">
            <button
              className={tab === "signup" ? "tab active" : "tab"}
              onClick={() => setTab("signup")}
              type="button"
            >
              Sign up
            </button>
            <button className={tab === "login" ? "tab active" : "tab"} onClick={() => setTab("login")} type="button">
              Login
            </button>
          </div>
        </div>

        <div className="authBody">
          <div className="authHero" aria-hidden="true">
            <img className="authHeroLogo" src="/tapx-logo.png" alt="" />
          </div>

          <div className="authIntro" aria-live="polite">
            <div className="authIntroTitle">{tab === "login" ? "Welcome back" : "Create your account"}</div>
            <div className="authIntroSub">
              {tab === "login"
                ? "Sign in with your email and password."
                : step === 1
                  ? "We will send a one-time code (OTP) to verify your email."
                  : step === 2
                    ? "Enter the OTP we sent to your email."
                    : "Set a password to finish signup."}
            </div>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          {tab === "signup" && step >= 2 && (
            <label className="field">
              <span>OTP</span>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 digit code" />
            </label>
          )}

          {(tab === "login" || (tab === "signup" && step >= 3)) && (
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
            </label>
          )}

          {error && <div className="error">{error}</div>}

          <div className="authActions">
            {tab === "signup" && step === 1 && (
              <button className="btn primary" onClick={sendOtp} disabled={loading || otpCooldownActive} type="button">
                {loading && loadingAction === "sendOtp"
                  ? "Sending..."
                  : otpCooldownActive
                    ? `Wait ${otpCooldownSeconds}s`
                    : "Send OTP"}
              </button>
            )}
            {tab === "signup" && step === 2 && (
              <>
                <button className="btn" onClick={sendOtp} disabled={loading || otpCooldownActive} type="button">
                  {loading && loadingAction === "sendOtp"
                    ? "Resending..."
                    : otpCooldownActive
                      ? `Resend in ${otpCooldownSeconds}s`
                      : "Resend OTP"}
                </button>
                <button className="btn primary" onClick={verifyOtp} disabled={loading} type="button">
                  {loading && loadingAction === "verifyOtp" ? "Verifying..." : "Verify OTP"}
                </button>
              </>
            )}
            {tab === "signup" && step === 3 && (
              <button className="btn primary" onClick={setNewPassword} disabled={loading} type="button">
                {loading && loadingAction === "setPassword" ? "Saving..." : "Set Password"}
              </button>
            )}
            {tab === "login" && (
              <button className="btn primary" onClick={login} disabled={loading} type="button">
                {loading && loadingAction === "login" ? "Signing in..." : "Login"}
              </button>
            )}
          </div>

          {tab === "signup" && (
            <div className="small">
              Signup flow: <b>Email OTP</b> -> verify -> set password. Then you can login using email/password.
              {step >= 2 && (
                <>
                  <br />
                  Not receiving the email? Check Spam/Promotions and confirm SMTP is configured on the server.
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
