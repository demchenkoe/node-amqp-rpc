
#AMQP-RPC

RPC library based on AMQP protocol.
Tested with RabbitMQ under ubuntu.


###Install RabitMQ

    apt-get install rabbitmq-server

###Install library

    npm install amqp-rpc


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



Eugene Demchenko aka Goldy skype demchenkoe email it-bm@mail.ru
