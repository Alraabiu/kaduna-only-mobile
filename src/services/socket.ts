import { io, Socket } from 'socket.io-client';
import { getStoredToken } from '../storage/auth';

const SOCKET_URL =
  'https://kaduna-only-737d.onrender.com';

let socket: Socket | null = null;
let socketToken: string | null = null;

export async function connectSocket(): Promise<Socket | null> {
  try {
    const token = await getStoredToken();

    if (!token) {
      console.log('[SOCKET] No authentication token');
      return null;
    }

    /*
    =======================================================
    REUSE CONNECTED SOCKET
    =======================================================
    */

    if (
      socket &&
      socket.connected &&
      socketToken === token
    ) {
      console.log(
        '[SOCKET] Reusing authenticated socket'
      );

      return socket;
    }

    /*
    =======================================================
    TOKEN CHANGED
    =======================================================
    */

    if (
      socket &&
      socketToken !== token
    ) {
      console.log(
        '[SOCKET] Authentication token changed. Reconnecting socket.'
      );

      socket.removeAllListeners();
      socket.disconnect();

      socket = null;
      socketToken = null;
    }

    /*
    =======================================================
    EXISTING SOCKET STILL CONNECTING
    =======================================================
    */

    if (socket) {
      const currentSocket = socket;

      await new Promise<void>((resolve) => {
        if (currentSocket.connected) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          resolve();
        }, 10000);

        currentSocket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      return socket?.connected
        ? socket
        : null;
    }

    /*
    =======================================================
    CREATE SOCKET
    =======================================================
    */

    socketToken = token;

    console.log(
      '[SOCKET] Creating authenticated socket'
    );

    socket = io(
      SOCKET_URL,
      {
        transports: [
          'websocket',
          'polling',
        ],

        auth: {
          token,
        },

        autoConnect: true,

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 1000,

        reconnectionDelayMax: 5000,

        timeout: 10000,
      }
    );

    /*
    =======================================================
    CONNECTION EVENTS
    =======================================================
    */

    socket.on(
      'connect',
      () => {
        console.log(
          '[SOCKET] Connected:',
          socket?.id
        );
      }
    );

    socket.on(
      'disconnect',
      reason => {
        console.log(
          '[SOCKET] Disconnected:',
          reason
        );
      }
    );

    socket.on(
      'connect_error',
      error => {
        console.log(
          '[SOCKET] Connection error:',
          error.message
        );
      }
    );

    socket.io.on(
      'reconnect_attempt',
      attempt => {
        console.log(
          '[SOCKET] Reconnect attempt:',
          attempt
        );
      }
    );

    socket.io.on(
      'reconnect',
      attempt => {
        console.log(
          '[SOCKET] Reconnected:',
          attempt
        );
      }
    );

    /*
    =======================================================
    WAIT FOR CONNECTION
    =======================================================
    */

    if (socket.connected) {
      return socket;
    }

    const currentSocket = socket;

    await new Promise<void>((resolve) => {
      if (!currentSocket) {
        resolve();
        return;
      }

      if (currentSocket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve();
      }, 10000);

      currentSocket.once(
        'connect',
        () => {
          clearTimeout(timeout);
          resolve();
        }
      );
    });

    if (socket?.connected) {
      return socket;
    }

    console.log(
      '[SOCKET] Connection timeout'
    );

    return null;

  } catch (error) {

    console.log(
      '[SOCKET] Setup error:',
      error
    );

    return null;
  }
}

/*
=========================================================
GET SOCKET
=========================================================
*/

export function getSocket(): Socket | null {
  return socket;
}

/*
=========================================================
DISCONNECT
=========================================================
*/

export function disconnectSocket(): void {

  if (!socket) {
    return;
  }

  console.log(
    '[SOCKET] Disconnecting'
  );

  socket.removeAllListeners();

  socket.disconnect();

  socket = null;
  socketToken = null;
}

/*
=========================================================
EMIT
=========================================================
*/

export function emitSocket(
  event: string,
  data?: any
): void {

  if (!socket) {
    console.log(
      '[SOCKET] Cannot emit, socket does not exist:',
      event
    );

    return;
  }

  if (!socket.connected) {
    console.log(
      '[SOCKET] Socket not connected yet, cannot emit:',
      event
    );

    return;
  }

  socket.emit(
    event,
    data
  );
}

/*
=========================================================
LISTEN
=========================================================
*/

export function onSocket(
  event: string,
  callback: (...args: any[]) => void
): () => void {

  /*
  IMPORTANT:
  Do NOT require socket.connected here.

  Socket.IO can register listeners while the socket
  is still connecting. This prevents events such as
  trip:new and destination:confirmed from being lost.
  */

  if (!socket) {

    console.log(
      '[SOCKET] Cannot listen because socket does not exist:',
      event
    );

    return () => {};
  }

  socket.on(
    event,
    callback
  );

  console.log(
    '[SOCKET] Listener registered:',
    event
  );

  return () => {

    socket?.off(
      event,
      callback
    );

    console.log(
      '[SOCKET] Listener removed:',
      event
    );
  };
}