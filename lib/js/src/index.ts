import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloClient } from 'apollo-client';
import { createHttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

export class Scope {

    /**
     * Scope query/mutation constructor
     * @param scope Scope name
     * @param client Auth(entciation/orization) client
     */
    constructor(
        public scope: string,
        public client: AuthClient) {}

    getUsers(options?: {
        fields: UserFields
    }): Promise<User[]> {

        options = { fields: ['username', 'firstName', 'lastName', 'email'], ...options };

        return this.client.query<User[]>(`
        query Users($scope: String!) {
            scope(scope: $scope) {
                users {
                    ${ options.fields.join(' ') }
                }
            }
        }
        `).then(result => {
            return result.data;
        });
    }

}

export class AuthClient {

    /**
     * Scope instances cache
     */
    private _scopes: ScopeCache = {};

    private apollo = new ApolloClient({
        link: createHttpLink({ uri: this.endPoint }),
        cache: new InMemoryCache()
    });

    constructor(public endPoint: string) {}
    
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
    query<T>(query: string, variables?: QueryVariables) {
        return this.apollo.query<T>({
            query: gql( query ),
            variables
        });
    }
}

export interface ScopeCache { [scope: string]: Scope }
export interface QueryVariables { [name: string]: any }

export interface User {
    username: string
    firstName: string
    lastName: string
    email: string
    attrs: { [name: string]: any }
    tokens: LoginToken[]
    acl: AccessToken[]
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