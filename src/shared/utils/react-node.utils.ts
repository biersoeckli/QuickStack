import { isValidElement } from "react";

export class ReactNodeUtils {
    static getTextFromReactElement(element: React.ReactNode): string {
        if (typeof element === "string" || typeof element === "number") {
            return element.toString();
        }
        if (isValidElement(element)) {
            const props = element.props as { children?: React.ReactNode };
            return this.getTextFromReactElement(props.children);
        }
        if (Array.isArray(element)) {
            return element.map(child => this.getTextFromReactElement(child)).join("");
        }
        return "";
    }
}
