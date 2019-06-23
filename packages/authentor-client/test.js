let { AuthClient, DefaultUserFields } = require('./index');
let { connect } = require('mongodb');
let { fetch } = require('cross-fetch');

async function profile(name, job, scale, parallel) {
    console.time(name);
    if ( scale ) {
        if ( !parallel ) {
            for (let i = 0; i < scale; i++) await job();
        } else {
            let jobs = [];
            for (let i = 0; i < scale; i++) jobs.push(job());
            await Promise.all(jobs);
        }
    } else {
        await job();
    }
    console.timeEnd(name);
}

async function run() {

    let client = new AuthClient('127.0.0.1:1351');
    let scope = client.scope('expo');

    console.log(await scope.users('id'));
    console.log(await scope.users('id'));
    console.log(await scope.users('id'));
    

    let scale = 5;

    console.time('Connect to db');
    let dbConn = await connect('mongodb://127.0.0.1:27018/', { useNewUrlParser: true });
    let dbUsers = dbConn.db('authentor').collection('users');
    console.timeEnd('Connect to db');


    await profile(`Users (Serialize)`, async () => {
        await scope.users("id", "username", "email");
    }, scale);

    await profile(`Users (Parallel)`, async () => {
        await scope.users("id", "username", "email");
    }, scale, true);

    await profile(`User by id (Serialize)`, async () => {
        return await scope.userById('5ce3ad34b12a6082a438cadf');
    }, scale);

    await profile(`User by id (Parallel)`, async () => {
        return await scope.userById('5ce3ad34b12a6082a438cadf');
    }, scale, true);
   
    await profile(`Users Fetch (Serialize)`, async () => {
        await fetch(`http://127.0.0.1:1350/expo/users`).then(r => r.json());
    }, scale);

    await profile(`Users Fetch (Parallel)`, async () => {
        await fetch(`http://127.0.0.1:1350/expo/users`).then(r => r.json());
    }, scale, true);

    await profile(`Users DB (Serialize)`, async () => {
        // let dbConn = await connect('mongodb://127.0.0.1:27018/', { useNewUrlParser: true });
        // let dbUsers = dbConn.db('authentor').collection('users');
        await dbUsers.find({}).toArray();
        // await dbConn.close();
    }, scale);

    await profile(`Users DB (Parallel)`, async () => {
        // let dbConn = await connect('mongodb://127.0.0.1:27018/', { useNewUrlParser: true });
        // let dbUsers = dbConn.db('authentor').collection('users');
            await dbUsers.find({}).toArray();
        // await dbConn.close();
    }, scale, true);

    await dbConn.close();

}

run().catch(err => {
    console.error(err);
})