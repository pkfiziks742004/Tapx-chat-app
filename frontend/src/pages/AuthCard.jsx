import { useEffect, useRef, useState } from "react";
import { authApi } from "../api/api.js";

export default function AuthCard({ onSignedIn, initialTab = "signup" }) {
  const [tab, setTab] = useState(initialTab); // signup | login | forgot
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1); // 1: send OTP, 2: verify OTP, 3: set new password
  const [pendingSession, setPendingSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      return "Too many requests (429). Please wait a moment and try again.";
    }
    if (code === "over_email_send_rate_limit") {
      return "Too many OTP emails sent. Please wait a bit and try again.";
    }
    if (code === "over_request_rate_limit") {
      return "Too many requests. Please wait a bit and try again.";
    }
    if (code === "user_already_exists") {
      return "An account with this email already exists. Please login or reset your password.";
    }
    if (code === "user_not_found") {
      return "No account found with this email address.";
    }
    if (code === "invalid_otp") {
      return "Invalid or expired OTP code. Please check and try again.";
    }
    return message || fallback;
  }

  // ==========================================
  // SIGNUP OTP WORKFLOW
  // ==========================================
  async function sendSignupOtp() {
    const now = Date.now();
    if (actionInFlightRef.current) return;
    if (now - lastOtpRequestAtRef.current < 600) return;
    lastOtpRequestAtRef.current = now;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
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
      setSuccessMessage(`OTP sent to ${cleanEmail}`);
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

  async function verifySignupOtp() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    setLoadingAction("verifyOtp");
    try {
      const clean = email.trim().toLowerCase();
      const token = otp.trim();
      if (!token) throw new Error("6-digit OTP is required.");
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

  async function setSignupPassword() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    setLoadingAction("setPassword");
    try {
      const strongEnough = password.length >= 8 && password.length <= 72;
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!strongEnough || !hasUpper || !hasLower || !hasNumber) {
        throw new Error("Password must be 8-72 characters with uppercase, lowercase, and a number.");
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

  // ==========================================
  // FORGOT PASSWORD OTP WORKFLOW
  // ==========================================
  async function sendForgotPasswordOtp() {
    const now = Date.now();
    if (actionInFlightRef.current) return;
    if (now - lastOtpRequestAtRef.current < 600) return;
    lastOtpRequestAtRef.current = now;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    setLoadingAction("sendForgotOtp");
    try {
      if (!cleanEmail) throw new Error("Email is required.");
      if (otpCooldownActive) {
        throw new Error(`Please wait ${otpCooldownSeconds}s before requesting another OTP.`);
      }

      await authApi.sendForgotPasswordOtp(cleanEmail);
      setStep(2);
      setOtpCooldownEmail(cleanEmail);
      setOtpCooldownSeconds(60);
      setSuccessMessage(`Password reset code sent to ${cleanEmail}`);
    } catch (e) {
      setError(toAuthErrorMessage(e, "Could not send password reset OTP."));
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

  async function verifyForgotPasswordOtp() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    setLoadingAction("verifyForgotOtp");
    try {
      const clean = email.trim().toLowerCase();
      const token = otp.trim();
      if (!token) throw new Error("6-digit OTP is required.");
      await authApi.verifyForgotPasswordOtp(clean, token);
      setStep(3);
      setSuccessMessage("OTP verified! Now enter your new password.");
    } catch (e) {
      setError(toAuthErrorMessage(e, "Invalid or expired OTP code."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  async function resetPasswordWithOtp() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    setLoadingAction("resetPassword");
    try {
      const clean = email.trim().toLowerCase();
      const token = otp.trim();
      if (!token) throw new Error("OTP verification code is required.");

      const strongEnough = password.length >= 8 && password.length <= 72;
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!strongEnough || !hasUpper || !hasLower || !hasNumber) {
        throw new Error("Password must be 8-72 characters with uppercase, lowercase, and a number.");
      }

      if (confirmPassword && confirmPassword !== password) {
        throw new Error("Passwords do not match.");
      }

      const res = await authApi.resetPasswordWithOtp(clean, token, password);
      if (res?.session) {
        onSignedIn(res.session);
      } else {
        setSuccessMessage("Password reset successfully! Please login with your new password.");
        setTimeout(() => {
          setTab("login");
        }, 1500);
      }
    } catch (e) {
      setError(toAuthErrorMessage(e, "Could not reset password."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  // ==========================================
  // LOGIN WORKFLOW
  // ==========================================
  async function login() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError("");
    setSuccessMessage("");
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
      setError(toAuthErrorMessage(e, "Invalid email or password."));
    } finally {
      setLoading(false);
      setLoadingAction("");
      actionInFlightRef.current = false;
    }
  }

  useEffect(() => {
    setError("");
    setSuccessMessage("");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setPendingSession(null);
    setLoadingAction("");
    setStep(1);
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
            <button
              className={tab === "login" ? "tab active" : "tab"}
              onClick={() => setTab("login")}
              type="button"
            >
              Login
            </button>
            {tab === "forgot" && (
              <button className="tab active" type="button">
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="authBody">
          <div className="authHero" aria-hidden="true">
            <img className="authHeroLogo" src="/tapx-logo.png" alt="" />
          </div>

          <div className="authIntro" aria-live="polite">
            <div className="authIntroTitle">
              {tab === "login"
                ? "Welcome back"
                : tab === "forgot"
                  ? "Reset your password"
                  : "Create your account"}
            </div>
            <div className="authIntroSub">
              {tab === "login"
                ? "Sign in with your email and password."
                : tab === "forgot"
                  ? step === 1
                    ? "Enter your registered email to receive a password reset OTP."
                    : step === 2
                      ? "Enter the 6-digit OTP code sent to your email."
                      : "Set a strong new password for your account."
                  : step === 1
                    ? "We will send a one-time code (OTP) to verify your email."
                    : step === 2
                      ? "Enter the 6-digit OTP code sent to your email."
                      : "Set a password to complete your signup."}
            </div>
          </div>

          {/* Email input (editable in step 1 or login) */}
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading || (step > 1 && tab !== "login")}
            />
          </label>

          {/* OTP input (for Signup and Forgot Password Step 2) */}
          {(tab === "signup" || tab === "forgot") && step >= 2 && (
            <label className="field">
              <span>6-Digit OTP Code</span>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
              />
            </label>
          )}

          {/* Password inputs */}
          {(tab === "login" || ((tab === "signup" || tab === "forgot") && step >= 3)) && (
            <label className="field">
              <span>{tab === "forgot" ? "New Password" : "Password"}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "forgot" ? "Enter new password" : "Enter password"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
            </label>
          )}

          {tab === "forgot" && step >= 3 && (
            <label className="field">
              <span>Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Forgot Password Link in Login Tab */}
          {tab === "login" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-6px", marginBottom: "6px" }}>
              <button
                type="button"
                className="linkBtn"
                onClick={() => setTab("forgot")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "0",
                  textDecoration: "underline"
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && <div className="error">{error}</div>}
          {successMessage && <div className="successBanner" style={{ color: "#10b981", fontSize: "13px", padding: "8px 12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "6px", marginBottom: "12px" }}>{successMessage}</div>}

          <div className="authActions">
            {/* SIGNUP ACTIONS */}
            {tab === "signup" && step === 1 && (
              <button className="btn primary" onClick={sendSignupOtp} disabled={loading || otpCooldownActive} type="button">
                {loading && loadingAction === "sendOtp"
                  ? "Sending..."
                  : otpCooldownActive
                    ? `Wait ${otpCooldownSeconds}s`
                    : "Send OTP"}
              </button>
            )}
            {tab === "signup" && step === 2 && (
              <>
                <button className="btn" onClick={sendSignupOtp} disabled={loading || otpCooldownActive} type="button">
                  {loading && loadingAction === "sendOtp"
                    ? "Resending..."
                    : otpCooldownActive
                      ? `Resend in ${otpCooldownSeconds}s`
                      : "Resend OTP"}
                </button>
                <button className="btn primary" onClick={verifySignupOtp} disabled={loading || otp.trim().length !== 6} type="button">
                  {loading && loadingAction === "verifyOtp" ? "Verifying..." : "Verify OTP"}
                </button>
              </>
            )}
            {tab === "signup" && step === 3 && (
              <button className="btn primary" onClick={setSignupPassword} disabled={loading || !password} type="button">
                {loading && loadingAction === "setPassword" ? "Creating Account..." : "Complete Sign Up"}
              </button>
            )}

            {/* FORGOT PASSWORD ACTIONS */}
            {tab === "forgot" && step === 1 && (
              <>
                <button className="btn" onClick={() => setTab("login")} disabled={loading} type="button">
                  Back to Login
                </button>
                <button className="btn primary" onClick={sendForgotPasswordOtp} disabled={loading || otpCooldownActive} type="button">
                  {loading && loadingAction === "sendForgotOtp"
                    ? "Sending OTP..."
                    : otpCooldownActive
                      ? `Wait ${otpCooldownSeconds}s`
                      : "Send Reset OTP"}
                </button>
              </>
            )}
            {tab === "forgot" && step === 2 && (
              <>
                <button className="btn" onClick={sendForgotPasswordOtp} disabled={loading || otpCooldownActive} type="button">
                  {loading && loadingAction === "sendForgotOtp"
                    ? "Resending..."
                    : otpCooldownActive
                      ? `Resend in ${otpCooldownSeconds}s`
                      : "Resend OTP"}
                </button>
                <button className="btn primary" onClick={verifyForgotPasswordOtp} disabled={loading || otp.trim().length !== 6} type="button">
                  {loading && loadingAction === "verifyForgotOtp" ? "Verifying..." : "Verify OTP"}
                </button>
              </>
            )}
            {tab === "forgot" && step === 3 && (
              <button className="btn primary" onClick={resetPasswordWithOtp} disabled={loading || !password} type="button">
                {loading && loadingAction === "resetPassword" ? "Updating..." : "Reset & Sign In"}
              </button>
            )}

            {/* LOGIN ACTION */}
            {tab === "login" && (
              <button className="btn primary" onClick={login} disabled={loading} type="button">
                {loading && loadingAction === "login" ? "Signing in..." : "Login"}
              </button>
            )}
          </div>

          {tab === "signup" && (
            <div className="small" style={{ marginTop: "12px" }}>
              Only one account allowed per email. Verification code (OTP) will be sent to your email.
            </div>
          )}

          {tab === "forgot" && (
            <div className="small" style={{ marginTop: "12px" }}>
              Password cannot be changed without OTP verification sent to your registered email.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
