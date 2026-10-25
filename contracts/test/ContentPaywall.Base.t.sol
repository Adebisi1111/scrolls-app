// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ContentPaywall} from "../ContentPaywall.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared fixtures for all ContentPaywall test categories.
///      No test_ / testFuzz_ / invariant_ functions here — they would
///      run once per inheriting file and double-count results.
abstract contract ContentPaywallTestBase is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    /// Deployer of the contract: becomes platformTreasury (msg.sender in constructor).
    address internal deployer    = makeAddr("deployer");
    /// Passed as _initialOwner: becomes the Ownable owner.
    address internal owner       = makeAddr("owner");
    address internal alice       = makeAddr("alice");   // reader
    address internal bob         = makeAddr("bob");     // author
    address internal carol       = makeAddr("carol");   // second reader / new treasury

    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 internal constant UNLOCK_PRICE      = 500_000; // 0.50 USDC (6 dec)
    uint256 internal constant PLATFORM_FEE_PCT  = 2;
    uint256 internal constant DEV_SHARE         = (UNLOCK_PRICE * PLATFORM_FEE_PCT) / 100; // 10_000
    uint256 internal constant AUTHOR_SHARE      = UNLOCK_PRICE - DEV_SHARE;                // 490_000
    uint256 internal constant DOC_ID            = 42;
    uint256 internal constant DOC_ID_2          = 99;

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockERC20       internal usdc;
    ContentPaywall  internal paywall;

    // ── setUp ─────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        // Deploy mock USDC
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // Deploy paywall: deployer becomes platformTreasury, owner becomes Ownable owner
        vm.prank(deployer);
        paywall = new ContentPaywall(address(usdc), owner);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Register DOC_ID → bob as owner and approve paywall to spend UNLOCK_PRICE on behalf of alice.
    function _registerAndApprove(address reader) internal {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        usdc.mint(reader, UNLOCK_PRICE);
        vm.prank(reader);
        usdc.approve(address(paywall), UNLOCK_PRICE);
    }
}
