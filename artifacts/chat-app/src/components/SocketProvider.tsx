import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { getGetChatMessagesQueryKey, getListChatsQueryKey, getGetVoiceRoomQueryKey } from "@workspace/api-client-react";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (payload: any) => {
      // Extract the message from the payload
      const msg = payload?.message;
      if (!msg) return;

      const { chatId } = msg;

      // Invalidate chat messages
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(chatId) });
      
      // Invalidate list chats summary
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    };

    const handleMessageDeleted = (payload: any) => {
      const { chatId } = payload || {};
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(chatId) });
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      }
    };

    const handleChatUpdated = () => {
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    };

    const handleVoiceJoined = (payload: any) => {
      const { chatId } = payload || {};
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: getGetVoiceRoomQueryKey(chatId) });
      }
    };

    const handleVoiceLeft = (payload: any) => {
      const { chatId } = payload || {};
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: getGetVoiceRoomQueryKey(chatId) });
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('chat:updated', handleChatUpdated);
    socket.on('voice:joined', handleVoiceJoined);
    socket.on('voice:left', handleVoiceLeft);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('chat:updated', handleChatUpdated);
      socket.off('voice:joined', handleVoiceJoined);
      socket.off('voice:left', handleVoiceLeft);
    };
  }, [socketRef, queryClient]);

  return <>{children}</>;
}
