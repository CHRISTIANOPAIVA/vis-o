import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn("card", className)}>
      {title ? <div className="card-title">{title}</div> : null}
      {children}
    </div>
  );
}
