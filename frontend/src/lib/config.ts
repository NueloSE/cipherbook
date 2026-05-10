// Update all four addresses after running: npx hardhat deploy --network sepolia
export const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const FACTORY_ADDRESS    = "0x25fba8FD994fcd72b71315e35dc9992ca1FE4F43" as const;
export const CONTRACT_ADDRESS   = "0x1369BAb501257C419d578d711331D79E27599472" as const;
export const BASE_TOKEN_ADDRESS = "0x5dd3C7270ab16049946863036F7c54715bc3ECb2" as const;
export const QUOTE_TOKEN_ADDRESS = "0x985Ab56DEbaAd5117f6D6cAc63cD1FaE94993A84" as const;

export const SEPOLIA_CHAIN_ID = 11155111;

// Token metadata
export const BASE_TOKEN_SYMBOL = "TKN";
export const QUOTE_TOKEN_SYMBOL = "QUSD";
export const BASE_TOKEN_DECIMALS = 18;
export const QUOTE_TOKEN_DECIMALS = 6;

export const OrderSide = { BUY: 0, SELL: 1 } as const;
export type OrderSideType = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderStatus = { OPEN: 0, FILLED: 1, CANCELLED: 2 } as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<number, string> = {
  0: "Open",
  1: "Filled",
  2: "Cancelled",
};
