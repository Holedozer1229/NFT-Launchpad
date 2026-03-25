"use strict";

function toBigIntBE(buf) {
  let result = 0n;
  for (let i = 0; i < buf.length; i++) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

function toBigIntLE(buf) {
  let result = 0n;
  for (let i = buf.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

function toBufferBE(value, width) {
  const buf = Buffer.allocUnsafe(width);
  let v = BigInt(value);
  for (let i = width - 1; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function toBufferLE(value, width) {
  const buf = Buffer.allocUnsafe(width);
  let v = BigInt(value);
  for (let i = 0; i < width; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

module.exports = { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE };
