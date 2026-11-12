import "server-only";
import { randomBytes } from "node:crypto";

export type Member = {
  id: string;
  email: string;
  name: string;
  token: string;
  user_id: string | null;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

/** Ny hemlig nyckel för en personlig länk (43 tecken, URL-säker). */
export const newToken = () => randomBytes(32).toString("base64url");

/** Den personliga länken. */
export const memberLink = (origin: string, token: string) => `${origin}/in/${token}`;
