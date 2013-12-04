
#AMQP-RPC

RPC library based on AMQP protocol.
Tested with RabbitMQ on the highload project.


###Install RabitMQ

    apt-get install rabbitmq-server

###Install library

    npm install amqp-rpc

##round-robin

Example: Call remote function.
Run multiple servers.js for round-robin shared.


###server.js example

    var rpc = require('amqp-rpc').factory({
        url: "amqp://guest:guest@localhost:5672"
    });


    rpc.on('inc', function(param, cb){
        var prevVal = param;
        var nextVal = param+2;
        cb(++param, prevVal, nextVal);
    });

    rpc.on('say.*', function(param, cb, inf){

        var arr = inf.cmd.split('.');

        var name = (param && param.name) ? param.name : 'world';

        cb(arr[1] + ' ' + name + '!');

    });

    rpc.on('withoutCB', function(param, cb, inf) {

      if(cb){
        cb('please run function without cb parameter')
      }
      else{
        console.log('this is function withoutCB');
      }

    });



###client.js example

    var rpc = require('amqp-rpc').factory({
        url: "amqp://guest:guest@localhost:5672"
    });

    rpc.call('inc', 5, function() {
        console.log('results of inc:', arguments);  //output: [6,4,7]
    });

    rpc.call('say.Hello', { name: 'John' }, function(msg) {
        console.log('results of say.Hello:', msg);  //output: Hello John!
    });

    rpc.call('withoutCB', {}, function(msg) {
        console.log('withoutCB results:', msg);  //output: please run function without cb parameter
    });

    rpc.call('withoutCB', {}); //output message on server side console


##broadcast

Example: Core receiving data from all workers.
Run multiple worker.js for broadcast witness.
The core.js must be launched after all worker.js instances.

###example/broadcast/worker.js

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

###example/broadcast/core.js

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


Results for three workers:

    ----------------------- WORKER STATISTICS ----------------------------------------
    host1:2612 	uptime= 2470.39 seconds 	counter= 2
    host2:1615 	uptime= 3723.53 seconds 	counter= 8
    host2:2822 	uptime= 2279.16 seconds 	counter= 3

Eugene Demchenko aka Goldy skype demchenkoe email demchenkoev@gmail.com
