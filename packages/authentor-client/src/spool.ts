import { Socket, createConnection } from "net";
import { EventEmitter } from 'events';

/**
 * Host and port object
 */
export interface HostPortObject {
    host: string
    port: number
}

/**
 * Socket pool options
 */
export interface SocketPoolOptions {
    host: string
    port: number
    proxy?: HostPortObject
    timeout?: number
    size?: number
    init?: (socket: Socket) => void
}

/**
 * Socket pool
 */
export function createSocketPool(options: SocketPoolOptions) {

    // Options
    let { host, port, proxy, size, timeout, init } = {
        size: 10,
        timeout: 3000,
        ...options
    };

    /** In Use sockets */
    var inUse: Socket[] = [];
    
    /** Available sockets */
    var available: Socket[] = [];

    /** Acquire Queue */
    let queue: Function[] = [];

    /** Created sockets */
    let created: number = 0;

    if (!host || !port) {
        throw Error(`SocketPool Host and Port not defined`);
    }

    let socketId = 0;

    /**
     * Initialize socket
     */
    function initSocket(socket: Socket) {
        init ? init(socket): null;
        return socket;
    }

    return new class SocketPoolInstance extends EventEmitter {

        constructor() {
            super();
            let pool = this;

            this.on('release', function socketReleased(socket) {
                let resolve = queue.shift();
                if (resolve) {
                    removeFrom(available)(socket);
                    resolve(socket);
                }
            });

            this.on('remove', function socketDestroyed() {
                if (queue.length > 0) {
                    pool.createSocket().then(initSocket).then(function useDestroyedSocket(socket) {
                        let resolve = queue.shift();
                        if (resolve) {
                            resolve(socket);
                        }
                    });
                }
            });

        }

        get size() {
            return inUse.length + available.length;
        }

        /**
         * Create a new connection
         */
        createSocket(): Promise<Socket> {
            created++;
            return new Promise((resolve, reject) => {
                function handleError(err) {
                    if (err.code == 'ECONNREFUSED')
                        created--;
                    reject(err);
                }

                if (proxy) {
                    createConnectionThroughProxy(proxy.host, proxy.port, host, port).then(socket => { return socket }).then(resolve).catch(handleError);
                } else {
                    let socket = createConnection(port, host, () => { resolve(socket); }).on('error', handleError);
                }
            });
        }

        /**
         * Acquire a socket
         */
        acquire(): Promise<Socket> {

            return new Promise((resolve, reject) => {
                // Avaiable sockets
                if ( available.length > 0 ) {
                    let socket = available.pop();
                    inUse.push(socket);
                    return resolve(socket);
                }

                if ( created < size ) {
                    // Make new socket
                    this.createSocket()
                        .then(initSocket)
                        .then(pushTo(inUse))
                        .then(resolve)
                        .catch(function acquireError(err) {
                            reject(err);
                        });
                } else {

                    /**
                     * Defered acquire (Wait for new release)
                     * @param {Socket} socket 
                     */
                    let deferedAcquire = (socket: Socket) => {
                        clearTimeout(timer);
                        inUse.push(socket);
                        resolve(socket);
                    }
                    
                    // Timeout handler
                    let timer = setTimeout(function aquireTimeout() {
                        removeFrom(queue)(deferedAcquire);
                        reject(Error(`Aquire timeout`));
                    }, timeout);

                    // Queue acquire
                    queue.push(deferedAcquire);
                }
            });
        }

        /**
         * Release a socket
         * @param socket Socket to release
         */
        release(socket: Socket) {
            let inUseIndex = inUse.indexOf(socket);
            let availIndex = available.indexOf(socket);
            if (inUseIndex < 0) return;
            if (availIndex >= 0) throw Error(`This socket already released`);
            inUse.splice(inUseIndex, 1);
            available.push(socket);
            this.emit('release', socket);
        }

        /**
         * Destroy a socket
         */
        remove(socket: Socket) {
            let inUseIndex = inUse.indexOf(socket);
            inUse.splice(inUseIndex, 1);
            let availIndex = available.indexOf(socket);
            available.splice(availIndex, 1);
            created--;
            this.emit('remove', socket);
        }
    }
}

export type SocketPool = ReturnType<typeof createSocketPool>;

/**
 * Push item to list and return it
 */
function pushTo<T>(list: T[]): (item: T) => T {
    return function push(item: T) {
        list.push(item);
        return item;
    }
}

/**
 * Remove item from list
 */
function removeFrom<T>(list: T[]) {
    return function (item: T) {
        let index = list.indexOf(item);
        list.splice(index, 1);
        return item;
    }
}

/**
 * Connect to a target through proxy
 */
function createConnectionThroughProxy(proxyHost: string, proxyPort: number, remoteHost: string, remotePort: number, request: any = '') {
    return new Promise((resolve, reject) => {

        let connection = createConnection(proxyPort, proxyHost, () => {
            connection.write(`CONNECT ${remoteHost}:${remotePort} HTTP/1.1\n\n${ request }`);
            connection.once('data', buffer => {
                if ( buffer.toString().includes('Connection established') ) resolve(connection);
                else reject(buffer.toString());
            });
        });

        connection.on('error', reject);
    });
}

// let pool = createSocketPool({
//     host: '127.0.0.1',
//     port: 9090,
//     size: 3
//     // proxy: { host: '172.16.8.12', port: 39741 }
// });

// let jobs = [];

// // for (let i = 1; i <= 10 ; i++) {

// //     jobs.push( pool.acquire().then(socket => {

// //         console.log(i, 'Pool size', pool.size);
// //         setTimeout(() => {
// //             pool.remove(socket)
// //             console.log(i, `After Release`, pool.size);
// //         }, 100);

// //     }).catch(err => console.log(i, err)) );

// // }
// let time = 0;
// for (let i = 1; i <= 5; i++) {
//     setTimeout(() => {     
//         jobs.push( pool.acquire().then(socket => {
//             console.log(i, 'Pool size', pool.size);
//             setTimeout(() => {
//                 pool.remove(socket)
//             }, 100);
   
//         }).catch(err => console.log(i, err)) );
//     }, time);
//     time += 1000;
// }

// Promise.all(jobs).then(() => {
//     console.log('Done');
// })
