declare module "bn.js" {
  export default class BN {
    constructor(value?: string | number | bigint | Uint8Array | BN, base?: number, endian?: string);
    toString(base?: number): string;
  }
}
