"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoWordmark from "@/assets/mirour-logo-galaxy.png";

export default function Auth() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const nextPath = searchParams.get("next");
  const SAFE_REDIRECT_PREFIXES = [
    "/myflows",
    "/stores",
    "/tags",
    "/customers",
    "/inventory",
  ];
  const postLoginRedirect =
    nextPath && SAFE_REDIRECT_PREFIXES.some((p) => nextPath.startsWith(p))
      ? nextPath
      : "/myflows";

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Error message mapper — uses error.code first (Supabase best practice),
  // falls back to message string matching for legacy / unmapped errors.
  // Full code list: https://supabase.com/docs/guides/auth/debugging/error-codes
  // ─────────────────────────────────────────────────────────────────────────
  const getFriendlyErrorMessage = (error: any): string => {
    const code: string | undefined = error?.code;
    const message: string = (
      error?.message ||
      error?.error_description ||
      String(error)
    ).toLowerCase();

    switch (code) {
      // ── Credentials ──────────────────────────────────────────────────────
      // NOTE: invalid_credentials fires for both wrong-password AND
      // email-not-found. We resolve the distinction in handleSubmit via a
      // pre-flight DB check before this function is even called.
      case "invalid_credentials":
        return "Invalid email or password. Please check your details and try again.";

      // ── Email / sign-up ──────────────────────────────────────────────────
      case "email_exists":
      case "user_already_exists":
        return "An account with this email already exists. Please sign in instead.";
      case "email_not_confirmed":
        return "Please confirm your email before signing in — check your inbox (and spam folder).";
      case "email_provider_disabled":
      case "signup_disabled":
        return "New sign-ups are currently disabled. Please contact support.";
      case "email_address_invalid":
        return "Please enter a valid email address (e.g. you@example.com).";
      case "email_address_not_authorized":
        return "This email domain is not authorized for sign-up. Please contact support.";

      // ── Password ──────────────────────────────────────────────────────────
      case "weak_password":
        return "Your password is too weak. Use a mix of uppercase, numbers, and symbols.";
      case "same_password":
        return "You've used this password before. Please choose a different one.";

      // ── Rate limiting ─────────────────────────────────────────────────────
      case "over_email_send_rate_limit":
        return "Too many emails sent recently. Please wait a few minutes before trying again.";
      case "over_request_rate_limit":
        return "Too many attempts from this device. Please wait a minute before trying again.";

      // ── Session / token ───────────────────────────────────────────────────
      case "session_not_found":
      case "session_expired":
      case "refresh_token_not_found":
      case "refresh_token_already_used":
        return "Your session has expired. Please sign in again.";

      // ── User state ────────────────────────────────────────────────────────
      case "user_not_found":
        return "No account found with this email. Please sign up first.";
      case "user_banned":
        return "Your account has been suspended. Please contact support.";

      // ── OAuth / provider ──────────────────────────────────────────────────
      case "provider_disabled":
      case "oauth_provider_not_supported":
        return "This login method is not available. Please use email and password instead.";

      // ── CAPTCHA ───────────────────────────────────────────────────────────
      case "captcha_failed":
        return "CAPTCHA verification failed. Please refresh the page and try again.";

      // ── Invite ────────────────────────────────────────────────────────────
      case "invite_not_found":
        return "This invite link has expired or already been used. Please request a new invite.";

      // ── Generic server ────────────────────────────────────────────────────
      case "unexpected_failure":
        return "Something went wrong on our end. Please try again in a moment.";
      case "validation_failed":
        return "Please check your details and try again.";
      case "request_timeout":
        return "The request took too long. Please check your connection and try again.";
    }

    // ── Fallback: message-based matching for older/unmapped errors ────────
    if (message.includes("email link is invalid or has expired"))
      return "This link has expired. Please request a new one.";
    if (
      message.includes("password should be at least") ||
      message.includes("password is too short")
    )
      return "Password must be at least 6 characters long.";
    if (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed")
    )
      return "Network error. Please check your internet connection and try again.";
    if (message.includes("internal server error") || message.includes("500"))
      return "Something went wrong on our end. Please try again in a moment.";
    if (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    )
      return "Too many attempts. Please wait a minute before trying again.";
    if (message.includes("captcha"))
      return "CAPTCHA verification failed. Please refresh the page and try again.";

    return (
      error?.message ||
      "Something went wrong. Please check your connection and try again."
    );
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!logoFile) return null;
    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, logoFile, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      console.error("Logo upload failed:", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // ── Forgot password flow ─────────────────────────────────────────────
      if (isForgotPassword) {
        const { error: resetErr } = await resetPassword(email);
        if (resetErr) {
          setError(getFriendlyErrorMessage(resetErr));
          setIsSubmitting(false);
          return;
        }
        toast({
          title: "Check your email",
          description:
            "We sent you a password reset link. It may take a minute to arrive.",
        });
        setIsForgotPassword(false);
        setIsSubmitting(false);
        return;
      }

      // ── Sign-up flow ─────────────────────────────────────────────────────
      if (isSignUp) {
        if (!businessName.trim()) {
          setError("Please enter your business name.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters long.");
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match. Please try again.");
          setIsSubmitting(false);
          return;
        }

        const { error: signUpErr, user } = await signUp(
          email,
          password,
          businessName,
        );
        if (signUpErr) {
          setError(getFriendlyErrorMessage(signUpErr));
          setIsSubmitting(false);
          return;
        }

        // Upload logo if provided (non-blocking — failure won't abort sign-up)
        if (logoFile && user) {
          try {
            const logoUrl = await uploadLogo(user.id);
            if (logoUrl) {
              await (supabase as any)
                .from("admin_users")
                .update({ business_logo: logoUrl } as any)
                .eq("id", user.id);
            }
          } catch (logoErr) {
            console.error("Logo upload failed during signup:", logoErr);
          }
        }

        toast({
          title: "Account created!",
          description:
            "Check your email to confirm your account, then sign in below.",
          duration: 8000,
        });

        // Switch to sign-in view — don't redirect yet since email confirmation
        // may be required before the session is valid.
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
        setLogoFile(null);
        setLogoPreview(null);
        setBusinessName("");
        setIsSubmitting(false);
        return;
      }

      // ── Sign-in flow ─────────────────────────────────────────────────────
      const { error: signInErr } = await signIn(email, password);

      if (signInErr) {

        console.log("Error in sign in", signInErr);
        setError(signInErr.message);

        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      setIsSubmitting(false);
      router.push(postLoginRedirect);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full opacity-10 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Branding */}
          <div className="animate-slide-up flex flex-col items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoWordmark.src} alt="Mirour" className="w-64" />
            <p className="text-muted-foreground text-sm text-center">
              Drive more revenue with in-person touchpoints
            </p>
            <span className="inline-block px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground bg-accent/50 rounded-full">
              BETA
            </span>
          </div>

          {/* Right: Form */}
          <div className="bg-card/60 backdrop-blur-sm rounded-3xl p-8 border border-primary/10 shadow-xl animate-slide-up stagger-1">
            <h3 className="font-heading text-3xl text-foreground mb-6">
              {isForgotPassword
                ? "Reset Password"
                : isSignUp
                  ? "Create Account"
                  : "Welcome Back"}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  {/* Business Logo */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Business Logo{" "}
                      <span className="text-xs">(optional, 1:1 square)</span>
                    </label>
                    {logoPreview ? (
                      <div className="relative w-24 h-24 mx-auto bg-secondary rounded-full border border-primary/20 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute top-1 right-1 w-6 h-6 bg-destructive hover:opacity-90 text-destructive-foreground rounded-full flex items-center justify-center transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="block w-24 h-24 mx-auto bg-secondary rounded-full border-2 border-dashed border-primary/30 hover:border-primary cursor-pointer transition-all overflow-hidden">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          className="hidden"
                        />
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <Upload className="w-6 h-6 text-primary" />
                          <span className="text-xs text-muted-foreground">
                            Upload
                          </span>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Business Name */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-primary/20 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      placeholder="Your business name"
                      required
                      autoComplete="organization"
                    />
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-primary/20 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              {!isForgotPassword && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-primary/20 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete={
                        isSignUp ? "new-password" : "current-password"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError("");
                      }}
                      className="text-sm text-primary hover:text-foreground transition-colors mt-2"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              )}

              {/* Confirm Password */}
              {isSignUp && !isForgotPassword && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-primary/20 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-foreground text-background rounded-xl hover:bg-foreground/90 transition-all hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSubmitting
                  ? "Please wait..."
                  : isForgotPassword
                    ? "Send Reset Link"
                    : isSignUp
                      ? "Create Account"
                      : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-center">
              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError("");
                  }}
                  className="text-primary hover:text-foreground transition-colors text-sm"
                >
                  ← Back to Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                    setConfirmPassword("");
                    setLogoFile(null);
                    setLogoPreview(null);
                  }}
                  className="text-primary hover:text-foreground transition-colors text-sm"
                >
                  {isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <a
              href="mailto:hello@mirourmirour.com"
              className="text-primary hover:text-foreground transition-colors underline"
            >
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
