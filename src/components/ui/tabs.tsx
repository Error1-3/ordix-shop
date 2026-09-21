"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof T.List>) => (
  <T.List className={cn("flex gap-1 overflow-x-auto border-b border-border scrollbar-none", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof T.Trigger>) => (
  <T.Trigger className={cn("-mb-px whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>) => <T.Content className={cn("pt-6", className)} {...p} />;
