import { AppPodsStatusModel } from "@/shared/model/app-pod-status.model";
import { ReactNode } from "react";
import { create } from "zustand"

interface ZustandConfirmDialogProps {
    isDialogOpen: boolean;
    data: DialogProps | null;
    resolvePromise: ((result: boolean) => void) | null;
    openConfirmDialog: (data: DialogProps) => Promise<boolean>;
    closeDialog: (result: boolean) => void;
}

export interface DialogProps {
    title: string;
    description: ReactNode;
    okButton?: string;
    cancelButton?: string;
}

export interface InternDialogProps extends DialogProps {
    returnFunc: (dialogResult: boolean) => boolean;
}

export const useConfirmDialog = create<ZustandConfirmDialogProps>((set) => ({
    isDialogOpen: false,
    data: null,
    resolvePromise: null,
    openConfirmDialog: (data) => {
        return new Promise((resolve) => {
            set({
                isDialogOpen: true,
                data: data,
                resolvePromise: resolve,
            });
        });
    },
    closeDialog: (result) => set((state) => {
        if (state.resolvePromise) {
            state.resolvePromise(result); // Erfülle das Promise mit true oder false
        }
        return { isDialogOpen: false, userInfo: null, resolvePromise: null };
    }),
}));

interface ZustandBreadcrumbsProps {
    breadcrumbs: Breadcrumb[] | null;
    setBreadcrumbs: ((result: Breadcrumb[]) => void);
}

export interface BreadcrumbDropdownItem {
    name: string;
    url: string;
    active?: boolean;
}

export interface Breadcrumb {
    name: string;
    url?: string;
    dropdownItems?: BreadcrumbDropdownItem[];
}

export const useBreadcrumbs = create<ZustandBreadcrumbsProps>((set) => ({
    breadcrumbs: null,
    setBreadcrumbs: (data) => {
        set({
            breadcrumbs: data,
        });
    },
}));

/* Input Dialog */
interface ZustandInputDialogProps {
    isDialogOpen: boolean;
    data: InputDialogProps | null;
    resolvePromise: ((result?: string) => void) | null;
    openInputDialog: (data: InputDialogProps) => Promise<string | undefined>;
    closeDialog: (result?: string) => void;
}

export interface InputDialogProps extends DialogProps {
    inputValue?: string;
    inputType?: 'text' | 'number';
    placeholder?: string;
    fieldName?: string;
}

export const useInputDialog = create<ZustandInputDialogProps>((set) => ({
    isDialogOpen: false,
    data: null,
    resolvePromise: null,
    openInputDialog: (data) => {
        return new Promise<string | undefined>((resolve) => {
            set({
                isDialogOpen: true,
                data: data,
                resolvePromise: resolve,
            });
        });
    },
    closeDialog: (result) => set((state) => {
        if (state.resolvePromise) {
            state.resolvePromise(result); // Erfülle das Promise mit true oder false
        }
        return { isDialogOpen: false, userInfo: null, resolvePromise: null };
    }),
}));

/* Pod Status Store */
interface ZustandPodsStatusProps {
    podsStatus: Map<string, AppPodsStatusModel>;
    lastUpdate: Date | null;
    isLoading: boolean;
    listeners: Set<(changedAppIds: string[]) => void>;
    setPodsStatus: (data: AppPodsStatusModel[]) => void;
    updatePodStatus: (data: AppPodsStatusModel) => void;
    setLoading: (loading: boolean) => void;
    getPodsForApp: (appId: string) => AppPodsStatusModel | undefined;
    subscribeToStatusChanges: (callback: (changedAppIds: string[]) => void) => () => void;
}

export const usePodsStatus = create<ZustandPodsStatusProps>((set, get) => ({
    podsStatus: new Map(),
    lastUpdate: null,
    isLoading: true,
    listeners: new Set(),
    setPodsStatus: (data) => {
        set({
            podsStatus: new Map(data.map(app => [app.appId, app])),
            lastUpdate: new Date(),
            isLoading: false,
        });
        get().listeners.forEach(listener => listener(data.map(d => d.appId)));
    },
    updatePodStatus: (data) => {
        set((state) => {
            const newMap = new Map(state.podsStatus);
            newMap.set(data.appId, data);
            return {
                podsStatus: newMap,
                lastUpdate: new Date(),
            };
        });
        get().listeners.forEach(listener => listener([data.appId]));
    },
    setLoading: (loading) => {
        set({ isLoading: loading });
    },
    getPodsForApp: (appId) => {
        return get().podsStatus.get(appId);
    },
    subscribeToStatusChanges: (callback) => {
        set((state) => {
            const newListeners = new Set(state.listeners);
            newListeners.add(callback);
            return { listeners: newListeners };
        });
        return () => {
            set((state) => {
                const newListeners = new Set(state.listeners);
                newListeners.delete(callback);
                return { listeners: newListeners };
            });
        };
    }
}));


/* Generic Dialog */
export interface DialogSizeProps {
    width?: string;
    height?: string;
    maxWidth?: string;
    maxHeight?: string;
}

interface ZustandGenericDialogProps {
    isDialogOpen: boolean;
    content: ReactNode | null;
    width?: string;
    height?: string;
    maxWidth?: string;
    maxHeight?: string;
    resolvePromise: ((result?: any) => void) | null;
    openDialog: (
        content: ReactNode,
        widthOrSize?: string | DialogSizeProps,
        height?: string,
        maxWidth?: string,
        maxHeight?: string
    ) => Promise<any>;
    closeDialog: (result?: any) => void;
}

const getDialogSizeProps = (
    widthOrSize?: string | DialogSizeProps,
    height?: string,
    maxWidth?: string,
    maxHeight?: string
): DialogSizeProps => {
    if (widthOrSize && typeof widthOrSize === 'object') {
        return widthOrSize;
    }

    return {
        width: widthOrSize,
        height,
        maxWidth,
        maxHeight,
    };
};

export const useDialog = create<ZustandGenericDialogProps>((set) => ({
    isDialogOpen: false,
    content: null,
    resolvePromise: null,
    openDialog: (content, widthOrSize, height, maxWidth, maxHeight) => {
        const size = getDialogSizeProps(widthOrSize, height, maxWidth, maxHeight);

        return new Promise<any>((resolve) => {
            set({
                isDialogOpen: true,
                content: content,
                width: size.width ?? undefined,
                height: size.height ?? undefined,
                maxWidth: size.maxWidth ?? undefined,
                maxHeight: size.maxHeight ?? undefined,
                resolvePromise: resolve,
            });
        });
    },
    closeDialog: (result) => set((state) => {
        if (state.resolvePromise) {
            state.resolvePromise(result);
        }
        return {
            isDialogOpen: false,
            content: null,
            width: undefined,
            height: undefined,
            maxWidth: undefined,
            maxHeight: undefined,
            resolvePromise: null,
        };
    }),
}));
