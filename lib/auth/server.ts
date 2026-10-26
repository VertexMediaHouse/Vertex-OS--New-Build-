import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { authOptions } from "./config";

export { googleEnabled } from "./config";

export const auth = betterAuth({ ...authOptions, plugins: [nextCookies()] });
