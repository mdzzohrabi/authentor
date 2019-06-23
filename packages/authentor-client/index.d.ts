export declare let DefaultUserFields: UserFields;
export declare class Scope {
    scope: string;
    client: AuthClient;
    /**
     * Scope query/mutation constructor
     * @param scope Scope name
     * @param client Auth(entciation/orization) client
     */
    constructor(scope: string, client: AuthClient);
    private query;
    /**
     * Get users list
     * @param options Options
     */
    users<F extends keyof User>(...fields: F[]): Promise<Pick<User, F>[]>;
    userById(id: string, fields?: UserFields): Promise<User>;
}
export declare class AuthClient {
    endPoint: string;
    /**
     * Scope instances cache
     */
    private _scopes;
    private _pool;
    constructor(endPoint: string);
    /**
     * Dive into scope
     * @param scopeName Scope name
     */
    scope(scopeName: string): Scope;
    /**
     * Make a graphql query to server
     * @param query Query string
     * @param variables Variables
     */
    query<T>(query: string, variables?: QueryVariables): Promise<any>;
}
export interface ScopeCache {
    [scope: string]: Scope;
}
export interface QueryVariables {
    [name: string]: any;
}
export interface User {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    attrs: {
        [name: string]: any;
    };
    tokens: LoginToken[];
    acl: AccessToken[];
    lastPasswordChange: string;
    lastLogin: string;
}
export declare type UserFields = Array<keyof User>;
export interface LoginToken {
    appName: string;
    token: string;
    lastUse: string;
    createDate: string;
    ip: string;
}
export interface AccessToken {
    name: string;
    value?: any;
}
export interface ScopeQuery {
    users: User[];
}
