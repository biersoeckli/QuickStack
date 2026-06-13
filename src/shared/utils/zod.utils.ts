import { z, ZodObject, ZodRawShape } from "zod";

export const stringToNumber = z.union([z.string(), z.number()])
    .transform((val) => {
        if (typeof val === 'string') {
            const parsed = parseFloat(val);
            if (isNaN(parsed)) {
                return null;
            }
            return parsed;
        }
        return val;
    })
    .refine((val) => typeof val === 'number', {
        message: 'Der Eingegebene Wert muss eine Zahl sein.',
    });

export const stringToOptionalNumber = z.preprocess((val) => {
    if (val === null || val === undefined) {
        return null;
    }
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (isNaN(parsed)) {
            return null;
        }
        return parsed;
    }
    return val;
}, z.number().positive().nullish());

export const stringToOptionalDate = z.preprocess((val) => {
    if (val === null || val === undefined) {
        return null;
    }
    if (typeof val === 'string') {
        const parsed = new Date(val);
        if (isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    }
    return val;
}, z.date().nullish());

export const stringToDate = z.union([z.string(), z.date()])
    .transform((val) => {
        if (typeof val === 'string') {
            const parsed = new Date(val);
            if (isNaN(parsed.getTime())) {
                return null;
            }
            return parsed;
        }
        return val;
    })
    .refine((val) => val instanceof Date, {
        message: 'Der Eingegebene Wert muss ein Datum sein.',
    });

export const stringToOptionalBoolean = z.preprocess((val) => {
    if (val === null || val === undefined) {
        return null;
    }
    if (typeof val === 'string') {
        if (val === 'true') {
            return true;
        }
        if (val === 'false') {
            return false;
        }
        return null;
    }
    return val;
}, z.boolean().nullish());

export const stringToBoolean = z.preprocess((val) => {
    if (val === null || val === undefined) {
        return false;
    }
    if (typeof val === 'string') {
        if (val === 'true') {
            return true;
        }
        if (val === 'false') {
            return false;
        }
        return false;
    }
    if (typeof val === 'boolean') {
        return val;
    }
    return false; // default false
}, z.boolean());
