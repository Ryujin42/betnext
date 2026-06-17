import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '../api/tokens';

let socket: Socket | null = null;

/**
 * Singleton Socket.IO côté joueur (Lot 9 T9.3). Le handshake JWT utilise
 * l'access token du `tokenStore`. La connexion est paresseuse : on n'ouvre
 * la socket que lorsqu'un composant en a besoin (via `useLiveOdds`).
 */
export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (!socket) {
    socket = io({
      // Le proxy Vite redirige `/socket.io` vers le gateway en dev.
      path: '/socket.io',
      autoConnect: false,
      auth: () => ({ token: tokenStore.getAccess() ?? '' }),
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}
