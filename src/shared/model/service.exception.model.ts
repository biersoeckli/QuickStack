export class ServiceException extends Error {
    constructor(message: string) {
        super(message);
        this.name = ServiceException.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ApiException extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly title: string,
        message: string,
    ) {
        super(message);
        this.name = ApiException.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ApiUnauthorizedException extends ApiException {
    constructor(title = 'Unauthorized', message = 'Authentication checks did not pass for this request.') {
        super(401, title, message);
        this.name = ApiUnauthorizedException.name;
    }
}

export class ApiNotFoundException extends ApiException {
    constructor(title = 'Not Found', message = 'The requested resource was not found.') {
        super(404, title, message);
        this.name = ApiNotFoundException.name;
    }
}

export class ApiConflictException extends ApiException {
    constructor(title = 'Conflict', message = 'The request conflicts with the current state of the resource.') {
        super(409, title, message);
        this.name = ApiConflictException.name;
    }
}
