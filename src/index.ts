import * as express from 'express';
import { watch } from 'fs';
import { Server } from 'http';

let http = express();
let server: Server;

async function buildApiServer() {
    http = express();
    let { createApiServer } = await import('./api');
    createApiServer().then(api => {
        api.applyMiddleware({ app: http });
        server = http.listen(1350, () => {
            console.log('Server started on port 1350');
       });
    });
}

let changed = false;

function onChange(event: string, fileName: string) {
    if (changed) return;
    changed = true;
    console.log('Changed');
    setTimeout(() => {

        console.log('Purge cache', Date.now());
        Object.keys(require.cache).forEach(key => delete require.cache[key]);

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

watch(__dirname, { recursive: true, persistent: false }, onChange);
watch(__dirname + '/../schema.gql', { recursive: true, persistent: false }, onChange);

buildApiServer();