import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/*
=========================================================
KADUNA ONLY AUTH STORAGE
=========================================================
*/

const USER_KEY = 'kaduna_only_user';
const TOKEN_KEY = 'kaduna_only_token';


async function setStorage(
  key: string,
  value: string
) {

  if (Platform.OS === 'web') {

    localStorage.setItem(
      key,
      value
    );

    return;

  }

  await SecureStore.setItemAsync(
    key,
    value
  );

}


async function getStorage(
  key: string
): Promise<string | null> {

  if (Platform.OS === 'web') {

    return localStorage.getItem(
      key
    );

  }

  return await SecureStore.getItemAsync(
    key
  );

}


async function removeStorage(
  key: string
) {

  if (Platform.OS === 'web') {

    localStorage.removeItem(
      key
    );

    return;

  }

  await SecureStore.deleteItemAsync(
    key
  );

}


/*
=========================================================
TYPES
=========================================================
*/

export type StoredUser = {
  id?: string;
  _id?: string;

  fullName?: string;

  phone?: string;

  email?: string;

  role?: 'rider' | 'driver' | 'admin' | string;

  status?: 'active' | 'suspended' | string;

  [key: string]: any;
};


/*
=========================================================
SAVE AUTHENTICATION
=========================================================
*/

export async function saveAuth(
  user: StoredUser,
  token: string
): Promise<void> {

  if (!user) {
    throw new Error(
      'Cannot save authentication without a user.'
    );
  }


  if (
    !token ||
    typeof token !== 'string'
  ) {
    throw new Error(
      'Cannot save authentication without a valid token.'
    );
  }


  await setStorage(
  USER_KEY,
  JSON.stringify(user)
);


await setStorage(
  TOKEN_KEY,
  token
);
}


/*
=========================================================
GET STORED USER
=========================================================
*/

export async function getStoredUser(): Promise<StoredUser | null> {

  try {

    const value =
  await getStorage(
    USER_KEY
  );


    if (!value) {
      return null;
    }


    const user =
      JSON.parse(value);


    if (
      !user ||
      typeof user !== 'object'
    ) {
      return null;
    }


    return user as StoredUser;

  } catch (error) {

    console.log(
      '[AUTH STORAGE] Failed to read user:',
      error
    );

    return null;

  }

}


/*
=========================================================
GET STORED TOKEN
=========================================================
*/

export async function getStoredToken(): Promise<string | null> {

  try {

    const token =
  await getStorage(
    TOKEN_KEY
  );


    if (
      !token ||
      typeof token !== 'string'
    ) {
      return null;
    }


    return token;

  } catch (error) {

    console.log(
      '[AUTH STORAGE] Failed to read token:',
      error
    );

    return null;

  }

}


/*
=========================================================
GET COMPLETE AUTH SESSION
=========================================================
*/

export async function getAuth(): Promise<{
  user: StoredUser | null;
  token: string | null;
}> {

  try {

    const [
      user,
      token
    ] = await Promise.all([

      getStoredUser(),

      getStoredToken(),

    ]);


    return {
      user,
      token,
    };

  } catch (error) {

    console.log(
      '[AUTH STORAGE] Failed to read auth session:',
      error
    );


    return {
      user: null,
      token: null,
    };

  }

}


/*
=========================================================
CHECK WHETHER USER IS AUTHENTICATED
=========================================================
*/

export async function isAuthenticated(): Promise<boolean> {

  const token =
    await getStoredToken();


  return Boolean(
    token
  );

}


/*
=========================================================
GET STORED USER ID
=========================================================
*/

export async function getStoredUserId(): Promise<string | null> {

  const user =
    await getStoredUser();


  if (!user) {
    return null;
  }


  return (
    user.id ||
    user._id ||
    null
  );

}


/*
=========================================================
GET STORED USER ROLE
=========================================================
*/

export async function getStoredUserRole(): Promise<string | null> {

  const user =
    await getStoredUser();


  return (
    user?.role ||
    null
  );

}


/*
=========================================================
CLEAR AUTHENTICATION
=========================================================
*/

export async function clearAuth(): Promise<void> {

  try {

   await Promise.all([

  removeStorage(
    USER_KEY
  ),

  removeStorage(
    TOKEN_KEY
  ),

]);

  } catch (error) {

    console.log(
      '[AUTH STORAGE] Failed to clear authentication:',
      error
    );

    throw error;

  }

}


/*
=========================================================
CLEAR ONLY INVALID SESSION
=========================================================
*/

export async function clearSession(): Promise<void> {

  await clearAuth();

}


/*
=========================================================
AUTH STORAGE KEYS
=========================================================
*/

export const AuthStorageKeys = {
  user: USER_KEY,
  token: TOKEN_KEY,
} as const;