import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SplitButtonProps = ComponentProps<typeof Button> & {
    containerClassName?: string;
    dropdownContent?: ReactNode;
    dropdownLabel?: string;
    dropdownAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
};

export function SplitButton({
    children,
    className,
    containerClassName,
    disabled,
    dropdownAlign = 'end',
    dropdownContent,
    dropdownLabel = 'More actions',
    size,
    variant,
    ...buttonProps
}: SplitButtonProps) {
    const primaryButton = (
        <Button
            {...buttonProps}
            disabled={disabled}
            size={size}
            variant={variant}
            className={cn(className, dropdownContent && 'rounded-r-none')}
        >
            {children}
        </Button>
    );

    if (!dropdownContent) {
        return primaryButton;
    }

    return (
        <div className={cn('flex', containerClassName)}>
            {primaryButton}
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={disabled}
                    render={<Button
                        type="button"
                        aria-label={dropdownLabel}
                        disabled={disabled}
                        size={size}
                        variant={variant}
                        className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    />}
                >
                    <ChevronDown data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={dropdownAlign}>
                    {dropdownContent}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
