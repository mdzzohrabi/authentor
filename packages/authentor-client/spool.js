"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var net_1 = require("net");
var events_1 = require("events");
/**
 * Socket pool
 */
function createSocketPool(options) {
    // Options
    var _a = tslib_1.__assign({ size: 10, timeout: 3000 }, options), host = _a.host, port = _a.port, proxy = _a.proxy, size = _a.size, timeout = _a.timeout, init = _a.init;
    /** In Use sockets */
    var inUse = [];
    /** Available sockets */
    var available = [];
    /** Acquire Queue */
    var queue = [];
    /** Created sockets */
    var created = 0;
    if (!host || !port) {
        throw Error("SocketPool Host and Port not defined");
    }
    var socketId = 0;
    /**
     * Initialize socket
     */
    function initSocket(socket) {
        init ? init(socket) : null;
        return socket;
    }
    return new /** @class */ (function (_super) {
        tslib_1.__extends(SocketPoolInstance, _super);
        function SocketPoolInstance() {
            var _this = _super.call(this) || this;
            var pool = _this;
            _this.on('release', function socketReleased(socket) {
                var resolve = queue.shift();
                if (resolve) {
                    removeFrom(available)(socket);
                    resolve(socket);
                }
            });
            _this.on('remove', function socketDestroyed() {
                if (queue.length > 0) {
                    pool.createSocket().then(initSocket).then(function useDestroyedSocket(socket) {
                        var resolve = queue.shift();
                        if (resolve) {
                            resolve(socket);
                        }
                    });
                }
            });
            return _this;
        }
        Object.defineProperty(SocketPoolInstance.prototype, "size", {
            get: function () {
                return inUse.length + available.length;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Create a new connection
         */
        SocketPoolInstance.prototype.createSocket = function () {
            created++;
            return new Promise(function (resolve, reject) {
                function handleError(err) {
                    if (err.code == 'ECONNREFUSED')
                        created--;
                    reject(err);
                }
                if (proxy) {
                    createConnectionThroughProxy(proxy.host, proxy.port, host, port).then(function (socket) { return socket; }).then(resolve).catch(handleError);
                }
                else {
                    var socket_1 = net_1.createConnection(port, host, function () { resolve(socket_1); }).on('error', handleError);
                }
            });
        };
        /**
         * Acquire a socket
         */
        SocketPoolInstance.prototype.acquire = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                // Avaiable sockets
                if (available.length > 0) {
                    var socket = available.pop();
                    inUse.push(socket);
                    return resolve(socket);
                }
                if (created < size) {
                    // Make new socket
                    _this.createSocket()
                        .then(initSocket)
                        .then(pushTo(inUse))
                        .then(resolve)
                        .catch(function acquireError(err) {
                        reject(err);
                    });
                }
                else {
                    /**
                     * Defered acquire (Wait for new release)
                     * @param {Socket} socket
                     */
                    var deferedAcquire_1 = function (socket) {
                        clearTimeout(timer_1);
                        inUse.push(socket);
                        resolve(socket);
                    };
                    // Timeout handler
                    var timer_1 = setTimeout(function aquireTimeout() {
                        removeFrom(queue)(deferedAcquire_1);
                        reject(Error("Aquire timeout"));
                    }, timeout);
                    // Queue acquire
                    queue.push(deferedAcquire_1);
                }
            });
        };
        /**
         * Release a socket
         * @param socket Socket to release
         */
        SocketPoolInstance.prototype.release = function (socket) {
            var inUseIndex = inUse.indexOf(socket);
            var availIndex = available.indexOf(socket);
            if (inUseIndex < 0)
                return;
            if (availIndex >= 0)
                throw Error("This socket already released");
            inUse.splice(inUseIndex, 1);
            available.push(socket);
            this.emit('release', socket);
        };
        /**
         * Destroy a socket
         */
        SocketPoolInstance.prototype.remove = function (socket) {
            var inUseIndex = inUse.indexOf(socket);
            inUse.splice(inUseIndex, 1);
            var availIndex = available.indexOf(socket);
            available.splice(availIndex, 1);
            created--;
            this.emit('remove', socket);
        };
        return SocketPoolInstance;
    }(events_1.EventEmitter));
}
exports.createSocketPool = createSocketPool;
/**
 * Push item to list and return it
 */
function pushTo(list) {
    return function push(item) {
        list.push(item);
        return item;
    };
}
/**
 * Remove item from list
 */
function removeFrom(list) {
    return function (item) {
        var index = list.indexOf(item);
        list.splice(index, 1);
        return item;
    };
}
/**
 * Connect to a target through proxy
 */
function createConnectionThroughProxy(proxyHost, proxyPort, remoteHost, remotePort, request) {
    if (request === void 0) { request = ''; }
    return new Promise(function (resolve, reject) {
        var connection = net_1.createConnection(proxyPort, proxyHost, function () {
            connection.write("CONNECT " + remoteHost + ":" + remotePort + " HTTP/1.1\n\n" + request);
            connection.once('data', function (buffer) {
                if (buffer.toString().includes('Connection established'))
                    resolve(connection);
                else
                    reject(buffer.toString());
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
