/// <reference types="node" />
import { Socket } from "net";
/**
 * Host and port object
 */
export interface HostPortObject {
    host: string;
    port: number;
}
/**
 * Socket pool options
 */
export interface SocketPoolOptions {
    host: string;
    port: number;
    proxy?: HostPortObject;
    timeout?: number;
    size?: number;
    init?: (socket: Socket) => void;
}
/**
 * Socket pool
 */
export declare function createSocketPool(options: SocketPoolOptions): {
    readonly size: number;
    /**
     * Create a new connection
     */
    createSocket(): Promise<Socket>;
    /**
     * Acquire a socket
     */
    acquire(): Promise<Socket>;
    /**
     * Release a socket
     * @param socket Socket to release
     */
    release(socket: Socket): void;
    /**
     * Destroy a socket
     */
    remove(socket: Socket): void;
    addListener(event: string | symbol, listener: (...args: any[]) => void): any;
    on(event: string | symbol, listener: (...args: any[]) => void): any;
    once(event: string | symbol, listener: (...args: any[]) => void): any;
    prependListener(event: string | symbol, listener: (...args: any[]) => void): any;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): any;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): any;
    off(event: string | symbol, listener: (...args: any[]) => void): any;
    removeAllListeners(event?: string | symbol): any;
    setMaxListeners(n: number): any;
    getMaxListeners(): number;
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    emit(event: string | symbol, ...args: any[]): boolean;
    eventNames(): (string | symbol)[];
    listenerCount(type: string | symbol): number;
};
export declare type SocketPool = ReturnType<typeof createSocketPool>;
