import { MongoClient, ObjectID } from "mongodb";
import { APP_NAME, DB_NAME, USERS_COLLECTION } from "./constants";

/** Connectoin singleton instance */
let connection: Promise<MongoClient>;

/**
 * Create a connection to mongo
 */
export function createConnection() {
    return MongoClient.connect('mongodb://localhost:27018/', {
        appname: APP_NAME,
        useNewUrlParser: true
    });
}

/**
 * Get connection instance
 */
export function getConnection() {
    return connection || (connection = createConnection());
}

export async function getDb() {
    return (await getConnection()).db(DB_NAME);
}

export async function getUsers() {
    return getDb().then(db => db.collection<User>(USERS_COLLECTION));
}

export interface User {
    _id: ObjectID
    scope: string
    username: string
    firstName: string
    lastName: string
    password: string
    email: string
    tokens?: UserToken[]
    acl: AclToken[]
    attrs: { [key: string]: any }
    lastLogin?: Date
    lastPasswordChange?: Date
}

export interface UserToken {
    appName: string
    ip: string
    token: string
    lastUse: Date
    createDate: Date
}

export interface AclToken {
    name: string
    value?: any
}