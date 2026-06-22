export class ServiceException extends Error {
    constructor(message: string) {
        super(message);
        this.name = ServiceException.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ApiUnauthorizedException extends Error {
    public readonly statusCode = 401;
    public readonly title: string;

    constructor(title?: string, message?: string) {
        super(message || 'Authentication checks did not pass for this request.');
        this.title = title || 'Unauthorized';
        this.name = ApiUnauthorizedException.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ApiNotFoundException extends Error {
    public readonly statusCode = 404;
    public readonly title: string;

    constructor(title?: string, message?: string) {
        super(message || 'The requested resource was not found.');
        this.title = title || 'Not Found';
        this.name = ApiNotFoundException.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
