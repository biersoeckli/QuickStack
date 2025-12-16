import dataAccess from "@/server/adapter/db.client";
import { create } from "zustand"
import { AppPodsStatusModel } from "@/app/api/deployment-status/actions";

interface ZustandConfirmDialogProps {
    isDialogOpen: boolean;
    data: DialogProps | null;
    resolvePromise: ((result: boolean) => void) | null;
    openConfirmDialog: (data: DialogProps) => Promise<boolean>;
    closeDialog: (result: boolean) => void;
}

export interface DialogProps {
    title: string;
    description: string | JSX.Element;
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

export interface Breadcrumb {
    name: string;
    url?: string;
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
    setPodsStatus: (data: AppPodsStatusModel[]) => void;
    setLoading: (loading: boolean) => void;
    getPodsForApp: (appId: string) => AppPodsStatusModel | undefined;
}

export const usePodsStatus = create<ZustandPodsStatusProps>((set, get) => ({
    podsStatus: new Map(),
    lastUpdate: null,
    isLoading: true,
    setPodsStatus: (data) => {
        set({
            podsStatus: new Map(data.map(app => [app.appId, app])),
            lastUpdate: new Date(),
            isLoading: false,
        });
    },
    setLoading: (loading) => {
        set({ isLoading: loading });
    },
    getPodsForApp: (appId) => {
        return get().podsStatus.get(appId);
    },
}));
