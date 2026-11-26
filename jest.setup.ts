// eslint-disable-next-line import/no-extraneous-dependencies
import "@testing-library/jest-dom";
import * as nodeCrypto from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

const nodeGlobal = global as typeof global & {
    crypto?: typeof nodeCrypto & { randomUUID?: () => string };
    TextEncoder?: typeof TextEncoder;
    TextDecoder?: typeof TextDecoder;
};

if (typeof nodeGlobal.TextEncoder === "undefined") {
    nodeGlobal.TextEncoder = TextEncoder;
    // @ts-expect-error polyfill
    nodeGlobal.TextDecoder = TextDecoder;
}

if (!nodeGlobal.crypto) {
    // @ts-expect-error Jest/Node may not provide Web Crypto in this environment.
    nodeGlobal.crypto = nodeCrypto;
}

if (!nodeGlobal.crypto.randomUUID) {
    Object.defineProperty(nodeGlobal.crypto, "randomUUID", {
        value: () => nodeCrypto.randomBytes(16).toString("hex"),
        configurable: true,
    });
}
