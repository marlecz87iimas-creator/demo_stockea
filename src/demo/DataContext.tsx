import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_LIMIT, demoLimitMessage, uid, type DemoEntity } from './config';

export interface DemoItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  kind: 'product' | 'material';
  createdAt: string;
}

export interface DemoSale {
  id: string;
  folio: string;
  customer: string;
  total: number;
  payment: string;
  createdAt: string;
}

export interface DemoBranch {
  id: string;
  name: string;
  code: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface DemoSystem {
  id: string;
  name: string;
  tipo: string;
}

interface DemoData {
  productos: DemoItem[];
  materiales: DemoItem[];
  ventas: DemoSale[];
  sucursales: DemoBranch[];
  usuarios: DemoUser[];
  sistemas: DemoSystem[];
}

interface DemoContextValue extends DemoData {
  orgName: string;
  canAdd: (entity: DemoEntity) => boolean;
  remaining: (entity: DemoEntity) => number;
  limitMessage: (entity: DemoEntity) => string;
  addProducto: (input: Omit<DemoItem, 'id' | 'kind' | 'createdAt'>) => string | null;
  addMaterial: (input: Omit<DemoItem, 'id' | 'kind' | 'createdAt'>) => string | null;
  addVenta: (input: Omit<DemoSale, 'id' | 'folio' | 'createdAt'>) => string | null;
  addSucursal: (input: Omit<DemoBranch, 'id'>) => string | null;
  addUsuario: (input: Omit<DemoUser, 'id'>) => string | null;
  addSistema: (input: Omit<DemoSystem, 'id'>) => string | null;
  remove: (entity: DemoEntity, id: string) => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function emptyData(): DemoData {
  return {
    productos: [],
    materiales: [],
    ventas: [],
    sucursales: [{ id: 'branch-1', name: 'Matriz', code: 'MAT' }],
    usuarios: [{ id: 'user-1', name: 'Usuario Demo', role: 'Principal', email: 'demo@stockea.app' }],
    sistemas: [{ id: 'sys-1', name: 'Demo Stockea', tipo: 'REFACCIONARIA' }],
  };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(emptyData);
  const [saleSeq, setSaleSeq] = useState(0);

  const countOf = useCallback((entity: DemoEntity, current: DemoData): number => {
    if (entity === 'sucursales') return current.sucursales.length;
    if (entity === 'usuarios') return current.usuarios.length;
    if (entity === 'sistemas') return current.sistemas.length;
    return current[entity].length;
  }, []);

  const canAdd = useCallback(
    (entity: DemoEntity) => countOf(entity, data) < DEMO_LIMIT,
    [countOf, data],
  );

  const remaining = useCallback(
    (entity: DemoEntity) => Math.max(0, DEMO_LIMIT - countOf(entity, data)),
    [countOf, data],
  );

  const limitMessage = useCallback((entity: DemoEntity) => demoLimitMessage(entity), []);

  const addProducto = useCallback((input: Omit<DemoItem, 'id' | 'kind' | 'createdAt'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.productos.length >= DEMO_LIMIT) {
        error = demoLimitMessage('productos');
        return prev;
      }
      return {
        ...prev,
        productos: [
          { ...input, id: uid('prod'), kind: 'product', createdAt: new Date().toISOString() },
          ...prev.productos,
        ],
      };
    });
    return error;
  }, []);

  const addMaterial = useCallback((input: Omit<DemoItem, 'id' | 'kind' | 'createdAt'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.materiales.length >= DEMO_LIMIT) {
        error = demoLimitMessage('materiales');
        return prev;
      }
      return {
        ...prev,
        materiales: [
          { ...input, id: uid('mat'), kind: 'material', createdAt: new Date().toISOString() },
          ...prev.materiales,
        ],
      };
    });
    return error;
  }, []);

  const addVenta = useCallback((input: Omit<DemoSale, 'id' | 'folio' | 'createdAt'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.ventas.length >= DEMO_LIMIT) {
        error = demoLimitMessage('ventas');
        return prev;
      }
      const nextSeq = saleSeq + 1;
      setSaleSeq(nextSeq);
      return {
        ...prev,
        ventas: [
          {
            ...input,
            id: uid('sale'),
            folio: `D-${String(nextSeq).padStart(3, '0')}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.ventas,
        ],
      };
    });
    return error;
  }, [saleSeq]);

  const addSucursal = useCallback((input: Omit<DemoBranch, 'id'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.sucursales.length >= DEMO_LIMIT) {
        error = demoLimitMessage('sucursales');
        return prev;
      }
      return { ...prev, sucursales: [...prev.sucursales, { ...input, id: uid('branch') }] };
    });
    return error;
  }, []);

  const addUsuario = useCallback((input: Omit<DemoUser, 'id'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.usuarios.length >= DEMO_LIMIT) {
        error = demoLimitMessage('usuarios');
        return prev;
      }
      return { ...prev, usuarios: [...prev.usuarios, { ...input, id: uid('user') }] };
    });
    return error;
  }, []);

  const addSistema = useCallback((input: Omit<DemoSystem, 'id'>) => {
    let error: string | null = null;
    setData((prev) => {
      if (prev.sistemas.length >= DEMO_LIMIT) {
        error = demoLimitMessage('sistemas');
        return prev;
      }
      return { ...prev, sistemas: [...prev.sistemas, { ...input, id: uid('sys') }] };
    });
    return error;
  }, []);

  const remove = useCallback((entity: DemoEntity, id: string) => {
    setData((prev) => ({
      ...prev,
      [entity]: prev[entity].filter((item: { id: string }) => item.id !== id),
    }));
  }, []);

  const reset = useCallback(() => {
    setData(emptyData());
    setSaleSeq(0);
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    ...data,
    orgName: data.sistemas[0]?.name || 'Demo Stockea',
    canAdd,
    remaining,
    limitMessage,
    addProducto,
    addMaterial,
    addVenta,
    addSucursal,
    addUsuario,
    addSistema,
    remove,
    reset,
  }), [
    data, canAdd, remaining, limitMessage,
    addProducto, addMaterial, addVenta, addSucursal, addUsuario, addSistema, remove, reset,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo debe usarse dentro de DemoProvider');
  return ctx;
}
