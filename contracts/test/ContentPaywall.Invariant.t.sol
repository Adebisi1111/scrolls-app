// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContentPaywallTestBase} from "./ContentPaywall.Base.t.sol";
import {ContentPaywall} from "../ContentPaywall.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

// ────────────────────────────────────────────────────────────────────────────
// Handler: bounded set of actions the invariant fuzzer can call.
// ────────────────────────────────────────────────────────────────────────────
contract ContentPaywallHandler is ContentPaywallTestBase {
    // Track cumulative USDC paid in by readers
    uint256 public totalPaid;
    // Track cumulative USDC received by author + treasury
    uint256 public totalReceived;

    // Small pool of test doc IDs and readers to keep state manageable
    uint256[3] internal docIds  = [uint256(1), 2, 3];
    address[3] internal readers;
    address[3] internal authors;

    constructor(MockERC20 _usdc, ContentPaywall _paywall) {
        usdc    = _usdc;
        paywall = _paywall;

        readers[0] = makeAddr("reader0");
        readers[1] = makeAddr("reader1");
        readers[2] = makeAddr("reader2");

        authors[0] = makeAddr("author0");
        authors[1] = makeAddr("author1");
        authors[2] = makeAddr("author2");

        // Register the three docs as owner
        vm.startPrank(owner);
        for (uint256 i; i < 3; i++) {
            paywall.registerDoc(docIds[i], authors[i]);
        }
        vm.stopPrank();

        // Seed each reader with ample USDC and max-approve the paywall
        for (uint256 i; i < 3; i++) {
            usdc.mint(readers[i], UNLOCK_PRICE * 10);
            vm.prank(readers[i]);
            usdc.approve(address(paywall), type(uint256).max);
        }
    }

    /// Attempt to unlock a document. Tracks paid/received amounts on success.
    function unlock(uint256 docIdx, uint256 readerIdx) external {
        docIdx    = bound(docIdx,    0, 2);
        readerIdx = bound(readerIdx, 0, 2);

        uint256 docId  = docIds[docIdx];
        address reader = readers[readerIdx];

        // Skip if already unlocked (would revert — not an invariant violation)
        if (paywall.isUnlocked(docId, reader)) return;

        // Refill reader if low
        if (usdc.balanceOf(reader) < UNLOCK_PRICE) {
            usdc.mint(reader, UNLOCK_PRICE);
        }

        address author   = paywall.getAuthor(docId);
        address treasury = paywall.platformTreasury();

        uint256 authorBefore   = usdc.balanceOf(author);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 readerBefore   = usdc.balanceOf(reader);

        vm.prank(reader);
        paywall.unlockDocument(docId);

        totalPaid     += readerBefore   - usdc.balanceOf(reader);
        totalReceived += (usdc.balanceOf(author) - authorBefore) +
                         (usdc.balanceOf(treasury) - treasuryBefore);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Invariant test contract
// ────────────────────────────────────────────────────────────────────────────
contract ContentPaywallInvariantTest is ContentPaywallTestBase {
    ContentPaywallHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new ContentPaywallHandler(usdc, paywall);
        targetContract(address(handler));
    }

    /// Invariant: every USDC paid by readers is fully distributed to recipients.
    /// No funds are ever locked or lost inside the ContentPaywall contract itself.
    function invariant_TotalPaidEqualsReceivedByRecipients() public view {
        assertEq(handler.totalPaid(), handler.totalReceived(),
            "paid != received: USDC leaked or disappeared");
    }

    /// Invariant: the ContentPaywall contract never holds any USDC balance.
    function invariant_PaywallHoldsNoUsdc() public view {
        assertEq(usdc.balanceOf(address(paywall)), 0,
            "paywall contract should hold zero USDC");
    }

    /// Invariant: isUnlocked and isDocumentUnlocked always agree for every
    ///            reader/doc pair tracked by the handler.
    function invariant_IsUnlockedAndIsDocumentUnlockedConsistent() public view {
        // Use the same deterministic addresses the handler derives via makeAddr
        // but computed here through vm.addr(uint256(keccak256(label))) — the same
        // formula forge-std makeAddr uses internally.
        address[3] memory readers_;
        readers_[0] = address(uint160(uint256(keccak256(abi.encodePacked("reader0")))));
        readers_[1] = address(uint160(uint256(keccak256(abi.encodePacked("reader1")))));
        readers_[2] = address(uint160(uint256(keccak256(abi.encodePacked("reader2")))));

        uint256[3] memory docIds_  = [uint256(1), uint256(2), uint256(3)];
        for (uint256 d; d < 3; d++) {
            for (uint256 r; r < 3; r++) {
                bool locked   = paywall.isUnlocked(docIds_[d], readers_[r]);
                bool document = paywall.isDocumentUnlocked(docIds_[d], readers_[r]);
                assertEq(locked, document,
                    "isUnlocked and isDocumentUnlocked inconsistent");
            }
        }
    }
}
