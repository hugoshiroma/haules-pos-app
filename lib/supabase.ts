import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

type Response<T, E = unknown> = [undefined, T] | [E | string, undefined];

type ValidateDiscountResponse = {
  discountedAmount: number;
  originalAmount: number;
  discountValue: number;
  code: string;
};

type LoginUserResponse = {
  customer: any;
  token: string;
};

export async function loginUser(
  email: string,
  pass: string
): Promise<Response<LoginUserResponse>> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.functions.invoke("login-user", {
    body: {
      email,
      password: pass,
    },
  });

  if (error) return [error.message, undefined];
  if (data.error) return [data.error, undefined];

  return [undefined, data];
}

type ItemsInCartType = {
  product_id: string;
  quantity: number;
}[];

export async function validateDiscount(
  code: string,
  purchaseAmount: number,
  userId: string,
  token: string,
  itemsInCart: ItemsInCartType
): Promise<Response<ValidateDiscountResponse>> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authError } =
    await supabase.auth.signInAnonymously();

  if (authError || !authData?.session?.access_token) {
    return [authError?.message || "unauthorized_supabase_session", undefined];
  }
  const supabaseAccessToken = authData.session.access_token;

  const headers: Record<string, string> = {
    "x-access-token": token,
    Authorization: `Bearer ${supabaseAccessToken}`,
  };

  const requestBody = {
    userCouponId: code,
    purchaseAmount,
    userId,
    itemsInCart: itemsInCart,
  };

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/validate-discount`,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || `Erro na Edge Function: ${response.status}`;
      return [errorMessage, undefined];
    }

    if (data.error) {
      return [data.error, undefined];
    }

    return [undefined, data];
  } catch (error: any) {
    return [
      error.message || "Erro desconhecido ao chamar Edge Function",
      undefined,
    ];
  }
}

type PurchaseData = {
  items: {
    variant_id: string;
    quantity: number;
  }[];
  region_id: string;
  email: string;
  promo_codes?: string[];
  customer_id?: string;
};

type CreatePurchaseResponse = {
  order: {
    id: string;
  };
};

export async function createPurchase(
  purchaseData: PurchaseData,
  token: string
): Promise<Response<CreatePurchaseResponse>> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authError } =
    await supabase.auth.signInAnonymously();

  if (authError || !authData?.session?.access_token) {
    return [authError?.message || "unauthorized_supabase_session", undefined];
  }
  const supabaseAccessToken = authData.session.access_token;

  const headers: Record<string, string> = {
    "x-access-token": token,
    Authorization: `Bearer ${supabaseAccessToken}`,
  };

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/purchase`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(purchaseData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage =
        responseData.message ||
        responseData.error.message ||
        `Erro na Edge Function: ${response.status}`;
      return [errorMessage, undefined];
    }

    if (responseData.error) {
      return [responseData.error.message, undefined];
    }

    const { data } = responseData;
    return [undefined, data];
  } catch (error: any) {
    return [
      error.message || "Erro desconhecido ao chamar Edge Function",
      undefined,
    ];
  }
}

export async function completePurchase(
  orderId: string,
  couponId: string,
  total: number,
  token: string
): Promise<Response<any>> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authError } =
    await supabase.auth.signInAnonymously();

  if (authError || !authData?.session?.access_token) {
    return [authError?.message || "unauthorized_supabase_session", undefined];
  }
  const supabaseAccessToken = authData.session.access_token;

  const headers: Record<string, string> = {
    "x-access-token": token,
    Authorization: `Bearer ${supabaseAccessToken}`,
  };

  const requestBody = {
    order_id: orderId,
    total: total,
    discount_id: couponId,
  };

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/complete-purchase`,
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || `Erro na Edge Function: ${response.status}`;
      return [errorMessage, undefined];
    }

    if (data.error) {
      return [data.error, undefined];
    }

    return [undefined, data];
  } catch (error: any) {
    return [
      error.message || "Erro desconhecido ao chamar Edge Function",
      undefined,
    ];
  }
}
