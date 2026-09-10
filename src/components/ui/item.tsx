import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/frontend/utils/utils';

const itemVariants = cva('group/item flex items-center gap-3 rounded-lg text-sm transition-colors', {
    variants: {
        variant: {
            default: 'bg-transparent',
            outline: 'border bg-card',
            muted: 'bg-muted/50',
        },
        size: {
            default: 'p-4',
            sm: 'p-3',
            xs: 'p-2',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
});

const Item = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof itemVariants>
>(({ className, variant, size, ...props }, ref) => (
    <div ref={ref} className={cn(itemVariants({ variant, size }), className)} {...props} />
));
Item.displayName = 'Item';

const ItemGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props} />,
);
ItemGroup.displayName = 'ItemGroup';

const ItemMedia = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'icon' | 'image' }
>(({ className, variant = 'default', ...props }, ref) => (
    <div ref={ref} className={cn('shrink-0', variant === 'icon' && 'flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground', variant === 'image' && 'size-10 overflow-hidden rounded-md', className)} {...props} />
));
ItemMedia.displayName = 'ItemMedia';

const ItemContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={cn('min-w-0 flex-1', className)} {...props} />,
);
ItemContent.displayName = 'ItemContent';

const ItemTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => <p ref={ref} className={cn('truncate font-medium leading-none', className)} {...props} />,
);
ItemTitle.displayName = 'ItemTitle';

const ItemDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => <p ref={ref} className={cn('mt-1 truncate text-xs text-muted-foreground', className)} {...props} />,
);
ItemDescription.displayName = 'ItemDescription';

const ItemActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={cn('ml-auto flex shrink-0 items-center gap-2', className)} {...props} />,
);
ItemActions.displayName = 'ItemActions';

export { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle };
