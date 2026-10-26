import { useLocation } from "react-router";

export { useNavigate, useSearchParams } from "react-router";

export const usePathname = () => useLocation().pathname;
