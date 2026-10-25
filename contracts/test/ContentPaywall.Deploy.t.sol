// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContentPaywallTestBase} from "./ContentPaywall.Base.t.sol";
import {ContentPaywall} from "../ContentPaywall.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// NOTE (CONTRACT BUG – LOW): The `if (_initialOwner == address(0)) revert ZeroAddress()`
// guard in the constructor body is unreachable: Ownable(_initialOwner) in the base-
// constructor list fires first and reverts with OwnableInvalidOwner(address(0)).
// The ZeroAddress path for the owner case is dead code.  The test below asserts the
// *actual* revert (OwnableInvalidOwner) so the suite stays green; the bug is reported.

/// @dev Deployment & initialisation tests for ContentPaywall.
contract ContentPaywallDeployTest is ContentPaywallTestBase {

    // ── Constructor happy paths ───────────────────────────────────────────────

    function test_Deploy_UsdcTokenStored() public view {
        assertEq(address(paywall.usdcToken()), address(usdc));
    }

    function test_Deploy_OwnerIsInitialOwner() public view {
        assertEq(paywall.owner(), owner);
    }

    /// platformTreasury = msg.sender in constructor, which is `deployer`, NOT `owner`.
    function test_Deploy_PlatformTreasuryIsDeployer() public view {
        assertEq(paywall.platformTreasury(), deployer);
    }

    function test_Deploy_PlatformFeePercentIsTwo() public view {
        assertEq(paywall.platformFeePercent(), 2);
    }

    function test_Deploy_UnlockPriceConstant() public view {
        assertEq(paywall.UNLOCK_PRICE(), UNLOCK_PRICE);
    }

    // ── Constructor revert paths ──────────────────────────────────────────────

    function test_Deploy_RevertsOnZeroUsdcAddress() public {
        vm.expectRevert(ContentPaywall.ZeroAddress.selector);
        new ContentPaywall(address(0), owner);
    }

    /// The contract's own ZeroAddress guard for _initialOwner is unreachable because
    /// Ownable(address(0)) in the base-constructor fires first with OwnableInvalidOwner.
    /// This test documents the *actual* behaviour; see the CONTRACT BUG note at the top.
    function test_Deploy_RevertsOnZeroOwnerAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0))
        );
        new ContentPaywall(address(usdc), address(0));
    }
}
