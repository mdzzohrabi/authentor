"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
// import ApolloClient from 'apollo-boost';
// import gql from 'graphql-tag';
var cross_fetch_1 = require("cross-fetch");
var ts_invariant_1 = require("ts-invariant");
var spool_1 = require("./spool");
exports.DefaultUserFields = ['username', 'firstName', 'lastName', 'email'];
function getGqlType(value) {
    switch (typeof value) {
        case "number": return "Int!";
        case "string": return "String!";
        case "boolean": return "Boolean!";
        default: return "String!";
    }
}
var endAction = Buffer.from('$END$');
var Scope = /** @class */ (function () {
    /**
     * Scope query/mutation constructor
     * @param scope Scope name
     * @param client Auth(entciation/orization) client
     */
    function Scope(scope, client) {
        this.scope = scope;
        this.client = client;
    }
    Scope.prototype.query = function (name, query, variables) {
        if (variables === void 0) { variables = {}; }
        variables.scope = this.scope;
        return this.client.query("query " + name + "(" + Object.keys(variables).map(function (v) { return "$" + v + ": " + getGqlType(variables[v]); }) + ") { scope(scope: $scope) { " + query + " } }", variables).then(function (r) { return r.data.scope; });
    };
    /**
     * Get users list
     * @param options Options
     */
    Scope.prototype.users = function () {
        var fields = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            fields[_i] = arguments[_i];
        }
        ts_invariant_1.default(fields.length > 0, "No fields specified for query");
        return this.query('users', "users {\n            " + fields.join(' ') + "\n        }").then(function (result) { return result.users; });
    };
    Scope.prototype.userById = function (id, fields) {
        fields = fields || exports.DefaultUserFields;
        return this.query('userByID', "userById(id: $id) { " + fields.join(' ') + " }", { id: id }).then(function (r) { return r.userById; });
    };
    return Scope;
}());
exports.Scope = Scope;
var AuthClient = /** @class */ (function () {
    function AuthClient(endPoint) {
        this.endPoint = endPoint;
        /**
         * Scope instances cache
         */
        this._scopes = {};
        var _a = this.endPoint.split(':'), host = _a[0], port = _a[1];
        this._pool = spool_1.createSocketPool({
            host: host, port: Number(port)
        });
    }
    /**
     * Dive into scope
     * @param scopeName Scope name
     */
    AuthClient.prototype.scope = function (scopeName) {
        return this._scopes[scopeName] || (this._scopes[scopeName] = new Scope(scopeName, this));
    };
    /**
     * Make a graphql query to server
     * @param query Query string
     * @param variables Variables
     */
    AuthClient.prototype.query = function (query, variables) {
        var _this = this;
        return new Promise(function (resolve, reject) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var socket, result, responseHandler;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._pool.acquire()];
                    case 1:
                        socket = _a.sent();
                        result = '';
                        socket.write("$QUERY$", function (err) {
                            socket.write(JSON.stringify({ query: query, variables: variables }), function (err) {
                                socket.write(endAction);
                            });
                        });
                        responseHandler = function (data) {
                            if (data.equals(endAction)) {
                                socket.off('data', responseHandler);
                                resolve(JSON.parse(result));
                                _this._pool.release(socket);
                                return;
                            }
                            result += data.toString();
                        };
                        socket.on('data', responseHandler);
                        return [2 /*return*/];
                }
            });
        }); });
        // return gqlRequest(this.endPoint, { query, variables });
    };
    return AuthClient;
}());
exports.AuthClient = AuthClient;
function gqlRequest(url, request) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var response;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    request.query = request.query.trim().replace(/\s{2,}|\n/g, ' ');
                    return [4 /*yield*/, cross_fetch_1.default(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(request)
                        })];
                case 1:
                    response = _a.sent();
                    if (!(response.status == 400)) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.json()];
                case 2: throw _a.sent();
                case 3: return [4 /*yield*/, response.json()];
                case 4: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
