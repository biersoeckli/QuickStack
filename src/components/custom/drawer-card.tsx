import * as React from "react";
import { cn } from "cn";

function DrawerCard({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-card"
            className={cn(
                "flex flex-col gap-6 text-sm text-card-foreground [--card-spacing:0px] [&>form]:flex [&>form]:flex-col [&>form]:gap-6",
                className,
            )}
            {...props}
        />
    );
}

function DrawerCardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-card-header"
            className={cn("grid auto-rows-min items-start gap-2", className)}
            {...props}
        />
    );
}

function DrawerCardTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-card-title"
            className={cn("font-heading text-base font-medium", className)}
            {...props}
        />
    );
}

function DrawerCardDescription({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-card-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function DrawerCardContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="drawer-card-content" className={cn(className)} {...props} />;
}

function DrawerCardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="drawer-card-footer"
            className={cn("flex items-center", className)}
            {...props}
        />
    );
}

export {
    DrawerCard,
    DrawerCardHeader,
    DrawerCardTitle,
    DrawerCardDescription,
    DrawerCardContent,
    DrawerCardFooter,
};
