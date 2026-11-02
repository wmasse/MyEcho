import { ViewTransition } from "react";

/*
 * Wraps a page's content so moving between pages crossfades instead of
 * snapping. The nav keeps its own name (see SiteNav), so it holds still
 * while everything below it fades across. Styles: "Page transitions" in
 * app/globals.css.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
