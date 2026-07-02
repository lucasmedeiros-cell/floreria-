"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Order, OrderStatus, seedOrders } from "@/lib/adminData";
import {
  Product,
  kProducts,
  productById,
  searchProducts,
} from "@/lib/products";

// ===================== Carrito =====================
interface CartState {
  items: Record<string, number>;
  lastAdded: string | null;
  lastAddedQty: number;
  addTick: number;
}

interface CartApi {
  items: Record<string, number>;
  ids: string[];
  count: number;
  total: number;
  isEmpty: boolean;
  lastAdded: string | null;
  lastAddedQty: number;
  addTick: number;
  qty: (id: string) => number;
  add: (id: string, n: number) => void;
  change: (id: string, delta: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

// ===================== Auth =====================
export interface RegisterData {
  name: string;
  email: string;
  pass: string;
  confirm: string;
  role?: string;
}

interface AuthApi {
  loggedIn: boolean;
  name: string;
  role: string;
  email: string;
  error: string | null;
  login: (email: string, pass: string) => boolean;
  register: (data: RegisterData) => boolean;
  logout: () => void;
}

// ===================== Productos =====================
interface ProductsApi {
  products: Product[];
  /** Devuelve true si ya existe un producto con ese SKU (excluyendo `exceptId`). */
  skuExists: (sku: string, exceptId?: string) => boolean;
  search: (q: string) => Product[];
  add: (p: Product) => boolean;
  update: (id: string, patch: Partial<Product>) => boolean;
  remove: (id: string) => void;
}

// ===================== Pedidos =====================
interface OrdersApi {
  orders: Order[];
  nextCode: () => string;
  add: (o: Order) => void;
  setStatus: (o: Order, s: OrderStatus) => void;
  remove: (o: Order) => void;
  countByStatus: (s: OrderStatus) => number;
}

interface ToastApi {
  toast: string | null;
  showToast: (msg: string) => void;
}

interface StoreCtx {
  cart: CartApi;
  auth: AuthApi;
  ordersApi: OrdersApi;
  productsApi: ProductsApi;
  toastApi: ToastApi;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // ---------- Carrito ----------
  const [cartState, setCartState] = useState<CartState>({
    items: {},
    lastAdded: null,
    lastAddedQty: 0,
    addTick: 0,
  });

  const qty = useCallback(
    (id: string) => cartState.items[id] ?? 0,
    [cartState.items]
  );

  const add = useCallback((id: string, n: number) => {
    setCartState((s) => ({
      items: { ...s.items, [id]: (s.items[id] ?? 0) + n },
      lastAdded: id,
      lastAddedQty: n,
      addTick: s.addTick + 1,
    }));
  }, []);

  const change = useCallback((id: string, delta: number) => {
    setCartState((s) => {
      const v = (s.items[id] ?? 0) + delta;
      const items = { ...s.items };
      if (v <= 0) delete items[id];
      else items[id] = v;
      return { ...s, items };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCartState((s) => {
      const items = { ...s.items };
      delete items[id];
      return { ...s, items };
    });
  }, []);

  const clear = useCallback(() => {
    setCartState((s) => ({ ...s, items: {} }));
  }, []);

  const cart: CartApi = useMemo(() => {
    const ids = Object.keys(cartState.items).filter(
      (id) => cartState.items[id] > 0
    );
    const count = Object.values(cartState.items).reduce((a, b) => a + b, 0);
    const total = Object.entries(cartState.items).reduce(
      (t, [id, n]) => t + productById(id).price * n,
      0
    );
    return {
      items: cartState.items,
      ids,
      count,
      total,
      isEmpty: count === 0,
      lastAdded: cartState.lastAdded,
      lastAddedQty: cartState.lastAddedQty,
      addTick: cartState.addTick,
      qty,
      add,
      change,
      remove,
      clear,
    };
  }, [cartState, qty, add, change, remove, clear]);

  // ---------- Auth ----------
  interface UserRec {
    name: string;
    email: string;
    pass: string;
    role: string;
  }
  // Usuarios registrados (en memoria — se reemplazará por el backend).
  const usersRef = useRef<UserRec[]>([
    {
      name: "Ana Gómez",
      email: "ana@floresonline.com",
      pass: "demo1234",
      role: "Vendedora",
    },
  ]);

  const [authState, setAuthState] = useState({
    loggedIn: false,
    name: "Ana Gómez",
    role: "Vendedora",
    email: "ana@floresonline.com",
    error: null as string | null,
  });

  const login = useCallback((email: string, pass: string): boolean => {
    const mail = email.trim().toLowerCase();
    if (mail === "" || pass === "") {
      setAuthState((s) => ({ ...s, error: "Ingresa tu correo y contraseña." }));
      return false;
    }
    // Si el correo está registrado, la contraseña debe coincidir.
    const u = usersRef.current.find((x) => x.email.toLowerCase() === mail);
    if (u && u.pass !== pass) {
      setAuthState((s) => ({ ...s, error: "Contraseña incorrecta." }));
      return false;
    }
    setAuthState((s) => ({
      ...s,
      email: email.trim(),
      role: u?.role ?? s.role,
      name:
        u?.name ??
        (mail.startsWith("ana") ? "Ana Gómez" : "Empleado FloresOnline"),
      error: null,
      loggedIn: true,
    }));
    return true;
  }, []);

  const register = useCallback((data: RegisterData): boolean => {
    const name = data.name.trim();
    const email = data.email.trim();
    const mail = email.toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const setErr = (error: string) => {
      setAuthState((s) => ({ ...s, error }));
      return false;
    };
    if (name === "") return setErr("Ingresa tu nombre completo.");
    if (!emailOk) return setErr("Ingresa un correo válido.");
    if (usersRef.current.some((u) => u.email.toLowerCase() === mail))
      return setErr("Ese correo ya está registrado.");
    if (data.pass.length < 6)
      return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (data.pass !== data.confirm)
      return setErr("Las contraseñas no coinciden.");

    const role = data.role?.trim() || "Vendedora";
    usersRef.current.push({ name, email, pass: data.pass, role });
    // Registro exitoso: inicia sesión automáticamente.
    setAuthState((s) => ({
      ...s,
      name,
      email,
      role,
      error: null,
      loggedIn: true,
    }));
    return true;
  }, []);

  const logout = useCallback(() => {
    setAuthState((s) => ({ ...s, loggedIn: false }));
  }, []);

  const auth: AuthApi = useMemo(
    () => ({ ...authState, login, register, logout }),
    [authState, login, register, logout]
  );

  // ---------- Productos ----------
  const [products, setProducts] = useState<Product[]>(() =>
    kProducts.map((p, i) => ({
      ...p,
      stock: p.stock ?? 12 + ((i * 7) % 40),
      status: p.status ?? "activo",
    }))
  );

  const skuExists = useCallback(
    (sku: string, exceptId?: string): boolean => {
      const s = sku.trim().toLowerCase();
      return products.some(
        (p) => p.id.toLowerCase() === s && p.id !== exceptId
      );
    },
    [products]
  );

  const searchProductsCb = useCallback(
    (q: string) => searchProducts(products, q),
    [products]
  );

  const addProduct = useCallback(
    (p: Product): boolean => {
      const id = p.id.trim();
      if (id === "") return false;
      let ok = true;
      setProducts((ps) => {
        if (ps.some((x) => x.id.toLowerCase() === id.toLowerCase())) {
          ok = false;
          return ps;
        }
        return [{ ...p, id }, ...ps];
      });
      return ok;
    },
    []
  );

  const updateProduct = useCallback(
    (id: string, patch: Partial<Product>): boolean => {
      let ok = true;
      setProducts((ps) => {
        const nextId = (patch.id ?? id).trim();
        if (
          nextId.toLowerCase() !== id.toLowerCase() &&
          ps.some((x) => x.id.toLowerCase() === nextId.toLowerCase())
        ) {
          ok = false;
          return ps;
        }
        return ps.map((x) =>
          x.id === id ? { ...x, ...patch, id: nextId } : x
        );
      });
      return ok;
    },
    []
  );

  const removeProduct = useCallback((id: string) => {
    setProducts((ps) => ps.filter((x) => x.id !== id));
  }, []);

  const productsApi: ProductsApi = useMemo(
    () => ({
      products,
      skuExists,
      search: searchProductsCb,
      add: addProduct,
      update: updateProduct,
      remove: removeProduct,
    }),
    [products, skuExists, searchProductsCb, addProduct, updateProduct, removeProduct]
  );

  // ---------- Pedidos ----------
  const [orders, setOrders] = useState<Order[]>(() => seedOrders());
  const seqRef = useRef(1043);

  const nextCode = useCallback(
    () => `PED-${(seqRef.current + 1).toString().padStart(4, "0")}`,
    []
  );

  const addOrder = useCallback((o: Order) => {
    seqRef.current++;
    setOrders((os) => [o, ...os]);
  }, []);

  const setStatus = useCallback((o: Order, s: OrderStatus) => {
    setOrders((os) => os.map((x) => (x === o ? { ...x, status: s } : x)));
  }, []);

  const removeOrder = useCallback((o: Order) => {
    setOrders((os) => os.filter((x) => x !== o));
  }, []);

  const countByStatus = useCallback(
    (s: OrderStatus) => orders.filter((o) => o.status === s).length,
    [orders]
  );

  const ordersApi: OrdersApi = useMemo(
    () => ({
      orders,
      nextCode,
      add: addOrder,
      setStatus,
      remove: removeOrder,
      countByStatus,
    }),
    [orders, nextCode, addOrder, setStatus, removeOrder, countByStatus]
  );

  // ---------- Toast ----------
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const toastApi: ToastApi = useMemo(
    () => ({ toast, showToast }),
    [toast, showToast]
  );

  const value = useMemo(
    () => ({ cart, auth, ordersApi, productsApi, toastApi }),
    [cart, auth, ordersApi, productsApi, toastApi]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export const useCart = () => useStore().cart;
export const useAuth = () => useStore().auth;
export const useOrders = () => useStore().ordersApi;
export const useProducts = () => useStore().productsApi;
export const useToast = () => useStore().toastApi;
