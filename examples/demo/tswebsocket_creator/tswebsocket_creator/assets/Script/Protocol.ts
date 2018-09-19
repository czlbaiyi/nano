/**
 * 
 * @param dest 
 * @param doffset 
 * @param src 
 * @param soffset 
 * @param length 
 */
function copyArray(dest, doffset, src, soffset, length) {
  if ('function' === typeof src.copy) {
    // Buffer
    src.copy(dest, doffset, soffset, soffset + length);
  } else {
    // Uint8Array
    for (var index = 0; index < length; index++) {
      dest[doffset++] = src[soffset++];
    }
  }
};

export class Protocol {
  /**
   * pomele client encode
   * id message id;
   * route message route
   * msg message body
   * socketio current support string
   */
  static strencode(str) {
    var byteArray = new ArrayBuffer(str.length * 3);
    var offset = 0;
    for (var i = 0; i < str.length; i++) {
      var charCode = str.charCodeAt(i);
      var codes = null;
      if (charCode <= 0x7f) {
        codes = [charCode];
      } else if (charCode <= 0x7ff) {
        codes = [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
      } else {
        codes = [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
      }
      for (var j = 0; j < codes.length; j++) {
        byteArray[offset] = codes[j];
        ++offset;
      }
    }
    var _buffer = new ArrayBuffer(offset);
    copyArray(_buffer, 0, byteArray, 0, offset);
    return _buffer;
  };

  /**
   * client decode
   * msg String data
   * return Message Object
   */
  static strdecode(buffer: ArrayBuffer) {
    var bytes = new Uint8Array(buffer.byteLength)
    for(let i = 0; i < buffer.byteLength; ++i){
      bytes[i]=buffer[i]
    }
    var array = [];
    var offset = 0;
    var charCode = 0;
    var end = bytes.byteLength;
    while (offset < end) {
      if (bytes[offset] < 128) {
        charCode = bytes[offset];
        offset += 1;
      } else if (bytes[offset] < 224) {
        charCode = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
        offset += 2;
      } else {
        charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
        offset += 3;
      }
      array.push(charCode);
    }
    return String.fromCharCode.apply(null, array);
  };
}


export class Package {
  static PKG_HEAD_BYTES = 4;
  static TYPE_HANDSHAKE = 1;
  static TYPE_HANDSHAKE_ACK = 2;
  static TYPE_HEARTBEAT = 3;
  static TYPE_DATA = 4;
  static TYPE_KICK = 5;

  /**
   * Package protocol encode.
   *
   * Pomelo package format:
   * +------+-------------+------------------+
   * | type | body length |       body       |
   * +------+-------------+------------------+
   *
   * Head: 4bytes
   *   0: package type,
   *      1 - handshake,
   *      2 - handshake ack,
   *      3 - heartbeat,
   *      4 - data
   *      5 - kick
   *   1 - 3: big-endian body length
   * Body: body length bytes
   *
   * @param  {Number}    type   package type
   * @param  {ArrayBuffer} body   body content in bytes
   * @return {ArrayBuffer}        new byte array that contains encode result
   */
  static encode(type, body): ArrayBuffer {
    var length = body ? body.byteLength : 0;
    var buffer = new ArrayBuffer(Package.PKG_HEAD_BYTES + length);
    var index = 0;
    buffer[index++] = type & 0xff;
    buffer[index++] = (length >> 16) & 0xff;
    buffer[index++] = (length >> 8) & 0xff;
    buffer[index++] = length & 0xff;
    if (body) {
      copyArray(buffer, index, body, 0, length);
    }
    return buffer;
  };

  /**
   * Package protocol decode.
   * See encode for package format.
   *
   * @param  {ArrayBuffer} buffer byte array containing package content
   * @return {Object}           {type: package type, buffer: body byte array}
   */
  static decode(buffer: ArrayBuffer) {
    var offset = 0;
    var bytes = new Uint8Array(buffer);
    var length = 0;
    var rs = [];
    while (offset < bytes.byteLength) {
      var type = bytes[offset++];
      length = ((bytes[offset++]) << 16 | (bytes[offset++]) << 8 | bytes[offset++]) >>> 0;
      var body = length ? new ArrayBuffer(length) : null;
      copyArray(body, 0, bytes, offset, length);
      offset += length;
      rs.push({ 'type': type, 'body': body });
    }
    return rs.length === 1 ? rs[0] : rs;
  };
}


export class Message {
  static TYPE_REQUEST = 0;
  static TYPE_NOTIFY = 1;
  static TYPE_RESPONSE = 2;
  static TYPE_PUSH = 3;

  static MSG_FLAG_BYTES = 1;
  static MSG_ROUTE_CODE_BYTES = 2;
  static MSG_ID_MAX_BYTES = 5;
  static MSG_ROUTE_LEN_BYTES = 1;

  static MSG_ROUTE_CODE_MAX = 0xffff;

  static MSG_COMPRESS_ROUTE_MASK = 0x1;
  static MSG_TYPE_MASK = 0x7;


  static msgHasId(type) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
  };

  static msgHasRoute(type) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY ||
      type === Message.TYPE_PUSH;
  };

