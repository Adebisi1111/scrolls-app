// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContentPaywallTestBase} from "./ContentPaywall.Base.t.sol";
import {ContentPaywall} from "../ContentPaywall.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev unlockDocument happy-path, revert, and event tests for ContentPaywall.
contract ContentPaywallUnlockTest is ContentPaywallTestBase {

    // ══════════════════════════════════════════════════════════════════════════
    // unlockDocument — happy paths
    // ══════════════════════════════════════════════════════════════════════════

    function test_UnlockDocument_SetsIsUnlocked() public {
        _registerAndApprove(alice);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertTrue(paywall.isUnlocked(DOC_ID, alice));
        assertTrue(paywall.isDocumentUnlocked(DOC_ID, alice));
    }

    function test_UnlockDocument_AuthorReceivesAuthorShare() public {
        _registerAndApprove(alice);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertEq(usdc.balanceOf(bob), bobBefore + AUTHOR_SHARE);
    }

    function test_UnlockDocument_TreasuryReceivesDevShare() public {
        _registerAndApprove(alice);

        uint256 treasuryBefore = usdc.balanceOf(deployer);
        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertEq(usdc.balanceOf(deployer), treasuryBefore + DEV_SHARE);
    }

    function test_UnlockDocument_ReaderBalanceDecreases() public {
        _registerAndApprove(alice);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertEq(usdc.balanceOf(alice), aliceBefore - UNLOCK_PRICE);
    }

    function test_UnlockDocument_TotalTransferredEqualsUnlockPrice() public {
        _registerAndApprove(alice);

        uint256 authorBefore   = usdc.balanceOf(bob);
        uint256 treasuryBefore = usdc.balanceOf(deployer);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        uint256 totalReceived =
            (usdc.balanceOf(bob) - authorBefore) +
            (usdc.balanceOf(deployer) - treasuryBefore);
        assertEq(totalReceived, UNLOCK_PRICE);
    }

    function test_UnlockDocument_EmitsDocumentUnlocked() public {
        _registerAndApprove(alice);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(paywall));
        emit ContentPaywall.DocumentUnlocked(DOC_ID, alice, bob, AUTHOR_SHARE, DEV_SHARE);
        paywall.unlockDocument(DOC_ID);
    }

    /// Two different readers can each unlock the same doc independently.
    function test_UnlockDocument_TwoReadersIndependent() public {
        _registerAndApprove(alice);

        // Also set up carol as a second reader
        usdc.mint(carol, UNLOCK_PRICE);
        vm.prank(carol);
        usdc.approve(address(paywall), UNLOCK_PRICE);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        vm.prank(carol);
        paywall.unlockDocument(DOC_ID);

        assertTrue(paywall.isUnlocked(DOC_ID, alice));
        assertTrue(paywall.isUnlocked(DOC_ID, carol));
    }

    /// Unlocking one doc does NOT affect unlock state of another doc for the same reader.
    function test_UnlockDocument_IsolatedPerDoc() public {
        _registerAndApprove(alice);

        // Register a second doc
        vm.prank(owner);
        paywall.registerDoc(DOC_ID_2, carol);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertFalse(paywall.isUnlocked(DOC_ID_2, alice));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // unlockDocument — revert paths
    // ══════════════════════════════════════════════════════════════════════════

    function test_UnlockDocument_RevertsDocNotFound() public {
        // DOC_ID never registered
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.DocNotFound.selector, DOC_ID)
        );
        paywall.unlockDocument(DOC_ID);
    }

    function test_UnlockDocument_RevertsAlreadyUnlocked() public {
        _registerAndApprove(alice);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        // Second unlock attempt — no funds needed, should revert before transfer
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.AlreadyUnlocked.selector, DOC_ID, alice)
        );
        paywall.unlockDocument(DOC_ID);
    }

    function test_UnlockDocument_RevertsInsufficientAllowance() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        usdc.mint(alice, UNLOCK_PRICE);
        // Intentionally do NOT approve — SafeERC20 will revert
        vm.prank(alice);
        vm.expectRevert();
        paywall.unlockDocument(DOC_ID);
    }

    function test_UnlockDocument_RevertsInsufficientBalance() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        // Approve but mint less than UNLOCK_PRICE
        vm.prank(alice);
        usdc.approve(address(paywall), UNLOCK_PRICE);
        // alice has 0 balance — SafeERC20 will revert
        vm.prank(alice);
        vm.expectRevert();
        paywall.unlockDocument(DOC_ID);
    }

    /// After a failed unlock attempt, isUnlocked must remain false.
    function test_UnlockDocument_StateNotMutatedOnRevert() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);
        // No approval → will revert

        vm.prank(alice);
        try paywall.unlockDocument(DOC_ID) {
            // should not reach here
        } catch {}

        assertFalse(paywall.isUnlocked(DOC_ID, alice));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // View helpers
    // ══════════════════════════════════════════════════════════════════════════

    function test_GetAuthor_ReturnsZeroForUnregistered() public view {
        assertEq(paywall.getAuthor(DOC_ID), address(0));
    }

    function test_IsUnlocked_FalseBeforeUnlock() public {
        _registerAndApprove(alice);
        assertFalse(paywall.isUnlocked(DOC_ID, alice));
        assertFalse(paywall.isDocumentUnlocked(DOC_ID, alice));
    }

    /// isUnlocked and isDocumentUnlocked must return the same value.
    function test_IsUnlockedAndIsDocumentUnlockedAreConsistent() public {
        _registerAndApprove(alice);

        vm.prank(alice);
        paywall.unlockDocument(DOC_ID);

        assertEq(
            paywall.isUnlocked(DOC_ID, alice),
            paywall.isDocumentUnlocked(DOC_ID, alice)
        );
    }
}
