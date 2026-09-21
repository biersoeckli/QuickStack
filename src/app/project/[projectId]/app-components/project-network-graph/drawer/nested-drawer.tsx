'use client';

import { ArrowLeft } from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useState,
    type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

type NestedDrawerOptions = {
    title: string;
    description?: ReactNode;
    content: ReactNode;
};

type NestedDrawerContextValue = {
    openNestedDrawer: (options: NestedDrawerOptions) => void;
    closeNestedDrawer: () => void;
};

const NestedDrawerContext = createContext<NestedDrawerContextValue | null>(null);

export function NestedDrawerProvider({ children }: { children: ReactNode }) {
    const [drawer, setDrawer] = useState<NestedDrawerOptions | null>(null);
    const closeNestedDrawer = useCallback(() => setDrawer(null), []);
    const openNestedDrawer = useCallback(
        (options: NestedDrawerOptions) => setDrawer(options),
        [],
    );

    return (
        <NestedDrawerContext.Provider
            value={{ openNestedDrawer, closeNestedDrawer }}
        >
            {children}
            <Drawer
                swipeDirection="right"
                disablePointerDismissal
                modal={false}
                open={drawer !== null}
                onOpenChange={(open) => !open && closeNestedDrawer()}
            >
                <DrawerContent className="border border-border/60 data-[swipe-axis=x]:w-full sm:data-[swipe-axis=x]:w-1/2 shadow">
                    <DrawerHeader className="p-6 text-left">
                        <DrawerTitle className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 opacity-70 hover:opacity-100"
                                onClick={closeNestedDrawer}>
                                <ArrowLeft className="size-4" />
                                <span className="sr-only">Back</span>
                            </Button>
                            <span>{drawer?.title}</span>
                        </DrawerTitle>
                        {drawer?.description && (
                            <DrawerDescription>
                                {drawer.description}
                            </DrawerDescription>
                        )}
                    </DrawerHeader>
                    <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
                        <div className="p-1">
                            {drawer?.content}
                        </div>
                    </ScrollArea>
                </DrawerContent>
            </Drawer>
        </NestedDrawerContext.Provider>
    );
}

export function useNestedDrawer() {
    const context = useContext(NestedDrawerContext);

    if (!context) {
        throw new Error(
            'useNestedDrawer must be used within a NestedDrawerProvider.',
        );
    }

    return context;
}
