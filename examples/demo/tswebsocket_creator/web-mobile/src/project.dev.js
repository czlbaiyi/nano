require = function() {
  function r(e, n, t) {
    function o(i, f) {
      if (!n[i]) {
        if (!e[i]) {
          var c = "function" == typeof require && require;
          if (!f && c) return c(i, !0);
          if (u) return u(i, !0);
          var a = new Error("Cannot find module '" + i + "'");
          throw a.code = "MODULE_NOT_FOUND", a;
        }
        var p = n[i] = {
          exports: {}
        };
        e[i][0].call(p.exports, function(r) {
          var n = e[i][1][r];
          return o(n || r);
        }, p, p.exports, r, e, n, t);
      }
      return n[i].exports;
    }
    for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
    return o;
  }
  return r;
}()({
  Helloworld: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "e1b90/rohdEk4SdmmEZANaD", "Helloworld");
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var Nano_1 = require("./Nano");
    var _a = cc._decorator, ccclass = _a.ccclass, property = _a.property;
    var Helloworld = function(_super) {
      __extends(Helloworld, _super);
      function Helloworld() {
        var _this = null !== _super && _super.apply(this, arguments) || this;
        _this.label = null;
        _this.text = "hello";
        return _this;
      }
      Helloworld.prototype.start = function() {
        var _this = this;
        this.label.string = this.text;
        Nano_1.Nano.init({
          host: "127.0.0.1",
          port: 33251
        }, function() {
          _this.label.string = "connect success";
        }, this);
      };
      __decorate([ property(cc.Label) ], Helloworld.prototype, "label", void 0);
      __decorate([ property ], Helloworld.prototype, "text", void 0);
      Helloworld = __decorate([ ccclass ], Helloworld);
      return Helloworld;
    }(cc.Component);
    exports.default = Helloworld;
    cc._RF.pop();
  }, {
    "./Nano": "Nano"
  } ],
  Nano: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "9da78loDE1DY5stCnh7ggMe", "Nano");
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var Protocol_1 = require("./Protocol");
    var NanoEvent;
    (function(NanoEvent) {
      NanoEvent["MSG_PRASE_ERR"] = "MSG_PRASE_ERR";
    })(NanoEvent = exports.NanoEvent || (exports.NanoEvent = {}));
    var NanoCode;
    (function(NanoCode) {
      NanoCode[NanoCode["ErrorID"] = -1] = "ErrorID";
      NanoCode[NanoCode["Ok"] = 0] = "Ok";
    })(NanoCode = exports.NanoCode || (exports.NanoCode = {}));
    var Emitter = function() {
      function Emitter() {
        this.registMap = new Map();
      }
      Emitter.prototype.on = function(type, callback, target) {
        void 0 === this.registMap[type] && (this.registMap[type] = []);
        this.registMap[type].push({
          callback: callback,
          target: target
        });
      };
      Emitter.prototype.emit = function(type, customData) {
        var array = this.registMap[type];
        if (void 0 === array) return;
        for (var i = 0; i < array.length; i++) {
          var element = array[i];
          if (element) try {
            element.callback.call(element.target, customData);
          } catch (error) {
            console.log("call function error", error.stack);
          }
        }
      };
      Emitter.prototype.off = function(type, callback) {
        var array = this.registMap[type];
        if (void 0 === array) return;
        for (var i = 0; i < array.length; i++) {
          var element = array[i];
          if (element && element.callback === callback) {
            array[i] = void 0;
            break;
          }
        }
      };
      Emitter.prototype.offType = function(type) {
        this.registMap[type] = void 0;
      };
      Emitter.prototype.release = function() {
        this.registMap.clear();
      };
      return Emitter;
    }();
    var Nano = function(_super) {
      __extends(Nano, _super);
      function Nano() {
        var _this = _super.call(this) || this;
        _this.JS_WS_CLIENT_TYPE = "js-websocket";
        _this.JS_WS_CLIENT_VERSION = "0.0.1";
        _this.decodeIO_encoder = null;
        _this.decodeIO_decoder = null;
        _this.EventEmitter = Emitter;
        _this.RES_OK = 200;
        _this.RES_FAIL = 500;
        _this.RES_OLD_CLIENT = 501;
        _this.socket = null;
        _this.reqId = 0;
        _this.callbacks = {};
        _this.handlers = {};
        _this.routeMap = {};
        _this.dict = {};
        _this.abbrs = {};
        _this.heartbeatInterval = 0;
        _this.heartbeatTimeout = 0;
        _this.nextHeartbeatTimeout = 0;
        _this.gapThreshold = 100;
        _this.heartbeatId = null;
        _this.heartbeatTimeoutId = null;
        _this.handshakeCallback = null;
        _this.decode = null;
        _this.encode = null;
        _this.reconnect = false;
        _this.reconncetTimer = null;
        _this.reconnectUrl = null;
        _this.reconnectAttempts = 0;
        _this.reconnectionDelay = 5e3;
        _this.DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
        _this.targetObj = null;
        _this.initCallback = null;
        _this.handler = {};
        _this.handshakeBuffer = {
          sys: {
            type: _this.JS_WS_CLIENT_TYPE,
            version: _this.JS_WS_CLIENT_VERSION,
            rsa: {}
          },
          user: {}
        };
        _this.handlers[Protocol_1.Package.TYPE_HANDSHAKE] = _this.handshake;
        _this.handlers[Protocol_1.Package.TYPE_HEARTBEAT] = _this.heartbeat;
        _this.handlers[Protocol_1.Package.TYPE_DATA] = _this.onData;
        _this.handlers[Protocol_1.Package.TYPE_KICK] = _this.onKick;
        return _this;
      }
      Nano.prototype.init = function(params, cb, target) {
        this.initCallback = cb;
        this.targetObj = target;
        var host = params.host;
        var port = params.port;
        var path = params.path;
        this.encode = params.encode || this.defaultEncode;
        this.decode = params.decode || this.defaultDecode;
        var url = "ws://" + host;
        port && (url += ":" + port);
        path && (url += path);
        this.handshakeBuffer.user = params.user;
        this.handshakeCallback = params.handshakeCallback;
        this.connect(params, url, cb);
      };
      Nano.prototype.defaultDecode = function(data) {
        var msg = Protocol_1.Message.decode(data);
        if (msg.id > 0) {
          msg.route = this.routeMap[msg.id];
          delete this.routeMap[msg.id];
          if (!msg.route) return;
        }
        msg.body = this.deCompose(msg);
        return msg;
      };
      Nano.prototype.defaultEncode = function(reqId, route, msg) {
        var type = reqId ? Protocol_1.Message.TYPE_REQUEST : Protocol_1.Message.TYPE_NOTIFY;
        msg = Protocol_1.Protocol.strencode(JSON.stringify(msg));
        var compressRoute = 0;
        if (this.dict && this.dict[route]) {
          route = this.dict[route];
          compressRoute = 1;
        }
        return Protocol_1.Message.encode(reqId, type, compressRoute, route, msg);
      };
      Nano.prototype.connect = function(params, url, cb) {
        console.log("connect to " + url);
        var params = params || {};
        var maxReconnectAttempts = params.maxReconnectAttempts || this.DEFAULT_MAX_RECONNECT_ATTEMPTS;
        this.reconnectUrl = url;
        var self = this;
        var onopen = function(event) {
          !self.reconnect || self.emit("reconnect");
          self.reset();
          console.log("connect success");
          console.log("begin ack");
          var obj = Protocol_1.Package.encode(Protocol_1.Package.TYPE_HANDSHAKE, Protocol_1.Protocol.strencode(JSON.stringify(self.handshakeBuffer)));
          self.send(obj);
        };
        var onmessage = function(event) {
          self.processPackage(Protocol_1.Package.decode(event.data));
          self.heartbeatTimeout && (self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout);
        };
        var onerror = function(event) {
          self.emit("io-error", event);
          console.error("socket error: ", event);
        };
        var onclose = function(event) {
          self.emit("close", event);
          self.emit("disconnect", event);
          console.log("socket close: ", event);
          if (!!params.reconnect && self.reconnectAttempts < maxReconnectAttempts) {
            self.reconnect = true;
            self.reconnectAttempts++;
            self.reconncetTimer = setTimeout(function() {
              self.connect(params, self.reconnectUrl, cb);
            }, self.reconnectionDelay);
            self.reconnectionDelay *= 2;
          }
        };
        this.socket = new WebSocket(url);
        this.socket.binaryType = "arraybuffer";
        this.socket.onopen = onopen;
        this.socket.onmessage = onmessage;
        this.socket.onerror = onerror;
        this.socket.onclose = onclose;
      };
      Nano.prototype.disconnect = function() {
        if (this.socket) {
          this.socket.disconnect && this.socket.disconnect();
          this.socket.close && this.socket.close();
          console.log("disconnect");
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
      Nano.prototype.reset = function() {
        this.reconnect = false;
        this.reconnectionDelay = 5e3;
        this.reconnectAttempts = 0;
        clearTimeout(this.reconncetTimer);
      };
      Nano.prototype.request = function(route, msg, cb, thisObj, fail) {
        void 0 === fail && (fail = null);
        if (2 === arguments.length && "function" === typeof msg) {
          cb = msg;
          msg = {};
        } else msg = msg || {};
        route = route || msg.route;
        if (!route) return;
        this.reqId++;
        this.sendMessage(this.reqId, route, msg);
        this.callbacks[this.reqId] = {
          target: thisObj,
          success: cb,
          failed: fail
        };
        this.routeMap[this.reqId] = route;
      };
      Nano.prototype.notify = function(route, msg) {
        msg = msg || {};
        this.sendMessage(0, route, msg);
      };
      Nano.prototype.sendMessage = function(reqId, route, msg) {
        this.encode && (msg = this.encode(reqId, route, msg));
        var packet = Protocol_1.Package.encode(Protocol_1.Package.TYPE_DATA, msg);
        this.send(packet);
      };
      Nano.prototype.send = function(packet) {
        var buffer = new Uint8Array(packet.byteLength);
        for (var i = 0; i < packet.byteLength; ++i) buffer[i] = packet[i];
        this.socket.send(buffer);
      };
      Nano.prototype.heartbeat = function(data) {
        var _this = this;
        if (!this.heartbeatInterval) return;
        var obj = Protocol_1.Package.encode(Protocol_1.Package.TYPE_HEARTBEAT, void 0);
        if (this.heartbeatTimeoutId) {
          clearTimeout(this.heartbeatTimeoutId);
          this.heartbeatTimeoutId = null;
        }
        if (this.heartbeatId) return;
        this.heartbeatId = setTimeout(function() {
          _this.heartbeatId = null;
          _this.send(obj);
          _this.nextHeartbeatTimeout = Date.now() + _this.heartbeatTimeout;
          _this.heartbeatTimeoutId = setTimeout(function() {
            _this.heartbeatTimeoutCb;
          }, _this.heartbeatTimeout);
        }, this.heartbeatInterval);
      };
      Nano.prototype.heartbeatTimeoutCb = function() {
        var _this = this;
        var gap = this.nextHeartbeatTimeout - Date.now();
        if (gap > this.gapThreshold) this.heartbeatTimeoutId = setTimeout(function() {
          _this.heartbeatTimeoutCb;
        }, gap); else {
          console.error("server heartbeat timeout");
          this.emit("heartbeat timeout");
          this.disconnect();
        }
      };
      Nano.prototype.handshake = function(data) {
        data = JSON.parse(Protocol_1.Protocol.strdecode(data));
        do {
          if (data.code === this.RES_OLD_CLIENT) {
            this.emit("error", "client version not fullfill");
            break;
          }
          if (data.code !== this.RES_OK) {
            this.emit("error", "handshake fail");
            break;
          }
          this.handshakeInit(data);
          var obj = Protocol_1.Package.encode(Protocol_1.Package.TYPE_HANDSHAKE_ACK, void 0);
          this.send(obj);
        } while (false);
        this.initCallback && this.targetObj && this.initCallback.call(this.socket, data.code);
      };
      Nano.prototype.onData = function(data) {
        var msg = data;
        this.decode && (msg = this.decode(msg));
        this.processMessage(msg);
      };
      Nano.prototype.onKick = function(data) {
        data = JSON.parse(Protocol_1.Protocol.strdecode(data));
        this.emit("onKick", data);
      };
      Nano.prototype.processPackage = function(msgs) {
        if (Array.isArray(msgs)) for (var i = 0; i < msgs.length; i++) {
          var msg = msgs[i];
          this.handlers[msg.type].call(this, msg.body);
        } else this.handlers[msgs.type].call(this, msgs.body);
      };
      Nano.prototype.processMessage = function(msg) {
        if (!msg.id) {
          this.emit(msg.route, msg.body);
          return;
        }
        var cb = this.callbacks[msg.id];
        delete this.callbacks[msg.id];
        if ("function" === typeof cb.success && msg.body && msg.body.code != NanoCode.ErrorID) cb.target ? cb.success.call(cb.target, msg.body) : cb.success(msg.body); else {
          if ("function" !== typeof cb.failed) throw "no deal function with callback";
          cb.target ? cb.failed.call(cb.target, msg.body) : cb.failed(msg.body);
        }
      };
      Nano.prototype.processMessageBatch = function(msgs) {
        for (var i = 0, l = msgs.length; i < l; i++) this.processMessage(msgs[i]);
      };
      Nano.prototype.deCompose = function(msg) {
        var route = msg.route;
        if (msg.compressRoute) {
          if (!this.abbrs[route]) return {};
          route = msg.route = this.abbrs[route];
        }
        return JSON.parse(Protocol_1.Protocol.strdecode(msg.body));
      };
      Nano.prototype.handshakeInit = function(data) {
        if (data.sys && data.sys.heartbeat) {
          this.heartbeatInterval = 1e3 * data.sys.heartbeat;
          this.heartbeatTimeout = 2 * this.heartbeatInterval;
        } else {
          this.heartbeatInterval = 0;
          this.heartbeatTimeout = 0;
        }
        this.initData(data);
        "function" === typeof this.handshakeCallback && this.handshakeCallback(data.user);
      };
      Nano.prototype.initData = function(data) {
        if (!data || !data.sys) return;
        this.dict = data.sys.dict;
        if (this.dict) {
          this.abbrs = {};
          for (var route in this.dict) this.abbrs[this.dict[route]] = route;
        }
      };
      return Nano;
    }(Emitter);
    var NanoInstance = new Nano();
    exports.Nano = NanoInstance;
    cc._RF.pop();
  }, {
    "./Protocol": "Protocol"
  } ],
  Protocol: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "255c3F47QhMJLq3qhn9gkHa", "Protocol");
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function copyArray(dest, doffset, src, soffset, length) {
      if ("function" === typeof src.copy) src.copy(dest, doffset, soffset, soffset + length); else for (var index = 0; index < length; index++) dest[doffset++] = src[soffset++];
    }
    var Protocol = function() {
      function Protocol() {}
      Protocol.strencode = function(str) {
        var byteArray = new ArrayBuffer(3 * str.length);
        var offset = 0;
        for (var i = 0; i < str.length; i++) {
          var charCode = str.charCodeAt(i);
          var codes = null;
          codes = charCode <= 127 ? [ charCode ] : charCode <= 2047 ? [ 192 | charCode >> 6, 128 | 63 & charCode ] : [ 224 | charCode >> 12, 128 | (4032 & charCode) >> 6, 128 | 63 & charCode ];
          for (var j = 0; j < codes.length; j++) {
            byteArray[offset] = codes[j];
            ++offset;
          }
        }
        var _buffer = new ArrayBuffer(offset);
        copyArray(_buffer, 0, byteArray, 0, offset);
        return _buffer;
      };
      Protocol.strdecode = function(buffer) {
        var bytes = new Uint8Array(buffer.byteLength);
        for (var i = 0; i < buffer.byteLength; ++i) bytes[i] = buffer[i];
        var array = [];
        var offset = 0;
        var charCode = 0;
        var end = bytes.byteLength;
        while (offset < end) {
          if (bytes[offset] < 128) {
            charCode = bytes[offset];
            offset += 1;
          } else if (bytes[offset] < 224) {
            charCode = ((63 & bytes[offset]) << 6) + (63 & bytes[offset + 1]);
            offset += 2;
          } else {
            charCode = ((15 & bytes[offset]) << 12) + ((63 & bytes[offset + 1]) << 6) + (63 & bytes[offset + 2]);
            offset += 3;
          }
          array.push(charCode);
        }
        return String.fromCharCode.apply(null, array);
      };
      return Protocol;
    }();
    exports.Protocol = Protocol;
    var Package = function() {
      function Package() {}
      Package.encode = function(type, body) {
        var length = body ? body.byteLength : 0;
        var buffer = new ArrayBuffer(Package.PKG_HEAD_BYTES + length);
        var index = 0;
        buffer[index++] = 255 & type;
        buffer[index++] = length >> 16 & 255;
        buffer[index++] = length >> 8 & 255;
        buffer[index++] = 255 & length;
        body && copyArray(buffer, index, body, 0, length);
        return buffer;
      };
      Package.decode = function(buffer) {
        var offset = 0;
        var bytes = new Uint8Array(buffer);
        var length = 0;
        var rs = [];
        while (offset < bytes.byteLength) {
          var type = bytes[offset++];
          length = (bytes[offset++] << 16 | bytes[offset++] << 8 | bytes[offset++]) >>> 0;
          var body = length ? new ArrayBuffer(length) : null;
          copyArray(body, 0, bytes, offset, length);
          offset += length;
          rs.push({
            type: type,
            body: body
          });
        }
        return 1 === rs.length ? rs[0] : rs;
      };
      Package.PKG_HEAD_BYTES = 4;
      Package.TYPE_HANDSHAKE = 1;
      Package.TYPE_HANDSHAKE_ACK = 2;
      Package.TYPE_HEARTBEAT = 3;
      Package.TYPE_DATA = 4;
      Package.TYPE_KICK = 5;
      return Package;
    }();
    exports.Package = Package;
    var Message = function() {
      function Message() {}
      Message.msgHasId = function(type) {
        return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
      };
      Message.msgHasRoute = function(type) {
        return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY || type === Message.TYPE_PUSH;
      };
      Message.caculateMsgIdBytes = function(id) {
        var len = 0;
        do {
          len += 1;
          id >>= 7;
        } while (id > 0);
        return len;
      };
      Message.encodeMsgFlag = function(type, compressRoute, buffer, offset) {
        if (type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY && type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) throw new Error("unkonw message type: " + type);
        buffer[offset] = type << 1 | (compressRoute ? 1 : 0);
        return offset + Message.MSG_FLAG_BYTES;
      };
      Message.encodeMsgId = function(id, buffer, offset) {
        do {
          var tmp = id % 128;
          var next = Math.floor(id / 128);
          0 !== next && (tmp += 128);
          buffer[offset++] = tmp;
          id = next;
        } while (0 !== id);
        return offset;
      };
      Message.encodeMsgRoute = function(compressRoute, route, buffer, offset) {
        if (compressRoute) {
          if (route > Message.MSG_ROUTE_CODE_MAX) throw new Error("route number is overflow");
          buffer[offset++] = route >> 8 & 255;
          buffer[offset++] = 255 & route;
        } else if (route) {
          buffer[offset++] = 255 & route.byteLength;
          copyArray(buffer, offset, route, 0, route.byteLength);
          offset += route.byteLength;
        } else buffer[offset++] = 0;
        return offset;
      };
      Message.encodeMsgBody = function(msg, buffer, offset) {
        copyArray(buffer, offset, msg, 0, msg.byteLength);
        return offset + msg.byteLength;
      };
      Message.encode = function(id, type, compressRoute, route, msg) {
        var idBytes = Message.msgHasId(type) ? Message.caculateMsgIdBytes(id) : 0;
        var msgLen = Message.MSG_FLAG_BYTES + idBytes;
        if (Message.msgHasRoute(type)) if (compressRoute) {
          if ("number" !== typeof route) throw new Error("error flag for number route!");
          msgLen += Message.MSG_ROUTE_CODE_BYTES;
        } else {
          msgLen += Message.MSG_ROUTE_LEN_BYTES;
          if (route) {
            route = Protocol.strencode(route);
            if (route.length > 255) throw new Error("route maxlength is overflow");
            msgLen += route.byteLength;
          }
        }
        msg && (msgLen += msg.byteLength);
        var buffer = new ArrayBuffer(msgLen);
        var offset = 0;
        offset = Message.encodeMsgFlag(type, compressRoute, buffer, offset);
        Message.msgHasId(type) && (offset = Message.encodeMsgId(id, buffer, offset));
        Message.msgHasRoute(type) && (offset = Message.encodeMsgRoute(compressRoute, route, buffer, offset));
        msg && (offset = Message.encodeMsgBody(msg, buffer, offset));
        return buffer;
      };
      Message.decode = function(buffer) {
        var bytes = new ArrayBuffer(buffer.byteLength);
        for (var i_1 = 0; i_1 < buffer.byteLength; ++i_1) bytes[i_1] = buffer[i_1];
        var bytesLen = bytes.byteLength;
        var offset = 0;
        var id = 0;
        var route = null;
        var flag = bytes[offset++];
        var compressRoute = flag & Message.MSG_COMPRESS_ROUTE_MASK;
        var type = flag >> 1 & Message.MSG_TYPE_MASK;
        if (Message.msgHasId(type)) {
          var m = parseInt(bytes[offset]);
          var i = 0;
          do {
            var m = parseInt(bytes[offset]);
            id += (127 & m) * Math.pow(2, 7 * i);
            offset++;
            i++;
          } while (m >= 128);
        }
        if (Message.msgHasRoute(type)) if (compressRoute) route = bytes[offset++] << 8 | bytes[offset++]; else {
          var routeLen = bytes[offset++];
          if (routeLen) {
            route = new ArrayBuffer(routeLen);
            copyArray(route, 0, bytes, offset, routeLen);
            route = Protocol.strdecode(route);
          } else route = "";
          offset += routeLen;
        }
        var bodyLen = bytesLen - offset;
        var body = new ArrayBuffer(bodyLen);
        copyArray(body, 0, bytes, offset, bodyLen);
        return {
          id: id,
          type: type,
          compressRoute: compressRoute,
          route: route,
          body: body
        };
      };
      Message.TYPE_REQUEST = 0;
      Message.TYPE_NOTIFY = 1;
      Message.TYPE_RESPONSE = 2;
      Message.TYPE_PUSH = 3;
      Message.MSG_FLAG_BYTES = 1;
      Message.MSG_ROUTE_CODE_BYTES = 2;
      Message.MSG_ID_MAX_BYTES = 5;
      Message.MSG_ROUTE_LEN_BYTES = 1;
      Message.MSG_ROUTE_CODE_MAX = 65535;
      Message.MSG_COMPRESS_ROUTE_MASK = 1;
      Message.MSG_TYPE_MASK = 7;
      return Message;
    }();
    exports.Message = Message;
    cc._RF.pop();
  }, {} ]
}, {}, [ "Helloworld", "Nano", "Protocol" ]);
//# sourceMappingURL=project.dev.js.map