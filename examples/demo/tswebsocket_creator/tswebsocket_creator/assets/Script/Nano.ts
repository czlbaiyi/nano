import { Package, Protocol, Message } from "./Protocol";
// import { ByteArray } from "./ByteArray"

export enum NanoEvent {
  MSG_PRASE_ERR = "MSG_PRASE_ERR"
}

export enum NanoCode {
  ErrorID = -1,
  Ok = 0,
}


/**
 * 事件类型
 */

class Emitter {
  private registMap: Map<string, any> = new Map<string, any>();

  public on(type: string, callback: Function, target: Object) {
    if (this.registMap[type] === undefined) {
      this.registMap[type] = [];
    }
    this.registMap[type].push({
      callback: callback,
      target: target
    });
  };

  public emit(type: string, customData?: any) {
    var array = this.registMap[type];
    if (array === undefined) {
      return;
    }

    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (element) {
        // call 报错没有反应
        try {
          element.callback.call(element.target, customData);
        } catch (error) {
          console.log("call function error", error.stack);
        }

      }
    }
  };

  public off(type: string, callback: Function) {
    var array = this.registMap[type];
    if (array === undefined) {
      return;
    }

    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (element && element.callback === callback) {
        array[i] = undefined;
        break;
      }
    }
  };

  public offType(type: string) {
    this.registMap[type] = undefined;
  };

  public release() {
    this.registMap.clear();
  };
}

class Nano extends Emitter {
  JS_WS_CLIENT_TYPE = 'js-websocket';
  JS_WS_CLIENT_VERSION = '0.0.1';

  decodeIO_encoder = null;
  decodeIO_decoder = null;
  EventEmitter = Emitter;

  RES_OK = 200;
  RES_FAIL = 500;
  RES_OLD_CLIENT = 501;

  socket = null;
  reqId = 0;
  callbacks = {}; //[id:string]{target: Object, success: Function, failed: Function}
  handlers = {};
  //map from request id to route
  routeMap = {};
  dict = {};    // route string to code
  abbrs = {};   // code to route string
  heartbeatInterval = 0;
  heartbeatTimeout = 0;
  nextHeartbeatTimeout = 0;
  gapThreshold = 100;   // heartbeat gap threashold
  heartbeatId = null;
  heartbeatTimeoutId = null;
  handshakeCallback = null;
  decode = null;
  encode = null;
  reconnect = false;
  reconncetTimer = null;
  reconnectUrl = null;
  reconnectAttempts = 0;
  reconnectionDelay = 5000;
  DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
  targetObj = null
  initCallback = null;
  handler: any = {};

  constructor() {
    super()
    this.handlers[Package.TYPE_HANDSHAKE] = this.handshake;
    this.handlers[Package.TYPE_HEARTBEAT] = this.heartbeat;
    this.handlers[Package.TYPE_DATA] = this.onData;
    this.handlers[Package.TYPE_KICK] = this.onKick;
  }

  handshakeBuffer = {
    'sys': {
      type: this.JS_WS_CLIENT_TYPE,
      version: this.JS_WS_CLIENT_VERSION,
      rsa: {}
    },
    'user': {
    }
  };

  public init(params, cb, target) {
    this.initCallback = cb;
    this.targetObj = target;
    var host = params.host;
    var port = params.port;
    var path = params.path;

    this.encode = params.encode || this.defaultEncode;
    this.decode = params.decode || this.defaultDecode;

    var url = 'ws://' + host;
    if (port) {
      url += ':' + port;
    }

    if (path) {
      url += path;
    }

    this.handshakeBuffer.user = params.user;
    this.handshakeCallback = params.handshakeCallback;
    this.connect(params, url, cb);
  };

  private defaultDecode(data) {
    var msg = Message.decode(data);

    if (msg.id > 0) {
      msg.route = this.routeMap[msg.id];
      delete this.routeMap[msg.id];
      if (!msg.route) {
        return;
      }
    }

    msg.body = this.deCompose(msg);
    return msg;
  };

  private defaultEncode(reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;
    msg = Protocol.strencode(JSON.stringify(msg));

    var compressRoute = 0;
    if (this.dict && this.dict[route]) {
      route = this.dict[route];
      compressRoute = 1;
    }

    return Message.encode(reqId, type, compressRoute, route, msg);
  };

