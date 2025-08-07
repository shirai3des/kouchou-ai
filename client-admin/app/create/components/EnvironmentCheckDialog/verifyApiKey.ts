"use server";

import { getApiBaseUrl } from "@/app/utils/api";

type ErrorType = "authentication_error" | "insufficient_quota" | "rate_limit_error" | "unknown_error";

type VerificationResult = {
  success: boolean;
  message: string;
  available_models?: string[];
  error_type?: ErrorType;
  error_detail?: string;
};

export const verifyApiKey = async (provider: string) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/admin/environment/verify-api-key`, {
      method: "POST",
      headers: {
        "x-api-key": process.env.NEXT_PUBLIC_ADMIN_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider }),
    });

    const result = (await response.json()) as VerificationResult;
    return {
      result,
      error: !!result.error_type,
    };
  } catch (error) {
    console.error("Error verifying API key:", error);
    return {
      result: null,
      error: true,
    };
  }
};
