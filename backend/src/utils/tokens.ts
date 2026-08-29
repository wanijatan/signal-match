import { nanoid } from "nanoid";

export const generateMatchToken = () => nanoid(24);
export const generateRequestToken = () => nanoid(16);
export const generateReferralCode = () => nanoid(10);
