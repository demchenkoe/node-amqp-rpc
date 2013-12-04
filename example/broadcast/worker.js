var os = require('os');
var worker_name = os.hostname() + ':' + process.pid;
var counter = 0;

var rpc = require('../../index').factory({
    url: "amqp://guest:guest@localhost:5672"
});

rpc.onBroadcast('getWorkerStat', function(params, cb)    {
    if(params && params.type == 'fullStat') {
        cb(null, {
            pid: process.pid,
            hostname: os.hostname(),
            uptime: process.uptime(),
            counter: counter++
        });
    }
    else {
        cb(null, { counter: counter++ })
    }
});


rpc.call('log', { worker: worker_name, message: 'worker started' });