import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!socketRef.current) {
      // Create socket connection
      socketRef.current = io({
        auth: {
          token
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return socketRef;
}
