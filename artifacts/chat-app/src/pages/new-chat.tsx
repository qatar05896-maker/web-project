import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSearchUsers,
  useOpenDirectChat,
  useCreateChat,
  getListChatsQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Search, MessageCircle, Users, Check, Plus } from "lucide-react";

type Mode = "choose" | "direct" | "group";

export default function NewChat() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [error, setError] = useState("");

  const openDirectChat = useOpenDirectChat();
  const createChat = useCreateChat();

  const { data: searchResults = [], isLoading: searching } = useSearchUsers(
    { q: searchQuery },
    {
      query: {
        enabled: searchQuery.length >= 1,
        queryKey: ["search-new-chat", searchQuery],
      },
    },
  );

  const handleSelectUser = async (userId: number) => {
    if (mode === "direct") {
      try {
        const chat = await openDirectChat.mutateAsync({ userId });
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocation(`/chat/${chat.id}`);
      } catch {
        setError("Failed to open chat");
      }
    } else if (mode === "group") {
      setSelectedUsers((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
      );
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setError("");
    try {
      const chat = await createChat.mutateAsync({
        data: { type: "group", name: groupName.trim(), memberIds: selectedUsers },
      });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      setLocation(`/chat/${chat.id}`);
    } catch {
      setError("Failed to create group");
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="new-chat-page">
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
          onClick={() => mode === "choose" ? setLocation("/") : setMode("choose")}
          className="p-1 -ml-1 rounded-full hover:bg-card transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {mode === "choose" ? "New Chat" : mode === "direct" ? "New Message" : "New Group"}
        </h1>
        {mode === "group" && selectedUsers.length > 0 && groupName.trim() && (
          <Button
            data-testid="button-create-group"
            onClick={handleCreateGroup}
            disabled={createChat.isPending}
            size="sm"
            className="ml-auto"
          >
            {createChat.isPending ? "Creating..." : "Create"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === "choose" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 space-y-3"
          >
            <button
              data-testid="button-new-direct"
              onClick={() => setMode("direct")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors hover:bg-card/60"
              style={{
                background: "rgba(91,127,255,0.08)",
                border: "1px solid rgba(91,127,255,0.15)",
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Direct Message</p>
                <p className="text-sm text-muted-foreground">Chat with one person</p>
              </div>
            </button>

            <button
              data-testid="button-new-group"
              onClick={() => setMode("group")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors hover:bg-card/60"
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.15)",
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">New Group</p>
                <p className="text-sm text-muted-foreground">Create a group chat</p>
              </div>
            </button>
          </motion.div>
        )}

        {(mode === "direct" || mode === "group") && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col h-full"
          >
            <div className="px-4 pt-4 space-y-3">
              {mode === "group" && (
                <Input
                  data-testid="input-group-name"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="bg-card border-border text-foreground h-11"
                />
              )}

              {mode === "group" && selectedUsers.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedUsers.map((uid) => {
                    const user = searchResults.find((u) => u.id === uid);
                    return user ? (
                      <div
                        key={uid}
                        className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium"
                      >
                        {user.username}
                        <button onClick={() => setSelectedUsers((p) => p.filter((id) => id !== uid))}>
                          <Plus className="w-3 h-3 rotate-45" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-users"
                  placeholder="Search by username or phone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground h-11"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-3">
              {searchResults.length === 0 && searchQuery.length >= 1 && !searching && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No users found
                </div>
              )}

              {searchResults.map((user, i) => {
                const isSelected = selectedUsers.includes(user.id);
                return (
                  <motion.button
                    key={user.id}
                    data-testid={`user-result-${user.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelectUser(user.id)}
                    disabled={openDirectChat.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card/50 transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback
                        className="font-bold text-sm"
                        style={{
                          background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(6,182,212,0.3))",
                          color: "hsl(224 100% 68%)",
                        }}
                      >
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-sm">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.phone}</p>
                    </div>
                    {mode === "group" && (
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {error && (
              <p className="text-destructive text-sm text-center pb-4">{error}</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
