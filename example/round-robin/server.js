
var rpc = require('../../index').factory({
  conn_options: { url: "amqp://guest:guest@localhost:5672", heartbeat: 10 }
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
