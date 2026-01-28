import Medusa from "@medusajs/js-sdk";

export const medusaAdmin = new Medusa({
  baseUrl: process.env.EXPO_PUBLIC_MEDUSA_STORE_URL!,
  debug: process.env.NODE_ENV === "development",
  apiKey: process.env.EXPO_PUBLIC_MEDUSA_ADMIN_API_KEY!,
  publishableKey: process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
  globalHeaders: {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-access-token",
  },
});

export const medusaClient = new Medusa({
  baseUrl: process.env.EXPO_PUBLIC_MEDUSA_STORE_URL!,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
});