  static caculateMsgIdBytes(id) {
    var len = 0;
    do {
      len += 1;
      id >>= 7;
    } while (id > 0);
    return len;
  };

  static encodeMsgFlag(type, compressRoute, buffer, offset) {
    if (type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY &&
      type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) {
      throw new Error('unkonw message type: ' + type);
    }

    buffer[offset] = (type << 1) | (compressRoute ? 1 : 0);

    return offset + Message.MSG_FLAG_BYTES;
  };

  static encodeMsgId(id, buffer, offset) {
    do {
      var tmp = id % 128;
      var next = Math.floor(id / 128);

      if (next !== 0) {
        tmp = tmp + 128;
      }
      buffer[offset++] = tmp;

      id = next;
    } while (id !== 0);

    return offset;
  };

  static encodeMsgRoute(compressRoute, route, buffer, offset) {
    if (compressRoute) {
      if (route > Message.MSG_ROUTE_CODE_MAX) {
        throw new Error('route number is overflow');
      }

      buffer[offset++] = (route >> 8) & 0xff;
      buffer[offset++] = route & 0xff;
    } else {
      if (route) {
        buffer[offset++] = route.byteLength & 0xff;
        copyArray(buffer, offset, route, 0, route.byteLength);
        offset += route.byteLength;
      } else {
        buffer[offset++] = 0;
      }
    }

    return offset;
  };

  static encodeMsgBody(msg, buffer, offset) {
    copyArray(buffer, offset, msg, 0, msg.byteLength);
    return offset + msg.byteLength;
  };


  /**
   * Message protocol encode.
   *
   * @param  {Number} id            message id
   * @param  {Number} type          message type
   * @param  {Number} compressRoute whether compress route
   * @param  {Number|String} route  route code or route string
   * @param  {Buffer} msg           message body bytes
   * @return {Buffer}               encode result
   */
  static encode(id, type, compressRoute, route, msg) {
    // caculate message max length
    var idBytes = Message.msgHasId(type) ? Message.caculateMsgIdBytes(id) : 0;
    var msgLen = Message.MSG_FLAG_BYTES + idBytes;

    if (Message.msgHasRoute(type)) {
      if (compressRoute) {
        if (typeof route !== 'number') {
          throw new Error('error flag for number route!');
        }
        msgLen += Message.MSG_ROUTE_CODE_BYTES;
      } else {
        msgLen += Message.MSG_ROUTE_LEN_BYTES;
        if (route) {
          route = Protocol.strencode(route);
          if (route.length > 255) {
            throw new Error('route maxlength is overflow');
          }
          msgLen += route.byteLength;
        }
      }
    }

    if (msg) {
      msgLen += msg.byteLength;
    }

    var buffer = new ArrayBuffer(msgLen);
    var offset = 0;

    // add flag
    offset = Message.encodeMsgFlag(type, compressRoute, buffer, offset);

    // add message id
    if (Message.msgHasId(type)) {
      offset = Message.encodeMsgId(id, buffer, offset);
    }

    // add route
    if (Message.msgHasRoute(type)) {
      offset = Message.encodeMsgRoute(compressRoute, route, buffer, offset);
    }

    // add body
    if (msg) {
      offset = Message.encodeMsgBody(msg, buffer, offset);
    }

    return buffer;
  };

  /**
   * Message protocol decode.
   *
   * @param  {Buffer|Uint8Array} buffer message bytes
   * @return {Object}            message object
   */
  static decode(buffer) {
    let bytes = new ArrayBuffer(buffer.byteLength)
    for (let i = 0; i < buffer.byteLength; ++i) {
      bytes[i] = buffer[i]
    }
    // var bytes = new ArrayBuffer(buffer);
    var bytesLen = bytes.byteLength;
    var offset = 0;
    var id = 0;
    var route = null;

    // parse flag
    var flag = bytes[offset++];
    var compressRoute = flag & Message.MSG_COMPRESS_ROUTE_MASK;
    var type = (flag >> 1) & Message.MSG_TYPE_MASK;

    // parse id
    if (Message.msgHasId(type)) {
      var m = parseInt(bytes[offset]);
      var i = 0;
      do {
        var m = parseInt(bytes[offset]);
        id = id + ((m & 0x7f) * Math.pow(2, (7 * i)));
        offset++;
        i++;
      } while (m >= 128);
    }

    // parse route
    if (Message.msgHasRoute(type)) {
      if (compressRoute) {
        route = (bytes[offset++]) << 8 | bytes[offset++];
      } else {
        var routeLen = bytes[offset++];
        if (routeLen) {
          route = new ArrayBuffer(routeLen);
          copyArray(route, 0, bytes, offset, routeLen);
          route = Protocol.strdecode(route);
        } else {
          route = '';
        }
        offset += routeLen;
      }
    }

    // parse body
    var bodyLen = bytesLen - offset;
    var body = new ArrayBuffer(bodyLen);

    copyArray(body, 0, bytes, offset, bodyLen);

    return {
      'id': id, 'type': type, 'compressRoute': compressRoute,
      'route': route, 'body': body
    };
  };

}
