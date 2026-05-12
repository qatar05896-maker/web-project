import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useUpdateProfile,
  useLogout,
  getGetMeQueryKey,
  getListChatsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, User, Phone, Lock, FileText, LogOut, Check, Pencil } from "lucide-react";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState({
    username: "",
    bio: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  const startEdit = (field: string) => {
    setEditing(field);
    setError("");
    setValues((v) => ({
      ...v,
      username: me?.username ?? "",
      bio: me?.bio ?? "",
      phone: me?.phone ?? "",
      password: "",
      confirmPassword: "",
    }));
  };

  const cancelEdit = () => {
    setEditing(null);
    setError("");
  };

  const handleSave = async (field: string) => {
    setError("");
    const payload: Record<string, string> = {};

    if (field === "username") {
      if (!values.username.trim() || values.username.trim().length < 3) {
        setError("Username must be at least 3 characters");
        return;
      }
      payload.username = values.username.trim();
    } else if (field === "bio") {
      payload.bio = values.bio;
    } else if (field === "phone") {
      if (!values.phone.trim()) {
        setError("Phone required");
        return;
      }
      payload.phone = values.phone.trim();
    } else if (field === "password") {
      if (values.password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (values.password !== values.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      payload.password = values.password;
    }

    try {
      await updateProfile.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setEditing(null);
      setSaved(field);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      setError(err?.data?.error ?? "Update failed");
    }
  };

  const handleLogout = async () => {
    logout();
    setLocation("/auth");
  };

  if (!me) {
    return null;
  }

  const fields = [
    {
      key: "username",
      label: "Username",
      icon: User,
      value: me.username,
      placeholder: "Enter username",
      inputKey: "username" as keyof typeof values,
    },
    {
      key: "bio",
      label: "Bio",
      icon: FileText,
      value: me.bio ?? "No bio yet",
      placeholder: "Tell us about yourself",
      inputKey: "bio" as keyof typeof values,
    },
    {
      key: "phone",
      label: "Phone",
      icon: Phone,
      value: me.phone,
      placeholder: "+1 (555) 000-0000",
      inputKey: "phone" as keyof typeof values,
    },
    {
      key: "password",
      label: "Password",
      icon: Lock,
      value: "••••••••",
      placeholder: "New password",
      inputKey: "password" as keyof typeof values,
    },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="settings-page">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-12 pb-4 flex-shrink-0"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          data-testid="button-back"
          onClick={() => setLocation("/")}
          className="p-1 -ml-1 rounded-full hover:bg-card transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="flex flex-col items-center py-8 px-4">
          <Avatar className="w-20 h-20 mb-3">
            <AvatarFallback
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(139,92,246,0.3))",
                color: "hsl(224 100% 68%)",
              }}
            >
              {me.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-foreground">{me.username}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{me.phone}</p>
          {me.bio && <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">{me.bio}</p>}
        </div>

        {/* Fields */}
        <div className="px-4 space-y-2 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">
            Account
          </p>

          {fields.map((field) => {
            const Icon = field.icon;
            const isEditing = editing === field.key;
            const isSaved = saved === field.key;

            return (
              <motion.div
                key={field.key}
                layout
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${isEditing ? "rgba(91,127,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <button
                  data-testid={`field-${field.key}`}
                  onClick={() => !isEditing && startEdit(field.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {field.key === "password" ? "••••••••" : (field.value || "Not set")}
                    </p>
                  </div>
                  {isSaved ? (
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <Pencil className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 space-y-3"
                  >
                    <Input
                      data-testid={`input-${field.key}`}
                      type={field.key === "password" ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={values[field.inputKey]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.inputKey]: e.target.value }))
                      }
                      className="bg-card border-border text-foreground h-11"
                      autoFocus
                    />

                    {field.key === "password" && (
                      <Input
                        data-testid="input-confirm-password"
                        type="password"
                        placeholder="Confirm new password"
                        value={values.confirmPassword}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, confirmPassword: e.target.value }))
                        }
                        className="bg-card border-border text-foreground h-11"
                      />
                    )}

                    {error && <p className="text-destructive text-xs">{error}</p>}

                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-save-${field.key}`}
                        onClick={() => handleSave(field.key)}
                        disabled={updateProfile.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        {updateProfile.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        data-testid={`button-cancel-${field.key}`}
                        onClick={cancelEdit}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-border"
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Logout */}
        <div className="px-4 pb-12">
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-destructive font-medium transition-colors hover:bg-destructive/10"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
