import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children, ...rest }: PageTransitionProps & Record<string, unknown>) {
  return (
    <div className="page-transition" data-testid="page-transition" {...rest}>
      {children}
    </div>
  );
}
