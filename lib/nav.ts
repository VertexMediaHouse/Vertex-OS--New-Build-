import { useLocation, useNavigate, useSearchParams as useRRSearchParams } from "react-router";

export { useNavigate };

export const usePathname = () => useLocation().pathname;

export function useSearchParams(): any {
  const [params, setParams] = useRRSearchParams();
  const tuple = [params, setParams];

  return new Proxy(tuple, {
    get(target, prop, receiver) {
      if (prop === "toString") {
        return () => params.toString();
      }
      if (prop in target) {
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      }
      if (prop in params) {
        const val = (params as any)[prop];
        return typeof val === "function" ? val.bind(params) : val;
      }
      return undefined;
    },
  });
}

