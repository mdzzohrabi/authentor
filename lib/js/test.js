let { AuthClient } = require('./index');

let client = new AuthClient('http://localhost:1350/');

client.scope('expo').getUsers().then(users => {
    console.log(users);
});