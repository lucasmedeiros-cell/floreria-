"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Order, OrderStatus } from "@/lib/adminData";
import {
  apiCreateOrder,
  apiDeleteOrder,
  apiEmployeeLogin,
  apiEmployeeLogout,
  apiEmployeeMe,
  apiListOrders,
  apiPatchStatus,
  orderToPayload,
} from "@/lib/ordersClient";
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
  /** Inicia sesión contra la base de datos; fija la cookie de empleado. */
  login: (email: string, pass: string) => Promise<boolean>;
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

  // ---------- Auth (sesión de empleado contra la BD) ----------
  const [authState, setAuthState] = useState({
    loggedIn: false,
    name: "",
    role: "",
    email: "",
    error: null as string | null,
  });

  // Restaura la sesión si ya existe la cookie de empleado (recarga de página).
  useEffect(() => {
    let alive = true;
    apiEmployeeMe().then((user) => {
      if (alive && user) {
        setAuthState({
          loggedIn: true,
          name: user.name,
          role: user.role,
          email: user.email,
          error: null,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, pass: string): Promise<boolean> => {
      if (email.trim() === "" || pass === "") {
        setAuthState((s) => ({
          ...s,
          error: "Ingresa tu correo y contraseña.",
        }));
        return false;
      }
      try {
        const user = await apiEmployeeLogin(email.trim(), pass);
        setAuthState({
          loggedIn: true,
          name: user.name,
          role: user.role,
          email: user.email,
          error: null,
        });
        return true;
      } catch (e) {
        setAuthState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "No se pudo iniciar sesión.",
        }));
        return false;
      }
    },
    []
  );

  // El registro de empleados se gestiona desde el panel (Usuarios); aquí solo
  // validamos el formulario para la demo.
  const register = useCallback((data: RegisterData): boolean => {
    const name = data.name.trim();
    const email = data.email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const setErr = (error: string) => {
      setAuthState((s) => ({ ...s, error }));
      return false;
    };
    if (name === "") return setErr("Ingresa tu nombre completo.");
    if (!emailOk) return setErr("Ingresa un correo válido.");
    if (data.pass.length < 6)
      return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (data.pass !== data.confirm)
      return setErr("Las contraseñas no coinciden.");
    return setErr(
      "El registro de nuevos empleados aún no está habilitado. Ingresa con una cuenta existente."
    );
  }, []);

  const logout = useCallback(() => {
    apiEmployeeLogout();
    setAuthState({
      loggedIn: false,
      name: "",
      role: "",
      email: "",
      error: null,
    });
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

  // ---------- Pedidos (respaldados por la base de datos) ----------
  const [orders, setOrders] = useState<Order[]>([]);

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(await apiListOrders());
    } catch {
      // Sin sesión o BD no disponible: deja la lista como está.
    }
  }, []);

  // Carga los pedidos de la BD al iniciar sesión y los limpia al salir.
  // Mientras la sesión está activa, refresca en vivo para que las ventas
  // hechas desde la tienda web aparezcan en el panel sin recargar la página:
  //   · sondeo periódico cada 10 s
  //   · al volver el foco / la pestaña a primer plano
  useEffect(() => {
    if (!authState.loggedIn) {
      setOrders([]);
      return;
    }
    refreshOrders();
    const interval = setInterval(refreshOrders, 10_000);
    const onFocus = () => refreshOrders();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOrders();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authState.loggedIn, refreshOrders]);

  // Código provisional para la vista optimista; la BD asigna el definitivo.
  const nextCode = useCallback(() => "PED-nuevo", []);

  const addOrder = useCallback(
    (o: Order) => {
      // Optimista: muéstralo de inmediato y persiste en la BD.
      setOrders((os) => [o, ...os]);
      apiCreateOrder(orderToPayload(o))
        .then(() => refreshOrders())
        .catch(() => refreshOrders());
    },
    [refreshOrders]
  );

  const setStatus = useCallback((o: Order, s: OrderStatus) => {
    setOrders((os) =>
      os.map((x) => (x.code === o.code ? { ...x, status: s } : x))
    );
    apiPatchStatus(o.code, s).catch(() => {});
  }, []);

  const removeOrder = useCallback((o: Order) => {
    setOrders((os) => os.filter((x) => x.code !== o.code));
    apiDeleteOrder(o.code).catch(() => {});
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
