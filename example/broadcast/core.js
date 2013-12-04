var rpc = require('../../index').factory({
    url: "amqp://guest:guest@localhost:5672"
});

var all_stats = {};

//rpc.callBroadcast() is rpc.call() + waiting multiple responses
//If remote handler without response data, you can use rpc.call() for initiate broadcast calls.

rpc.callBroadcast(
    'getWorkerStat',
    { type: 'fullStat'},                    //request parameters
    {                                       //call options
        ttl: 1000,                          //wait response time  (1 seconds), after run onComplete
        onResponse: function(err, stat)  {  //callback on each worker response
            all_stats[ stat.hostname+':'+ stat.pid ] = stat;

        },
        onComplete: function()  {   //callback on ttl expired
            console.log('----------------------- WORKER STATISTICS ----------------------------------------');
            for(var worker in all_stats) {
                s = all_stats[worker];
                console.log(worker, '\tuptime=', s.uptime.toFixed(2) + ' seconds', '\tcounter=', s.counter);
            }
        }
    });