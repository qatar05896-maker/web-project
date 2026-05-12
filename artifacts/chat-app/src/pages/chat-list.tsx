import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useListChats,
  useSearchUsers,
  useOpenDirectChat,
  getGetMeQueryKey,
  getListChatsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MessageSquarePlus, Settings, MessageCircle, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ChatList() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const openDirectChat = useOpenDirectChat();

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });
  const { data: chats = [], isLoading: chatsLoading } = useListChats({
    query: { queryKey: getListChatsQueryKey() },
  });
  const { data: searchResults = [] } = useSearchUsers(
    { q: searchQuery },
    {
      query: {
        enabled: searchQuery.length > 1,
        queryKey: ["search-users", searchQuery],
      },
    },
  );

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!meLoading && !me) {
      setLocation("/auth");
    }
  }, [meLoading, me, setLocation]);

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !searchQuery.trim()) return;
    if (!searchResults || searchResults.length === 0) return; // Fail silently
    try {
      const chat = await openDirectChat.mutateAsync({ userId: searchResults[0].id });
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      setLocation(`/chat/${chat.id}`);
    } catch {
      // Fail silently
    }
  };

  const getChatName = (chat: any) => {
    if (chat.type === "group") return chat.name ?? "Group";
    return chat.otherUser?.username ?? chat.otherUser?.phone ?? "Unknown";
  };

  const getChatInitials = (chat: any) => {
    const name = getChatName(chat);
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (dateStr: string | Date | undefined) => {
    if (!dateStr) return "";
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: false });
    } catch {
      return "";
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="chat-list-page">
      {/* Header */}
      <div
        className="px-4 pt-12 pb-4 flex-shrink-0"
        style={{
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Messages</h1>
          <button
            data-testid="button-settings"
            onClick={() => setLocation("/settings")}
            className="p-2 rounded-full hover:bg-card transition-colors"
          >
            {me && (
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {me.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search by username or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chatsLoading ? (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 h-12 rounded-full bg-card animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-card rounded animate-pulse w-32" />
                  <div className="h-3 bg-card rounded animate-pulse w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
            <div>
              <p className="text-foreground font-medium">No conversations yet</p>
              <p className="text-muted-foreground text-sm mt-1">Search for someone to start chatting</p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-2"
          >
            <AnimatePresence>
              {chats.map((chat, i) => (
                <motion.button
                  key={chat.id}
                  data-testid={`chat-item-${chat.id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setLocation(
                    chat.type === "group" ? `/chat/${chat.id}` : `/chat/${chat.id}`
                  )}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card/50 active:bg-card transition-colors text-left"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback
                        className="font-bold text-sm"
                        style={{
                          background: chat.type === "group"
                            ? "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(139,92,246,0.3))"
                            : "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(6,182,212,0.3))",
                          color: "hsl(224 100% 68%)",
                        }}
                      >
                        {getChatInitials(chat)}
                      </AvatarFallback>
                    </Avatar>
                    {chat.type === "group" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                        <Users className="w-2.5 h-2.5 text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {getChatName(chat)}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatTime(chat.lastMessage?.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage?.content ?? "No messages yet"}
                      </p>
                      {(chat.unreadCount ?? 0) > 0 && (
                        <span className="ml-2 flex-shrink-0 min-w-[20px] h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center px-1.5">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Bottom Nav */}
      <div
        className="flex-shrink-0 pb-8 pt-2"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-around px-6 relative">
          <button
            data-testid="nav-chats"
            className="flex flex-col items-center gap-1 p-2"
          >
            <MessageCircle className="w-6 h-6 text-primary" />
            <span className="text-xs text-primary font-medium">Chats</span>
          </button>

          {/* FAB */}
          <button
            data-testid="button-new-chat"
            onClick={() => setLocation("/new-chat")}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-6 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, hsl(224 100% 68%), hsl(271 91% 65%))",
              boxShadow: "0 4px 32px rgba(91,127,255,0.4)",
            }}
          >
            <MessageSquarePlus className="w-6 h-6 text-white" />
          </button>

          <button
            data-testid="nav-settings"
            onClick={() => setLocation("/settings")}
            className="flex flex-col items-center gap-1 p-2"
          >
            <Settings className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
