

var amqp = require('amqp');
var uuid = require('node-uuid').v4;


function rpc(opt)   {

    if(!opt) opt = {};
    this.opt = opt;
    this.__conn             = opt.connection ? opt.connection : null;
    this.__url              = opt.url ? opt.url: 'amqp://guest:guest@localhost:5672';
    this.__exchange         = opt.exchangeInstance ? opt.exchangeInstance : null;
    this.__exchange_name    = opt.exchange ? opt.exchange : 'rpc_exchange';
    this.__exchange_options = opt.exchange_options ? opt.exchange_options : {exclusive: true, autoDelete: true };

    this.__results_queue = null;
    this.__results_queue_name = null;
    this.__results_cb = {};
    this.__make_results_cb = [];

    this.__cmds = {};

    this.__connCbs = [];
    this.__exchangeCbs = [];
}


rpc.prototype._connect = function(cb)  {

    if(!cb) {
        cb = function(){};
    }

    if(this.__conn) {

        if(this.__connCbs.length > 0)    {

                this.__connCbs.push(cb);

            return true;
        }

        return cb(this.__conn);
    } else {
        this.__conn = this.opt.connection ? this.opt.connection : null;
    }

    var $this = this;

    this.__connCbs.push(cb);

    this.__conn = amqp.createConnection(
        {url: this.__url},
        {defaultExchangeName: this.__exchange_name}
    );

    this.__conn.addListener('ready', function(){

//       console.log("connected to " + $this.__conn.serverProperties.product);

        var cbs = $this.__connCbs;
        $this.__connCbs = [];

        for(var i=0; i< cbs.length; i++)    {
            cbs[i]($this.__conn);
        }
    });
}
/**
 * disconnect from MQ broker
 */

rpc.prototype.disconnect = function()   {

    if(!this.__conn) return;
    this.__conn.end();
    this.__conn = null;
}

rpc.prototype._makeExchange = function(cb) {

    if(!cb) {
        cb = function(){};
    }

    if(this.__exchange) {

        if(this.__exchangeCbs.length > 0)    {

            this.__exchangeCbs.push(cb);

            return true;
        }

        return cb(this.__exchange);
    }

    var $this = this;

    this.__exchangeCbs.push(cb);

    this.__exchange = this.__conn.exchange(this.__exchange_name, {}, function(exchange)    {
//        console.log('Exchange ' + exchange.name + ' is open');

        var cbs = $this.__exchangeCbs;
        $this.__exchangeCbs = [];

        for(var i=0; i< cbs.length; i++)    {
            cbs[i]($this.__exchange);
        }
    });
}

rpc.prototype._makeResultsQueue = function(cb) {

    if(!cb) {
        cb = function(){};
    }

    if(this.__results_queue) {
        if(this.__make_results_cb.length > 0)   {

            this.__make_results_cb.push(cb);
            return true;
        }
        return cb(this.__results_queue);
    }

    var $this = this;

    this.__results_queue_name = uuid();
    this.__make_results_cb.push(cb);

    $this._makeExchange(function()   {

        $this.__results_queue = $this.__conn.queue(
            $this.__results_queue_name,
            $this.__exchange_options,
            function(queue) {

                queue.subscribe(function()   {
                    $this.__onResult.apply($this, arguments);
                });

                queue.bind($this.__exchange, $this.__results_queue_name);

                var cbs = $this.__make_results_cb;
                $this.__make_results_cb = [];

                for(var i=0; i<cbs.length; i++){
                    cbs[i](queue);
                }
            }
        );
    });
}

rpc.prototype.__onResult = function(message, headers, deliveryInfo)   {

    if(! this.__results_cb[ deliveryInfo.correlationId ]) return;

    var cb = this.__results_cb[ deliveryInfo.correlationId ];

    var args = [];
    for(var k in message)   {
        if(!message.hasOwnProperty(k)) continue;

        args.push(message[k]);
    }

    cb.cb.apply(cb.context, args);

    delete this.__results_cb[ deliveryInfo.correlationId ];
}

/**
 * call a remote command
 * @param cmd   command name
 * @param params    parameters of command
 * @param cb        callback
 * @param context   context of callback
 * @param options   advanced options of amqp
 */

rpc.prototype.call = function(cmd, params, cb, context, options) {

    var $this   = this;

    if(!options) options = {};

    options.contentType = 'application/json';

    this._connect(function() {

        if(cb)  {

            $this._makeExchange(function(){

                $this._makeResultsQueue(function()   {

                    var corr_id = uuid();
                    $this.__results_cb[ corr_id ] = { cb: cb, context: context };


                    options.mandatory = true;
                    options.replyTo   = $this.__results_queue_name;
                    options.correlationId = corr_id;
                    //options.domain    = "localhost";

                    $this.__exchange.publish(
                        cmd,
                        params,
                        options,
                        function(err)   {
                            if(err) {
                                delete $this.__results_cb[ corr_id ];

                                cb(err);
                            }
                        }
                    );
                });
            });

        }
        else {

            $this._makeExchange(function(){

                $this.__exchange.publish(
                    cmd,
                    params,
                    options
                );
            });
        }
    });
}

/**
 * add new command handler
 * @param cmd   command name or match string
 * @param cb    handler
 * @param context   context for handler
 * @return {Boolean}
 */


rpc.prototype.on = function(cmd, cb, context)    {

    if(this.__cmds[ cmd ]) return false;

    var $this = this;

    this._connect(function()    {

        $this.__conn.queue(cmd, function(queue) {

            $this.__cmds[ cmd ] = { queue: queue };
            queue.subscribe(function(message, d, headers, deliveryInfo)  {

                var cmdInfo = {
                    cmd:         deliveryInfo.routingKey,
                    exchange:    deliveryInfo.exchange,
                    contentType: deliveryInfo.contentType,
                    size:        deliveryInfo.size
                };

                if(deliveryInfo.correlationId &&  deliveryInfo.replyTo )    {

                    return cb.call(context, message, function(err, data)   {

                        var options = {
                            correlationId: deliveryInfo.correlationId
                        }

                        $this.__exchange.publish(
                            deliveryInfo.replyTo,
                            arguments,
                            options
                        );
                    }, cmdInfo);
                }
                else
                    return cb.call(context, message, null, cmdInfo);
            });

            $this._makeExchange(function(){
                queue.bind($this.__exchange, cmd);
            });

        });
    });


    return true;
}

/**
 * remove command handler added with "on" method
 * @param cmd       command or match string
 * @return {Boolean}
 */

rpc.prototype.off = function(cmd)    {

    if(!this.__cmds[ cmd ]) return false;

    var $this = this;
    var c = $this.__cmds[ cmd ];

    function unsubscribe(cb)    {
        if(c.ctag)
            c.queue.unsubscribe(c.ctag);

        if(cb)
            return cb();
    }

    function unbind(cb)    {

        if(c.queue) {
            unsubscribe(function() {
                c.queue.unbind($this.__exchange, cmd);

                if(cb)
                    return cb();
            });

        }
    }

    function destroy(cb)    {

        if(c.queue){
            unbind(function(){
                c.queue.destroy()

                if(cb)
                    return cb();
            });
        }
    }

    destroy(function(){
        delete $this.__cmds[ cmd ];
    });

    return true;
}


module.exports.amqpRPC = rpc;

module.exports.factory = function(opt)  {
    return new rpc(opt);
}
