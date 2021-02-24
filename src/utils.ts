import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { ERC20 } from '../generated/ExchangeProxy/ERC20';
import { ERC20SymbolBytes } from '../generated/ExchangeProxy/ERC20SymbolBytes';
import { IZeroEx } from '../generated/ExchangeProxy/IZeroEx';
import { Fill, Maker, Swap, Taker, Token, Transaction } from '../generated/schema';

export let WETH_ADDRESS = Address.fromHexString('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') as Address;
export let EXCHANGE_PROXY_ADDRESS = Address.fromHexString('0xdef1c0ded9bec7f1a1670819833240f027b25eff') as Address;

export function normalizeTokenAddress(token: Address): Address {
    if (token.toHexString() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return WETH_ADDRESS;
    }
    return token;
}

export function fetchTokenSymbol(tokenAddress: Address): string {
    if (tokenAddress.toHexString() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return 'ETH';
    }
    let contract = ERC20.bind(tokenAddress);
    let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);
    // try types string and bytes32 for symbol
    let symbolValue = 'unknown';
    let symbolResult = contract.try_symbol();
    if (symbolResult.reverted) {
        let symbolResultBytes = contractSymbolBytes.try_symbol();
        if (!symbolResultBytes.reverted) {
            // for broken pairs that have no symbol function exposed
            if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
                symbolValue = symbolResultBytes.value.toString();
            }
        }
    } else {
        symbolValue = symbolResult.value;
    }

    return symbolValue;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
    if (tokenAddress.toHexString() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return BigInt.fromI32(18);
    }
    let contract = ERC20.bind(tokenAddress);
    // try types uint8 for decimals
    let decimalValue = null;
    let decimalResult = contract.try_decimals();
    if (!decimalResult.reverted) {
        decimalValue = decimalResult.value;
    }
    return BigInt.fromI32(decimalValue as i32);
}

// https://github.com/Uniswap/uniswap-v2-subgraph/blob/master/src/mappings/helpers.ts
export function isNullEthValue(value: string): boolean {
    return value == '0x0000000000000000000000000000000000000000000000000000000000000001';
}

export function transactionFindOrCreate(txHash: Bytes, block: ethereum.Block): Transaction {
    let transaction = Transaction.load(txHash.toHexString());
    if (!transaction) {
        transaction = new Transaction(txHash.toHexString());
        transaction.timestamp = block.timestamp;
        transaction.blockNumber = block.number;
        transaction.fills = [];
        transaction.nativeOrderFills = [];
        transaction.swaps = [];
        transaction.save();
    }
    return transaction!;
}

export function tokenFindOrCreate(address: Address): Token {
    let token = Token.load(normalizeTokenAddress(address).toHexString());
    if (!token) {
        token = new Token(address.toHexString());
        token.symbol = fetchTokenSymbol(address);
        token.decimals = fetchTokenDecimals(address);
        token.rfqOrderVolume = BigInt.fromI32(0);
        token.limitOrderVolume = BigInt.fromI32(0);
        token.swapVolume = BigInt.fromI32(0);
        token.save();
    }
    return token!;
}

export function takerFindOrCreate(address: Address): Taker {
    let taker = Taker.load(address.toHexString());
    if (!taker) {
        taker = new Taker(address.toHexString());
        taker.swapCount = BigInt.fromI32(0);
        taker.swaps = [];
        taker.nativeOrderFillCount = BigInt.fromI32(0);
        taker.nativeOrderFills = [];
        taker.save();
    }
    return taker!;
}

export function makerFindOrCreate(address: Address): Maker {
    let maker = Maker.load(address.toHexString());
    if (!maker) {
        maker = new Maker(address.toHexString());
        maker.nativeOrderFillCount = BigInt.fromI32(0);
        maker.nativeOrderFills = [];
        maker.save();
    }
    return maker!;
}

export function getFlashWallet(): Address | null {
    let ep = IZeroEx.bind(EXCHANGE_PROXY_ADDRESS);
    let r = ep.try_getTransformWallet();
    if (!r.reverted) {
        return r.value;
    }
    return null;
}

// Why are templates (and therefore .map()) unable to compile?
export function fillsToIds(fills: Fill[]): string[] {
    let r = [] as string[];
    for (let i = 0; i < fills.length; ++i) {
        r.push(fills[i].id);
    }
    return r;
}
