import { ApolloServer, gql, makeExecutableSchema } from 'apollo-server-express';
import { ObjectID, ObjectId } from 'bson';
import { readFileSync } from "fs";
import { v4 as uuid } from 'uuid';
import { getUsers, User } from './connection';
import { GRAPHQL_SCHEMA_FILE } from "./constants";
import { AnyScalarType, KeyValuePairScalarType } from './scalarTypes';

interface Scope {
    scope?: string;
    userId?: ObjectID;
    ok?: boolean;
    message?: string;
}

/**
 * Create an GraphQl Server
 * 
 * @author Masoud Zohrabi <mdzzohrabi@gmail.com>
 */
export async function createApiServer() {

    let users  = await getUsers();
    let schema = makeExecutableSchema({
        resolverValidationOptions: {
            requireResolversForResolveType: false
        },
        typeDefs: gql( readFileSync(GRAPHQL_SCHEMA_FILE).toString() ),
        resolvers: {
            Any: AnyScalarType,
            KeyValuePair: KeyValuePairScalarType,
            Query: {
                // Dive into scope
                scope(_parent: any, { scope }) { return scope; },

                // Scopes list
                async scopes() {
                    let result = await users.aggregate([
                        { $group: { _id: '$scope' } }
                    ]).toArray();

                    return result.map(i => i._id);
                }
            },
            Login: {
                async user(parent: any) {
                    if ( parent.user instanceof ObjectId )
                        return await users.findOne({ _id: parent.user });
                    return parent.user;
                }
            },
            Scope: {
                // Users list
                async users ( scope: string ) {
                    return users.find({ scope }).toArray();
                },

                // Retrieve user by token
                async userByToken ( scope: string, { token }: { token: string }) {
                    return await users.findOne({ scope, 'tokens.token': token });
                },

                // Retrieve user by id
                async userById ( scope: string, { id }: { id: string }) {
                    return await users.findOne({ scope, _id: new ObjectId(id) });
                },
                
                // Revoke a login token
                async revokeToken(scope: string, { token, appName }) {

                    let result = await users.updateMany({ scope, tokens: { $elemMatch: {token, appName} } }, {
                        $unset: { 'tokens.$': "" }
                    });

                    // Remove null tokens
                    await users.updateMany({}, { $pull: { tokens: null } });

                    if (result.modifiedCount > 0) return { ok: true, message: 'Token revoked' };
                    else if (result.matchedCount > 0) return { ok: false, message: 'Token not found' };
                    else return { ok: false, message: 'User not found' };

                },

                // Login user by token
                async loginByToken(scope: string, { appName, token, ip }) {

                    let dbToken = await users.findOneAndUpdate({ scope, tokens: { $elemMatch: { token, appName } } }, {
                        $set: {
                            'tokens.$.lastUse': new Date,
                            'tokens.$.ip': ip,
                            lastLogin: new Date
                    }}, {
                        projection: {
                            'tokens.$': 1
                        }
                    });

                    if ( !dbToken.value )
                        return { __typename: 'Result', ok: false, message: 'Token is invalid' };

                    return {
                        __typename: 'Login',
                        user: dbToken.value._id,
                        token: dbToken.value.tokens.pop()
                    };

                },

                // Login by username and password
                async login(scope: string, { userName, password, appName, ip }) {
                    let token = {
                        appName, ip,
                        token: uuid(),
                        createDate: new Date,
                        lastUse: new Date
                    };

                    let user = await users.findOne({
                        scope,
                        username: userName,
                        password
                    });

                    if (!user) return { ok: false, message: 'User not found', __typename: 'Result' };

                    let dbToken = await users.findOneAndUpdate({
                        _id: user._id,
                        'tokens.appName': appName
                    }, { $set: { 'tokens.$.lastUse': new Date, 'tokens.$.ip': ip, lastLogin: new Date } }, {
                        projection: {
                            'tokens.$': 1
                        }
                    });

                    if ( !dbToken.value ) {
                        await users.updateOne({ _id: user._id }, { $push: { tokens: token }, $set: { lastLogin: new Date } });
                    } else {
                        token = dbToken.value.tokens.pop();
                    }

                    return {
                        __typename: 'Login',
                        user: user,
                        token
                    }
                }
            },
            User: {
                // User Id Field
                id: (user: any) => user._id,

                // User acl list
                acl( user: User, { filter }: { filter: string[] }) {
                    if ( filter ) return user.acl.filter(item => filter.includes(item.name));
                    return user.acl;
                },

                // User acl list
                attrs( user: User, { filter }: { filter: string[] }) {
                    if ( filter ) {
                        let result = {};
                        filter.forEach(name => result[name] = user.attrs[name] || null);
                        return result;
                    }
                    return user.attrs;
                }
            },
            Mutation: {
                // Dive into scope
                scope(_parent: any, { scope }) { return scope; },
                contextScope(_parent, _args, { scope }) {
                    return scope;
                },
            },
            ScopeMutation: {

                // Delete all users
                async deleteAll(scope: string) {
                    let result = await users.deleteMany({ scope });
                    return { ok: true, message: `${ result.deletedCount } Users deleted` };
                },

                // Add user
                async addUser(scope: string, { user }): Promise<Scope> {
                    let { _id, ..._user } = user;
                    _user.scope = scope;
                    const r = await users.insertOne(_user);
                    return { userId: r.insertedId, scope };
                },

                // Dive into user mutations
                user(scope: string, { id }): Scope {
                    return {
                        scope,
                        userId: new ObjectId(id)
                    };
                }
            },

            /**
             * User mutation's
             */
            UserMutation: {

                /**
                 * Return the current scope value
                 * @route scope.user.scope
                 */
                scope({ scope }: Scope) {
                    return scope;
                },
                
                /**
                 * Return the user
                 * @route scope.user.user
                 */
                async user({ scope, userId }: Scope) {
                    return await users.findOne({ _id: userId, scope });
                },

                /**
                 * Change user password
                 * @route scope.user.setPassword
                 */
                async setPassword({ userId, scope }: Scope, { oldPassword, newPassword }) {
                    const r = await users.updateOne({ _id: userId, scope }, {
                        $set: { password: newPassword }
                    });
                    return { userId, scope, ok: true, message: 'Password changed successfull' };
                },
                
                /**
                 * Delete selected user
                 * @route scope.user.delete
                 */
                async delete({ userId, scope }: Scope): Promise<Scope> {
                    let result = await users.deleteOne({ _id: userId, scope });
                    if (result.deletedCount > 0)
                        return { ok: true, message: 'User deleted', scope, userId };
                    else
                        return { ok: false, message: 'User not found', userId, scope };
                },

                /**
                 * Add acl to selected user
                 * @route scope.user.addAcl
                 */
                async addAcl({ userId, scope }: Scope, { name, value }): Promise<Scope> {

                    let result = await users.updateOne({ _id: userId, 'acl.name': name }, {
                        $set: { 'acl.$.value': value }
                    });

                    if ( result.matchedCount <= 0 ) {
                        await users.updateOne({ _id: userId }, { $push: { acl: value ? { name, value } : { name } } });
                    }

                    return { ok: true, message: 'Acl added/modified successfull', scope, userId };

                },

                /**
                 * Add bulk acl tokens to selected user
                 * @route scope.use.addBulkAcl
                 */
                async addBulkAcl({ userId, scope }: Scope, { name }: { name: string[] }): Promise<Scope> {

                    let user = await users.findOne({ _id: userId });

                    let acl = user.acl || [];
                    
                    name.forEach(acl => {
                        if (user.acl.filter(item => item.name == acl).length <= 0)
                            user.acl.push({ name: acl });
                    });

                    let result = await users.updateOne({ _id: userId }, { $set: { acl } });

                    if ( result.upsertedCount <= 0 && result.modifiedCount <= 0 && result.matchedCount <= 0 ) {
                        return { ok: true, message: 'No Acl Added', userId, scope };
                    }

                    return { ok: true, message: 'Acl added/modified successfull', scope, userId };
                },

                /**
                 * Delete acl tokens from selected user
                 * @route scope.user.deleteAcl
                 */
                async deleteAcl({ userId, scope }: Scope, { name: names }: { name: string[] }): Promise<Scope> {

                    // find user
                    let user = await users.findOne({ _id: userId, scope });

                    // remove acl
                    let acl = (user.acl || []).filter(acl => !names.includes(acl.name) );

                    // store changes
                    let result = await users.updateOne({ _id: userId, scope }, {
                        $set: { acl }
                    });

                    if ( result.matchedCount > 0 ) {
                        await users.updateOne({ _id: userId }, { $pull : { acl: null } });
                    }
                    else {
                        return {  ok: false, message: 'Acl "' + names.join('", "') + '" not found', scope, userId }
                    }

                    return { ok: true, message: 'Acl removed successfull', scope, userId };

                },

                /**
                 * Set user attribute
                 * @route scope.user.setAttr
                 */
                async setAttr(scope: Scope, { name, value }) {

                    await users.updateOne({ scope: scope.scope, _id: scope.userId }, {
                        $set: {
                            [`attrs.${ name }`]: value
                        }
                    });

                    return { ...scope, message: 'Attribute changed successfull', ok: true };
                },

                /**
                 * Set user attributes
                 * @route scope.user.setAttr
                 */
                async setAttrs(scope: Scope, { attrs }) {
                    let setter = {};
                    Object.keys( attrs ).forEach( attr => setter['attrs.' + attr] = attrs[attr] );

                    await users.updateOne({ scope: scope.scope, _id: scope.userId }, { $set: setter });

                    return { ...scope, message: 'Attributes changed successfull', ok: true };
                },

                /**
                 * Delete attributes
                 * @route scope.user.setAttr
                 */
                async deleteAttrs(scope: Scope, { attrs }: { attrs: string[] }) {
                    let setter = {};
                    
                    attrs.forEach( attr => setter['attrs.' + attr] = "" );

                    await users.updateOne({ scope: scope.scope, _id: scope.userId }, {
                        $unset: setter
                    });

                    return { ...scope, message: 'Attributes deleted successfull', ok: true };
                },
            }
        }
    });

    let server = new ApolloServer({ schema });

    return server;
}
