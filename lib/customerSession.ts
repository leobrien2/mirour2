// lib/customerSession.ts

const KEYS = {
  token: "mirour:customertoken",
  profile: "mirour:customer:profile",
};

export interface LocalCustomerProfile {
  id: string;
  name: string | null;
  firstname: string | null;
  phone: string | null;
  email: string | null;
}

export const saveCustomerLocally = (customer: LocalCustomerProfile) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.token, customer.id);
  localStorage.setItem(KEYS.profile, JSON.stringify(customer));
};

export const getLocalCustomer = (): LocalCustomerProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.profile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCustomerLocally = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.profile);
};
