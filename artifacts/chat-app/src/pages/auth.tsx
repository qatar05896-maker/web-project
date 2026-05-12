import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useRequestOtp, useVerifyOtp, useSetupProfile } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Phone, Lock, User, ArrowRight, ChevronLeft } from "lucide-react";

type Step = "phone" | "otp" | "setup";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sessionId, setSessionId] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const setupProfile = useSetupProfile();

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) return;
    setError("");
    try {
      const result = await requestOtp.mutateAsync({ data: { phone: phone.trim() } });
      setSessionId(result.sessionId);
      setStep("otp");
    } catch {
      setError("Failed to send OTP. Please try again.");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handleOtpSubmit = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;
    setError("");
    try {
      const result = await verifyOtp.mutateAsync({
        data: { sessionId, code },
      });
      if (result.isNewUser) {
        setSessionToken(result.sessionToken);
        setStep("setup");
      } else {
        setError("Account exists. Please login with your password.");
      }
    } catch {
      setError("Invalid or expired code.");
    }
  };

  const handleSetupSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    setError("");
    try {
      const result = await setupProfile.mutateAsync({
        data: { sessionToken, username: username.trim(), password },
      });
      setToken(result.token);
      setLocation("/");
    } catch (err: any) {
      setError(err?.data?.error ?? "Setup failed. Username may be taken.");
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      data-testid="auth-page"
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 border border-primary/20">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Cipher</h1>
          <p className="text-sm text-muted-foreground mt-1">Private messaging, reinvented</p>
        </motion.div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <AnimatePresence mode="wait">
            {step === "phone" && (
              <motion.div
                key="phone"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="p-6 space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Enter your number</h2>
                  <p className="text-sm text-muted-foreground mt-1">We'll send you a verification code</p>
                </div>

                <div className="space-y-3">
                  <Input
                    data-testid="input-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground h-12 text-base"
                  />
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button
                    data-testid="button-send-otp"
                    onClick={handlePhoneSubmit}
                    disabled={requestOtp.isPending || !phone.trim()}
                    className="w-full h-12 text-base font-medium"
                  >
                    {requestOtp.isPending ? "Sending..." : "Continue"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div
                key="otp"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="p-6 space-y-5"
              >
                <div className="flex items-center gap-3">
                  <button
                    data-testid="button-back-phone"
                    onClick={() => { setStep("phone"); setError(""); setOtp(["","","","","",""]); }}
                    className="p-1 rounded-full hover:bg-card transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Enter the code</h2>
                    <p className="text-sm text-muted-foreground">Sent to {phone}</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      data-testid={`input-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-border bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  ))}
                </div>

                {error && <p className="text-destructive text-sm text-center">{error}</p>}

                <Button
                  data-testid="button-verify-otp"
                  onClick={handleOtpSubmit}
                  disabled={verifyOtp.isPending || otp.join("").length !== 6}
                  className="w-full h-12 text-base font-medium"
                >
                  {verifyOtp.isPending ? "Verifying..." : "Verify Code"}
                </Button>
              </motion.div>
            )}

            {step === "setup" && (
              <motion.div
                key="setup"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="p-6 space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Create your account</h2>
                  <p className="text-sm text-muted-foreground mt-1">Choose a username and password</p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid="input-username"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 bg-card border-border text-foreground h-12"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid="input-password"
                      type="password"
                      placeholder="Password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSetupSubmit()}
                      className="pl-10 bg-card border-border text-foreground h-12"
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button
                    data-testid="button-create-account"
                    onClick={handleSetupSubmit}
                    disabled={setupProfile.isPending || !username.trim() || password.length < 6}
                    className="w-full h-12 text-base font-medium"
                  >
                    {setupProfile.isPending ? "Creating..." : "Create Account"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
