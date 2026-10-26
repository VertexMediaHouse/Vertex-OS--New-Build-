import { Link as RouterLink } from "react-router";

type Props = Omit<React.ComponentProps<typeof RouterLink>, "to"> & {
  href: string;
  /** false keeps the scroll position, for links that only open a side panel. */
  scroll?: boolean;
};

/** React Router's Link with an `href` prop, so call sites read like anchors. */
export default function Link({ href, scroll, ...props }: Props) {
  return <RouterLink to={href} preventScrollReset={scroll === false} {...props} />;
}
