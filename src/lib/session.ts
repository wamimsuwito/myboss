
import type { SessionOptions } from 'iron-session';
import type { UserData } from './types';

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string || "complex_password_at_least_32_characters_long_for_dev",
  cookieName: 'farika-app-session',
  // secure: true should be used in production (HTTPS) but can be false for development
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

// This is the shape of the data that will be stored in the session.
export interface SessionData {
  isLoggedIn: boolean;
  user?: Omit<UserData, 'password'>; // Store user data without the password
}
