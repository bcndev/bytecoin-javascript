"use strict";
// Copyright 2019 The Bytecoin developers.
// Licensed under the Apache License, Version 2.0.
Object.defineProperty(exports, "__esModule", { value: true });
const js_sha3_1 = require("js-sha3");
const tagLegacy = [6]; // legacy, 2*
const tagAmethyst = [0xce, 0xf6, 0x22]; // amethyst, bcnZ*
const tagProof = [0xce, 0xf5, 0xe2, 0x80, 0x91, 0xdd, 0x13]; // bcn1PRoof*
const tagAudit = [0xce, 0xf5, 0xf4, 0xbd, 0xd1, 0x71]; // bcnAUDit*
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const full_block_size = 8;
const full_encoded_block_size = 11;
const decoded_block_sizes = [0, -1, 1, 2, -1, 3, 4, 5, -1, 6, 7, 8];
const java_hi_parts = [0, 0, 0, 0, 0, 0, 8, 514, 29817, 1729386, 100304420];
const java_lo_parts = [1, 58, 3364, 195112, 11316496, 656356768, 3708954176, 370977408, 41853184, 2427484672, 3355157504];
function uint_be_to_bytes(buf, pos, si, val) {
    for (let i = si; i-- > 0;) {
        buf[pos + i] = val & 0xFF;
        val >>= 8;
    }
}
function decode_block(enc, enc_pos, size, dec, dec_pos) {
    if (size < 1 || size > full_encoded_block_size)
        return false;
    const res_size = decoded_block_sizes[size];
    if (res_size <= 0)
        return false; // Invalid block size
    let java_hi_part = 0;
    let java_lo_part = 0;
    let java_pos = 0;
    for (let i = size; i-- > 0; java_pos += 1) {
        const digit = alphabet.indexOf(enc[enc_pos + i]);
        if (digit < 0)
            return false; // Invalid symbol
        java_hi_part += java_hi_parts[java_pos] * digit;
        java_lo_part += java_lo_parts[java_pos] * digit;
    }
    java_hi_part += Math.floor(java_lo_part / 0x100000000);
    java_lo_part %= 0x100000000; // Not strictly necessary
    if (java_hi_part >= 0x100000000)
        return false;
    if (res_size > 4) {
        if (res_size < full_block_size && java_hi_part >= (1 << (8 * (res_size - 4))))
            return false; // Overflow
        uint_be_to_bytes(dec, dec_pos, res_size - 4, java_hi_part);
        uint_be_to_bytes(dec, dec_pos + res_size - 4, 4, java_lo_part);
    }
    else {
        if (res_size < full_block_size && java_lo_part >= (1 << (8 * res_size)))
            return false; // Overflow
        uint_be_to_bytes(dec, dec_pos, res_size, java_lo_part);
    }
    return true;
}
function decode(enc) {
    const full_block_count = Math.floor(enc.length / full_encoded_block_size);
    const last_block_size = enc.length % full_encoded_block_size;
    const last_block_decoded_size = decoded_block_sizes[last_block_size];
    if (last_block_decoded_size < 0)
        return false; // Invalid enc length
    const data_size = full_block_count * full_block_size + last_block_decoded_size;
    const data = new Uint8Array(data_size);
    for (let i = 0; i < full_block_count; ++i) {
        if (!decode_block(enc, i * full_encoded_block_size, full_encoded_block_size, data, i * full_block_size))
            return false;
    }
    if (last_block_size > 0) {
        if (!decode_block(enc, full_block_count * full_encoded_block_size, last_block_size, data, full_block_count * full_block_size))
            return false;
    }
    return data;
}
function to_hex(buf) {
    return Array.from(buf).map((byte) => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}
function decode_addr(addr) {
    let addr_data = decode(addr);
    const addr_checksum_size = 4;
    if (!addr_data)
        return false;
    if (addr_data.length <= addr_checksum_size)
        return false;
    const checksum = addr_data.slice(addr_data.length - addr_checksum_size, addr_data.length);
    addr_data = addr_data.slice(0, addr_data.length - addr_checksum_size);
    let hash = js_sha3_1.keccak256.digest(addr_data);
    hash = hash.slice(0, addr_checksum_size);
    if (to_hex(hash) !== to_hex(checksum))
        return false;
    return addr_data;
}
function checkAddressFormat(addr) {
    if (!exports.addressPattern.test(addr))
        return false;
    const addr_data = decode_addr(addr);
    const body_size = 64;
    if (!addr_data || addr_data.length < body_size)
        return false;
    const tag = addr_data.slice(0, addr_data.length - body_size);
    return to_hex(tag) === to_hex(tagLegacy) || to_hex(tag) === to_hex(tagAmethyst);
}
exports.checkAddressFormat = checkAddressFormat;
function checkProofFormat(proof) {
    return exports.proofPattern.test(proof) && decode_addr(proof) !== false;
}
exports.checkProofFormat = checkProofFormat;
function checkAuditFormat(audit) {
    return exports.auditPattern.test(audit) && decode_addr(audit) !== false;
}
exports.checkAuditFormat = checkAuditFormat;
exports.addressPattern = /^(2|bcnZ)[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{94}$/;
exports.proofPattern = /^bcn1PRoof[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
exports.auditPattern = /^bcnAUDit[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
