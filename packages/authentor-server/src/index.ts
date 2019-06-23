import * as express from 'express';
import { watch } from 'fs';
import { Server } from 'http';
import bodyParser = require('body-parser');
import { load } from 'protobufjs';
import { getUsers } from './connection';
import { createServer, Server as NetServer } from 'net';
import { createGqlSchema } from './api';
import { graphql } from 'graphql';

let http = express();
let server: Server;
let loading = false;

/**
 * Build Micro-Service Server
 * @param cb Callback
 */
async function buildApiServer(cb?: Function) {
    loading = true;
    http = express();
    http.use(bodyParser.urlencoded({ extended: true }));
    http.use(bodyParser.json());
    let { createApiServer } = await import('./api');
    createApiServer().then(api => {

        http.get('/:scope/users', async function _getUsers(req, res) {
            let users = await (await getUsers()).find({ scope: req.params.scope }).toArray();
            res.json(users);
        });

        api.applyMiddleware({ app: http });
        
        server = http.listen(1350, () => {
            console.log('Server started on port 1350');
            loading = false;
            cb && cb();
       });
    });
}

let queryAction = Buffer.from('$QUERY$');
let endAction = Buffer.from('$END$');
let netServer = async function buildNetServer() {
    let schema = createGqlSchema(await getUsers());
    let server = createServer(function clientHandler(socket) {

        console.log(`New Client`);
        let request = '';
        let queryStarted = false;

        socket.on('data', async function dataHandler(buffer) {

            if (queryStarted) {
                if ( buffer.equals(endAction) ) {
                    queryStarted = false;
                    let parsed = JSON.parse(request);

                    let result = await graphql({
                        schema,
                        source: parsed.query,
                        variableValues: parsed.variables
                    });

                    socket.write( JSON.stringify(result), err => {
                        console.log(`Response`);
                        socket.write(endAction);
                    });

                    return;
                }
                request += buffer.toString();
            } else if (buffer.equals(queryAction)) {
                console.log(`New Query`);
                queryStarted = true;
            }

        })
        .on('error', function onError(err) {
            if (!err.message.includes('ECONNRESET'))
                console.log(`Client Error`, err);
        });

    });

    server.listen(1351, function() {
        console.log(`Socket Server started on port ${ 1351 }`);
    })

    return {
        async restart() {
            schema = createGqlSchema(await getUsers());
        }
    }
}()

let changed = false;

function onChange(event: string, fileName: string) {
    if (changed || loading) return;
    changed = true;
    console.log('Changed');
    setTimeout(() => {

        console.log('Purge cache', Date.now());
        Object.keys(require.cache).forEach(key => delete require.cache[key]);

        netServer.then(s => s.restart());

        if ( server ) 
        {
            console.log('Close current server');
            
            server.close(err => {
                server = null;
                if (err) console.log(err);
                else console.log('Server closed');
                buildApiServer();
                changed = false;
            });
        }
        else {
            console.log('No Server');
            server = null;
            buildApiServer();
            changed = false;
        }

    }, 1000);    
}

buildApiServer();

watch(__dirname, { recursive: true, persistent: false }, onChange);
watch(__dirname + '/../schema.gql', { recursive: true, persistent: false }, onChange);
