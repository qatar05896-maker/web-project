import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useGetChat,
  useUpdateChat,
  useAddChatMember,
  useRemoveChatMember,
  useSearchUsers,
  getGetMeQueryKey,
  getGetChatQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Search, UserPlus, UserMinus, Crown, Edit2, Check, X } from "lucide-react";

export default function GroupDetail() {
  const { chatId: chatIdStr } = useParams<{ chatId: string }>();
  const chatId = parseInt(chatIdStr, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: chat } = useGetChat(chatId, {
    query: { queryKey: getGetChatQueryKey(chatId) },
  });
  const updateChat = useUpdateChat();
  const addMember = useAddChatMember();
  const removeMember = useRemoveChatMember();

  const { data: searchResults = [] } = useSearchUsers(
    { q: searchQuery },
    {
      query: {
        enabled: searchQuery.length >= 1,
        queryKey: ["group-search", searchQuery],
      },
    },
  );

  const myRole = chat?.members?.find((m) => m.user.id === me?.id)?.role;
  const isAdmin = myRole === "admin";

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    await updateChat.mutateAsync({ chatId, data: { name: newName.trim() } });
    queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
    setEditingName(false);
  };

  const handleAddMember = async (userId: number) => {
    await addMember.mutateAsync({ chatId, data: { userId } });
    queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
    setSearchQuery("");
  };

  const handleRemoveMember = async (userId: number) => {
    await removeMember.mutateAsync({ chatId, userId });
    queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
  };

  const existingMemberIds = new Set(chat?.members?.map((m) => m.user.id) ?? []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="group-page">
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
          onClick={() => setLocation(`/chat/${chatId}`)}
          className="p-1 -ml-1 rounded-full hover:bg-card transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Group Info</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group name */}
        <div className="px-4 py-6 flex flex-col items-center">
          <Avatar className="w-20 h-20 mb-3">
            <AvatarFallback
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(139,92,246,0.3))",
                color: "hsl(224 100% 68%)",
              }}
            >
              {(chat?.name ?? "G").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Input
                data-testid="input-group-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-card border-border text-foreground text-center"
                autoFocus
              />
              <button onClick={handleSaveName} className="p-1.5 rounded-full bg-primary/20 text-primary">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingName(false)} className="p-1.5 rounded-full bg-card text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{chat?.name ?? "Group"}</h2>
              {isAdmin && (
                <button
                  data-testid="button-edit-name"
                  onClick={() => { setEditingName(true); setNewName(chat?.name ?? ""); }}
                  className="p-1 rounded-full hover:bg-card text-muted-foreground transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {chat?.members?.length ?? 0} members
          </p>
        </div>

        {/* Members */}
        <div className="px-4 space-y-1 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">
            Members
          </p>

          {chat?.members?.map((member, i) => (
            <motion.div
              key={member.user.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card/50 transition-colors"
              data-testid={`member-${member.user.id}`}
            >
              <Avatar className="w-9 h-9">
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(6,182,212,0.3))",
                    color: "hsl(224 100% 68%)",
                  }}
                >
                  {member.user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground text-sm">{member.user.username}</span>
                  {member.role === "admin" && (
                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{member.user.phone}</p>
              </div>
              {isAdmin && member.user.id !== me?.id && (
                <button
                  data-testid={`button-remove-${member.user.id}`}
                  onClick={() => handleRemoveMember(member.user.id)}
                  className="p-1.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Add member */}
        {isAdmin && (
          <div className="px-4 pb-12 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Add Members
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-member"
                placeholder="Search by username or phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border text-foreground h-11"
              />
            </div>

            {searchResults
              .filter((u) => !existingMemberIds.has(u.id))
              .map((user) => (
                <button
                  key={user.id}
                  data-testid={`add-member-${user.id}`}
                  onClick={() => handleAddMember(user.id)}
                  disabled={addMember.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card/50 transition-colors text-left"
                >
                  <Avatar className="w-9 h-9">
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{
                        background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(6,182,212,0.3))",
                        color: "hsl(224 100% 68%)",
                      }}
                    >
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-3.5 h-3.5 text-primary" />
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
