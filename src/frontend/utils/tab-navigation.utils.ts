export class TabNavigationUtils {
    static replaceQuery(params: URLSearchParams, pathname?: string): void {
        if (typeof window === 'undefined') {
            return;
        }

        const targetPath = pathname ?? window.location.pathname;
        const query = params.toString();
        window.history.replaceState(null, '', query ? `${targetPath}?${query}` : targetPath);
    }
}
