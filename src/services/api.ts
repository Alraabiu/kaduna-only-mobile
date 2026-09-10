import axios from 'axios';


const API_BASE_URL =
  'https://kaduna-only-backend.onrender.com/api';



export const api = axios.create({

  baseURL: API_BASE_URL,

  timeout: 15000,

  headers: {

    'Content-Type': 'application/json',

    Accept: 'application/json',

  },

});



export function setAuthToken(
  token?: string
) {

  if (token) {

    api.defaults.headers.common.Authorization =
      `Bearer ${token}`;

  } else {

    delete api.defaults.headers.common.Authorization;

  }

}



export default api;