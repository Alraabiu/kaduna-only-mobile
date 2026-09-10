import { io, Socket } from 'socket.io-client';

import { getStoredToken } from '../storage/auth';



/*
=========================================================
KADUNA ONLY REALTIME SOCKET
=========================================================
*/

const SOCKET_URL =
  'https://kaduna-only-backend.onrender.com';

let socket: Socket | null = null;

let socketToken: string | null = null;


export async function connectSocket(): Promise<Socket | null> {

  try {

    const token =
      await getStoredToken();

    if (!token) {

      console.log(
        '[SOCKET] No authentication token'
      );

      return null;

    }

    /*
    -------------------------------------------------------
    Reuse an existing connected socket
    -------------------------------------------------------
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

    if (
      socket &&
      socket.connected &&
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
    -------------------------------------------------------
    Reuse an existing socket that is still connecting
    -------------------------------------------------------
    */

    if (socket) {

      await new Promise<void>((resolve) => {

        const currentSocket = socket;

        if (!currentSocket) {

          resolve();

          return;

        }

        const timeout =
          setTimeout(() => {

            resolve();

          }, 10000);

        currentSocket.once(
          'connect',
          () => {

            clearTimeout(
              timeout
            );

            resolve();

          }
        );

      });

      return socket?.connected
        ? socket
        : null;

    }

    /*
    -------------------------------------------------------
    Create Socket.IO connection
    -------------------------------------------------------
    */

    socketToken = token;


    console.log(

      '[SOCKET] Creating authenticated socket'

    );


    socket =
      io(
        SOCKET_URL,
        {
          transports: [
            'websocket',
          ],

          auth: {
            token,
          },

          autoConnect: true,

          reconnection: true,

          reconnectionAttempts: Infinity,

          reconnectionDelay: 1000,

          reconnectionDelayMax: 5000,
        }
      );

    /*
    -------------------------------------------------------
    Connection events
    -------------------------------------------------------
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

    socket.on(
      'reconnect',
      attempt => {

        console.log(
          '[SOCKET] Reconnected:',
          attempt
        );

      }
    );

    /*
    -------------------------------------------------------
    WAIT FOR ACTUAL CONNECTION
    -------------------------------------------------------
    */

    if (
      socket.connected
    ) {

      return socket;

    }

    await new Promise<void>((resolve) => {

      const currentSocket = socket;

      if (!currentSocket) {

        resolve();

        return;

      }

      const timeout =
        setTimeout(() => {

          resolve();

        }, 10000);

      currentSocket.once(
        'connect',
        () => {

          clearTimeout(
            timeout
          );

          resolve();

        }
      );

    });

    if (
      socket?.connected
    ) {

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

  if (
    !socket ||
    !socket.connected
  ) {

    console.log(
      '[SOCKET] Cannot emit, socket not connected:',
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

  if (!socket) {

    console.log(
      '[SOCKET] Cannot listen before connection:',
      event
    );

    return () => {};

  }


  socket.on(
    event,
    callback
  );


  /*
  -------------------------------------------------------
  Return cleanup function
  -------------------------------------------------------
  */

  return () => {

    socket?.off(
      event,
      callback
    );

  };

}
