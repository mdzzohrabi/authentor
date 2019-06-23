// import ApolloClient from 'apollo-boost';
// import gql from 'graphql-tag';
import fetch from 'cross-fetch';
import invariant from 'ts-invariant';
import { createSocketPool, SocketPool } from './spool';

export let DefaultUserFields: UserFields = ['username', 'firstName', 'lastName', 'email'];

function getGqlType(value: any) {
    switch (typeof value) {
        case "number": return "Int!";
        case "string": return "String!";
        case "boolean": return "Boolean!";
        default: return "String!";
    }
}

let endAction = Buffer.from('$END$');

export class Scope {

    /**
     * Scope query/mutation constructor
     * @param scope Scope name
     * @param client Auth(entciation/orization) client
     */
    constructor(
        public scope: string,
        public client: AuthClient) {}

    private query<T>(name: string, query: string, variables: any = {}) {
        variables.scope = this.scope;
        return this.client.query(`query ${name}(${ Object.keys(variables).map(v => `$${v}: ${ getGqlType(variables[v]) }`) }) { scope(scope: $scope) { ${ query } } }`, variables).then(r => r.data.scope) as Promise<T>;
    }

    /**
     * Get users list
     * @param options Options
     */
    users<F extends keyof User>(...fields: F[]): Promise<Pick<User, F>[]> {
        invariant(fields.length > 0, `No fields specified for query`);
        return this.query<{ users: User[] }>('users', `users {
            ${ fields.join(' ') }
        }`).then(result => result.users);
    }

    userById(id: string, fields?: UserFields) {
        fields = fields || DefaultUserFields;
        return this.query<{userById: User}>('userByID', `userById(id: $id) { ${ fields.join(' ') } }`, { id }).then(r => r.userById);
    }

}

export class AuthClient {

    /**
     * Scope instances cache
     */
    private _scopes: ScopeCache = {};
    private _pool: SocketPool;

    constructor(public endPoint: string) {
        let [host, port] = this.endPoint.split(':');
        this._pool = createSocketPool({
            host, port: Number(port)
        })
    }
    
    /**
     * Dive into scope
     * @param scopeName Scope name
     */
    scope(scopeName: string) {
        return this._scopes[scopeName] || ( this._scopes[scopeName] = new Scope(scopeName, this) );
    }

    /**
     * Make a graphql query to server
     * @param query Query string
     * @param variables Variables
     */
    query<T>(query: string, variables?: QueryVariables): Promise<any> {
        return new Promise(async (resolve, reject) => {
            let socket = await this._pool.acquire();
            let result = '';
            
            socket.write(`$QUERY$`, err => {
                socket.write(JSON.stringify({ query, variables }), err => {
                    socket.write(endAction);
                });
            });

            let responseHandler = (data: Buffer) => {
                if (data.equals(endAction)) {
                    socket.off('data', responseHandler);
                    resolve(JSON.parse(result));
                    this._pool.release(socket);
                    return;
                }
                result += data.toString();
            }

            socket.on('data', responseHandler);

        });

        // return gqlRequest(this.endPoint, { query, variables });
    }
}

async function gqlRequest(url: string, request: GQLRequest) {

    request.query = request.query.trim().replace(/\s{2,}|\n/g, ' ');

    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    });

    if (response.status == 400)
        throw await response.json();

    return await response.json();
}

interface GQLRequest {
    query?: string
    mutation?: string
    variables?: object
}


export interface ScopeCache { [scope: string]: Scope }
export interface QueryVariables { [name: string]: any }

export interface User {
    id: string
    username: string
    firstName: string
    lastName: string
    email: string
    attrs: { [name: string]: any }
    tokens: LoginToken[]
    acl: AccessToken[]
    lastPasswordChange: string
    lastLogin: string
}

export type UserFields = Array<keyof User>;

export interface LoginToken {
    appName: string
    token: string
    lastUse: string
    createDate: string
    ip: string
}

export interface AccessToken {
    name: string
    value?: any
}

export interface ScopeQuery {
    users: User[]
}