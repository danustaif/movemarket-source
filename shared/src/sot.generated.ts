// File hasil scripts/gen.mjs dari sot/*.json. Jangan diedit tangan.

export const LIVE_MARKET_ABI_HR = [
  "struct MarketParams { string gameRef; uint8 marketType; uint8 side; uint16 fromPly; uint16 toPly; uint64 lockTime; uint64 resolveDeadline; }",
  "struct Market { bytes32 gameKey; uint8 marketType; uint8 side; uint16 fromPly; uint16 toPly; uint64 lockTime; uint64 resolveDeadline; uint8 status; uint8 outcome; bool resolutionRequested; uint128 poolYes; uint128 poolNo; uint128 fee; }",
  "struct MarketView { uint256 id; bytes32 gameKey; uint8 marketType; uint8 side; uint16 fromPly; uint16 toPly; uint64 lockTime; uint8 status; }",
  "struct Position { uint128 yes; uint128 no; bool settled; }",
  "function createMarkets(MarketParams[] p) returns (uint256 firstId)",
  "function lockMarkets(uint256[] ids)",
  "function requestResolution(string gameRef, uint256[] ids)",
  "function bet(uint256 id, bool yes, uint128 amount)",
  "function claim(uint256 id) returns (uint256 payout)",
  "function claimMany(uint256[] ids) returns (uint256 totalPayout)",
  "function refund(uint256 id) returns (uint256 amount)",
  "function onReport(bytes metadata, bytes report)",
  "function supportsInterface(bytes4 interfaceId) pure returns (bool)",
  "function adminVoid(uint256[] ids)",
  "function setForwarder(address forwarder)",
  "function setResolver(address resolver)",
  "function setFeeBps(uint16 feeBps)",
  "function setLimits(uint128 minBet, uint128 maxStakePerUser)",
  "function withdrawFees(address to)",
  "function pause()",
  "function unpause()",
  "function getMarket(uint256 id) view returns (Market)",
  "function getMarkets(uint256[] ids) view returns (MarketView[])",
  "function getPosition(uint256 id, address user) view returns (Position)",
  "function claimable(uint256 id, address user) view returns (uint256)",
  "function refundable(uint256 id, address user) view returns (uint256)",
  "function token() view returns (address)",
  "function forwarder() view returns (address)",
  "function resolver() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function minBet() view returns (uint128)",
  "function maxStakePerUser() view returns (uint128)",
  "function nextMarketId() view returns (uint256)",
  "function feesAccrued() view returns (uint256)",
  "function gameRefOf(bytes32 gameKey) view returns (string)",
  "event MarketCreated(uint256 indexed id, bytes32 indexed gameKey, string gameRef, uint8 marketType, uint8 side, uint16 fromPly, uint16 toPly, uint64 lockTime, uint64 resolveDeadline)",
  "event MarketLocked(uint256 indexed id, uint64 lockTime)",
  "event BetPlaced(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 poolYes, uint128 poolNo)",
  "event ResolutionRequested(bytes32 indexed gameKey, string gameRef, uint256[] ids)",
  "event MarketResolved(uint256 indexed id, uint8 outcome)",
  "event MarketVoided(uint256 indexed id, uint8 reason)",
  "event ResolutionSkipped(uint256 indexed id, uint8 reason)",
  "event Claimed(uint256 indexed id, address indexed user, uint256 payout)",
  "event Refunded(uint256 indexed id, address indexed user, uint256 amount)",
  "event ForwarderUpdated(address forwarder)",
  "event ResolverUpdated(address resolver)",
  "event FeesWithdrawn(address to, uint256 amount)",
  "error NotResolver()",
  "error UnauthorizedForwarder(address caller)",
  "error InvalidParams(uint256 index)",
  "error InvalidMarket(uint256 id)",
  "error MarketNotOpen(uint256 id)",
  "error BettingClosed(uint256 id)",
  "error AmountTooSmall()",
  "error StakeCapExceeded()",
  "error NotClaimable(uint256 id)",
  "error NothingToClaim(uint256 id)",
  "error AlreadySettled(uint256 id)",
  "error NotRefundable(uint256 id)",
  "error BadReport()",
  "error BadBatch()",
  "error FeeTooHigh()"
] as const;

export const MOCK_USDC_ABI_HR = [
  "function setMinter(address minter, bool ok)",
  "function mint(address to, uint256 amount)",
  "function minters(address) view returns (bool)",
  "function decimals() pure returns (uint8)",
  "error NotMinter()"
] as const;

export const ENUMS = {
  "MarketType": [
    "CHECK",
    "CAPTURE",
    "CASTLE"
  ],
  "Side": [
    "ANY",
    "WHITE",
    "BLACK"
  ],
  "Status": [
    "OPEN",
    "RESOLVED",
    "VOIDED"
  ],
  "Outcome": [
    "NONE",
    "YES",
    "NO",
    "VOID"
  ],
  "VoidReason": {
    "1": "ORACLE",
    "2": "NO_WINNERS",
    "3": "ADMIN",
    "4": "EXPIRED"
  },
  "SkipReason": {
    "1": "MARKET_NOT_FOUND",
    "2": "GAME_MISMATCH",
    "3": "NOT_OPEN",
    "4": "NOT_LOCKED",
    "5": "BAD_OUTCOME"
  }
} as const;

export const OUTCOME_CODE = {
  "YES": 1,
  "NO": 2,
  "VOID": 3
} as const;

export const SSE_EVENTS = [
  "ply",
  "game_end",
  "market_created",
  "market_locked",
  "pool",
  "provisional",
  "finalized",
  "replay_starting",
  "ping"
] as const;
