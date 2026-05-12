import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useGetChat,
  useGetChatMessages,
  useSendMessage,
  useDeleteMessage,
  useGetVoiceRoom,
  useJoinVoiceRoom,
  useLeaveVoiceRoom,
  getGetMeQueryKey,
  getGetChatQueryKey,
  getGetChatMessagesQueryKey,
  getGetVoiceRoomQueryKey,
  getListChatsQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft,
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Users,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const { chatId: chatIdStr } = useParams<{ chatId: string }>();
  const chatId = parseInt(chatIdStr, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [voiceExpanded, setVoiceExpanded] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useSocket();

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: chat } = useGetChat(chatId, {
    query: { queryKey: getGetChatQueryKey(chatId) },
  });
  const { data: messages = [], isLoading: msgsLoading } = useGetChatMessages(
    chatId,
    {},
    { query: { queryKey: getGetChatMessagesQueryKey(chatId, {}) } },
  );
  const { data: voiceRoom } = useGetVoiceRoom(chatId, {
    query: {
      queryKey: getGetVoiceRoomQueryKey(chatId),
      enabled: chat?.type === "group",
    },
  });

  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const joinVoiceRoom = useJoinVoiceRoom();
  const leaveVoiceRoom = useLeaveVoiceRoom();

  // Join Socket.IO room — fixed for StrictMode with single useEffect + cleanup
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !chatId) return;

    socket.emit("join:chat", chatId);

    return () => {
      socket.emit("leave:chat", chatId);
    };
  }, [chatId, socketRef]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = message.trim();
    if (!content) return;
    setMessage("");
    try {
      await sendMessage.mutateAsync({ chatId, data: { content } });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(chatId, {}) });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    } catch {
      setMessage(content);
    }
  };

  const handleDelete = async (messageId: number) => {
    try {
      await deleteMessage.mutateAsync({ chatId, messageId });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(chatId, {}) });
    } catch {}
  };

  const handleJoinVoice = async () => {
    try {
      await joinVoiceRoom.mutateAsync({ chatId, data: { micEnabled, cameraEnabled } });
      queryClient.invalidateQueries({ queryKey: getGetVoiceRoomQueryKey(chatId) });
    } catch {}
  };

  const handleLeaveVoice = async () => {
    try {
      await leaveVoiceRoom.mutateAsync({ chatId });
      queryClient.invalidateQueries({ queryKey: getGetVoiceRoomQueryKey(chatId) });
    } catch {}
  };

  const isInVoice = voiceRoom?.participants.some((p) => p.user.id === me?.id);

  const chatName =
    chat?.type === "group"
      ? chat.name ?? "Group"
      : chat?.members?.find((m) => m.user.id !== me?.id)?.user.username ?? "Chat";

  const chatInitials = chatName.slice(0, 2).toUpperCase();

  const formatTime = (d: string | Date) => {
    try {
      return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="chat-page">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0"
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
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarFallback
            className="text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(91,127,255,0.3), rgba(6,182,212,0.3))",
              color: "hsl(224 100% 68%)",
            }}
          >
            {chatInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{chatName}</p>
          {chat?.type === "group" && (
            <p className="text-xs text-muted-foreground">
              {chat.members?.length ?? 0} members
            </p>
          )}
        </div>
        {chat?.type === "group" && (
          <button
            data-testid="button-group-info"
            onClick={() => setLocation(`/group/${chatId}`)}
            className="p-2 rounded-full hover:bg-card transition-colors"
          >
            <Users className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Voice Room Banner */}
      <AnimatePresence>
        {chat?.type === "group" && voiceRoom && (
          <motion.div
            key="voice-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div
              className="mx-3 my-2 rounded-2xl p-3"
              style={{
                background: "linear-gradient(135deg, rgba(91,127,255,0.12), rgba(139,92,246,0.08))",
                border: "1px solid rgba(91,127,255,0.2)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">
                    Voice Chat — {voiceRoom.participants.length} active
                  </span>
                </div>
                <button
                  data-testid="button-toggle-voice-panel"
                  onClick={() => setVoiceExpanded(!voiceExpanded)}
                  className="p-1 rounded-full hover:bg-card/30 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      !voiceExpanded && "rotate-180",
                    )}
                  />
                </button>
              </div>

              <AnimatePresence>
                {voiceExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    {/* Participants */}
                    {voiceRoom.participants.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {voiceRoom.participants.map((p) => (
                          <div
                            key={p.user.id}
                            data-testid={`voice-participant-${p.user.id}`}
                            className="flex items-center gap-1.5 bg-card/40 rounded-full px-2.5 py-1"
                          >
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                {p.user.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-foreground">{p.user.username}</span>
                            {!p.micEnabled && <MicOff className="w-3 h-3 text-destructive" />}
                            {p.cameraEnabled && <Video className="w-3 h-3 text-primary" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      {isInVoice ? (
                        <>
                          <button
                            data-testid="button-toggle-mic"
                            onClick={() => setMicEnabled(!micEnabled)}
                            className={cn(
                              "p-2 rounded-full transition-colors",
                              micEnabled ? "bg-card/50 text-foreground" : "bg-destructive/20 text-destructive",
                            )}
                          >
                            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                          </button>
                          <button
                            data-testid="button-toggle-camera"
                            onClick={() => setCameraEnabled(!cameraEnabled)}
                            className={cn(
                              "p-2 rounded-full transition-colors",
                              cameraEnabled ? "bg-primary/20 text-primary" : "bg-card/50 text-muted-foreground",
                            )}
                          >
                            {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                          </button>
                          <button
                            data-testid="button-leave-voice"
                            onClick={handleLeaveVoice}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium transition-colors hover:bg-destructive/30"
                          >
                            <PhoneOff className="w-3.5 h-3.5" />
                            Leave
                          </button>
                        </>
                      ) : (
                        <button
                          data-testid="button-join-voice"
                          onClick={handleJoinVoice}
                          disabled={joinVoiceRoom.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                          style={{
                            background: "linear-gradient(135deg, hsl(224 100% 68%), hsl(271 91% 65%))",
                            color: "white",
                          }}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Join Voice Chat
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1" data-testid="messages-list">
        {msgsLoading ? (
          <div className="space-y-3 pt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div
                  className="h-10 rounded-2xl animate-pulse"
                  style={{
                    width: `${140 + Math.random() * 80}px`,
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMine = msg.senderId === me?.id;
              return (
                <motion.div
                  key={msg.id}
                  data-testid={`message-${msg.id}`}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex gap-2 group", isMine ? "justify-end" : "justify-start")}
                >
                  {!isMine && (
                    <Avatar className="w-7 h-7 flex-shrink-0 mt-auto">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                        {(msg.sender?.username ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn("max-w-[75%]", isMine ? "items-end" : "items-start", "flex flex-col gap-0.5")}>
                    {!isMine && chat?.type === "group" && (
                      <span className="text-xs text-primary font-medium px-1">
                        {msg.sender?.username}
                      </span>
                    )}
                    <div
                      className="rounded-2xl px-3.5 py-2.5 relative"
                      style={
                        isMine
                          ? {
                              background: "linear-gradient(135deg, hsl(224 100% 68%), hsl(271 91% 65%))",
                              borderBottomRightRadius: "6px",
                            }
                          : {
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderBottomLeftRadius: "6px",
                            }
                      }
                    >
                      <p className="text-sm text-white leading-relaxed break-words">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <span className="text-[10px] opacity-60">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                    {isMine && (
                      <button
                        data-testid={`button-delete-${msg.id}`}
                        onClick={() => handleDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-card self-end"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div
        className="flex-shrink-0 px-3 pb-8 pt-3"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-2"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <textarea
            data-testid="input-message"
            placeholder="Message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-sm leading-relaxed min-h-[24px] max-h-[120px] py-1"
          />
          <button
            data-testid="button-send"
            onClick={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: message.trim()
                ? "linear-gradient(135deg, hsl(224 100% 68%), hsl(271 91% 65%))"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