  private connect(params, url, cb) {
    console.log('connect to ' + url);

    var params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || this.DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectUrl = url;
    var self = this;
    var onopen = function (event) {
      if (!!self.reconnect) {
        self.emit('reconnect');
      }
      self.reset();
      console.log("connect success")
      console.log("begin ack")
      var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(self.handshakeBuffer)));
      self.send(obj);
    };
    var onmessage = function (event) {
      self.processPackage(Package.decode(event.data));
      // new package arrived, update the heartbeat timeout
      if (self.heartbeatTimeout) {
        self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout;
      }
    };
    var onerror = function (event) {
      self.emit('io-error', event);
      console.error('socket error: ', event);
    };
    var onclose = function (event) {
      self.emit('close', event);
      self.emit('disconnect', event);
      console.log('socket close: ', event);
      if (!!params.reconnect && self.reconnectAttempts < maxReconnectAttempts) {
        self.reconnect = true;
        self.reconnectAttempts++;
        self.reconncetTimer = setTimeout(() => {
          self.connect(params, self.reconnectUrl, cb);
        }, self.reconnectionDelay);
        self.reconnectionDelay *= 2;
      }
    };
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = onopen;
    this.socket.onmessage = onmessage;
    this.socket.onerror = onerror;
    this.socket.onclose = onclose;
  };

  public disconnect() {
    if (this.socket) {
      if (this.socket.disconnect) this.socket.disconnect();
      if (this.socket.close) this.socket.close();
      console.log('disconnect');
      this.socket = null;
    }

    if (this.heartbeatId) {
      clearTimeout(this.heartbeatId);
      this.heartbeatId = null;
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  };

  public reset() {
    this.reconnect = false;
    this.reconnectionDelay = 1000 * 5;
    this.reconnectAttempts = 0;
    clearTimeout(this.reconncetTimer);
  };

  public request(route: string, msg: any, cb: Function, thisObj: Object, fail: Function = null) {
    if (arguments.length === 2 && typeof msg === 'function') {
      cb = msg;
      msg = {};
    } else {
      msg = msg || {};
    }
    route = route || msg.route;
    if (!route) {
      return;
    }

    this.reqId++;
    this.sendMessage(this.reqId, route, msg);

    this.callbacks[this.reqId] = { target: thisObj, success: cb, failed: fail };
    this.routeMap[this.reqId] = route;
  };

  public notify(route, msg) {
    msg = msg || {};
    this.sendMessage(0, route, msg);
  };

  private sendMessage(reqId, route, msg) {
    if (this.encode) {
      msg = this.encode(reqId, route, msg);
    }
    var packet = Package.encode(Package.TYPE_DATA, msg);
    this.send(packet);
  };

  private send(packet: ArrayBuffer) {
    let buffer = new Uint8Array(packet.byteLength)
    for (let i = 0; i < packet.byteLength; ++i) {
      buffer[i] = packet[i]
    }
    this.socket.send(buffer);
  };

  private heartbeat(data) {
    if (!this.heartbeatInterval) {
      // no heartbeat
      return;
    }

    var obj = Package.encode(Package.TYPE_HEARTBEAT, undefined);
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    if (this.heartbeatId) {
      // already in a heartbeat interval
      return;
    }
    this.heartbeatId = setTimeout(() => {
      this.heartbeatId = null;
      this.send(obj);

      this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
      this.heartbeatTimeoutId = setTimeout(() => {
        this.heartbeatTimeoutCb
      }, this.heartbeatTimeout);
    }, this.heartbeatInterval);
  };

  private heartbeatTimeoutCb() {
    var gap = this.nextHeartbeatTimeout - Date.now();
    if (gap > this.gapThreshold) {
      this.heartbeatTimeoutId = setTimeout(() => { this.heartbeatTimeoutCb }, gap);
    } else {
      console.error('server heartbeat timeout');
      this.emit('heartbeat timeout');
      this.disconnect();
    }
  };

  private handshake(data) {
    data = JSON.parse(Protocol.strdecode(data));
    do {
      if (data.code === this.RES_OLD_CLIENT) {
        this.emit('error', 'client version not fullfill');
        break
      }

      if (data.code !== this.RES_OK) {
        this.emit('error', 'handshake fail');
        break
      }

      this.handshakeInit(data);
      var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK, undefined);
      this.send(obj);
    } while (false)

    if (this.initCallback && this.targetObj) {
      this.initCallback.call(this.socket, data.code);
    }
  };

  private onData(data) {
    var msg = data;
    if (this.decode) {
      msg = this.decode(msg);
    }
    this.processMessage(msg);
  };

  private onKick(data) {
    data = JSON.parse(Protocol.strdecode(data));
    this.emit('onKick', data);
  };

  private processPackage(msgs) {
    if (Array.isArray(msgs)) {
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        this.handlers[msg.type].call(this, msg.body);
      }
    } else {
      this.handlers[msgs.type].call(this, msgs.body);
    }
  };
  private processMessage(msg) {
    if (!msg.id) {
      // server push message
      this.emit(msg.route, msg.body);
      return;
    }

    //底层协议已经转换成json了
    // try {
    //   JSON.parse(msg.body);
    // } catch (e) {
    //   this.emit(NanoEvent.MSG_PRASE_ERR)
    //   throw ("socket json ");
    // }

    //if have a id then find the callback function with the request
    var cb = this.callbacks[msg.id];

    delete this.callbacks[msg.id];

    if (typeof cb.success === 'function' && msg.body && msg.body.code != NanoCode.ErrorID) {
      cb.target ? cb.success.call(cb.target, msg.body) : cb.success(msg.body)
    }
    else if (typeof cb.failed === 'function') {
      cb.target ? cb.failed.call(cb.target, msg.body) : cb.failed(msg.body)
    }
    else {
      throw ("no deal function with callback")
    }
  };

  private processMessageBatch(msgs) {
    for (var i = 0, l = msgs.length; i < l; i++) {
      this.processMessage(msgs[i]);
    }
  };

  private deCompose(msg) {
    var route = msg.route;

    //Decompose route from dict
    if (msg.compressRoute) {
      if (!this.abbrs[route]) {
        return {};
      }

      route = msg.route = this.abbrs[route];
    }
    return JSON.parse(Protocol.strdecode(msg.body));
  };

  private handshakeInit(data) {
    if (data.sys && data.sys.heartbeat) {
      this.heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
      this.heartbeatTimeout = this.heartbeatInterval * 2;        // max heartbeat timeout
    } else {
      this.heartbeatInterval = 0;
      this.heartbeatTimeout = 0;
    }

    this.initData(data);

    if (typeof this.handshakeCallback === 'function') {
      this.handshakeCallback(data.user);
    }
  };

  private initData(data) {
    if (!data || !data.sys) {
      return;
    }
    this.dict = data.sys.dict;

    //Init compress dict
    if (this.dict) {
      this.abbrs = {};

      for (var route in this.dict) {
        this.abbrs[this.dict[route]] = route;
      }
    }
  }
}

var NanoInstance = new Nano()
export { NanoInstance as Nano }