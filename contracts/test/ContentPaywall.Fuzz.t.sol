// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContentPaywallTestBase} from "./ContentPaywall.Base.t.sol";
import {ContentPaywall} from "../ContentPaywall.sol";

/// @dev Fuzz and invariant tests for ContentPaywall.
contract ContentPaywallFuzzTest is ContentPaywallTestBase {

    // ══════════════════════════════════════════════════════════════════════════
    // Fuzz: fee-split arithmetic
    // ══════════════════════════════════════════════════════════════════════════

    /// Property: devShare + authorShare == UNLOCK_PRICE for any feePercent in [0, 100].
    /// This validates the fee-split invariant independent of the fixed platformFeePercent.
    function testFuzz_FeeSplitSumsToUnlockPrice(uint256 feePercent) public pure {
        feePercent = bound(feePercent, 0, 100);
        uint256 devShare    = (UNLOCK_PRICE * feePercent) / 100;
        uint256 authorShare = UNLOCK_PRICE - devShare;
        assertEq(devShare + authorShare, UNLOCK_PRICE);
    }

    /// Property: after unlocking, author balance increases by exactly authorShare
    ///           and treasury balance increases by exactly devShare.
    ///           Uses any valid (non-zero, non-paywall, non-deployer) doc ID.
    function testFuzz_UnlockDocument_BalanceSplit(uint256 docId) public {
        // Avoid collision with base constant and ensure non-zero
        docId = bound(docId, 1, type(uint256).max);

        vm.prank(owner);
        paywall.registerDoc(docId, bob);

        usdc.mint(alice, UNLOCK_PRICE);
        vm.prank(alice);
        usdc.approve(address(paywall), UNLOCK_PRICE);

        uint256 authorBefore   = usdc.balanceOf(bob);
        uint256 treasuryBefore = usdc.balanceOf(deployer);

        vm.prank(alice);
        paywall.unlockDocument(docId);

        assertEq(usdc.balanceOf(bob)     - authorBefore,   AUTHOR_SHARE, "author share mismatch");
        assertEq(usdc.balanceOf(deployer) - treasuryBefore, DEV_SHARE,   "dev share mismatch");
    }

    /// Property: a reader can only unlock a given doc once — second attempt always reverts
    ///           regardless of which address calls (fuzz the reader address).
    function testFuzz_UnlockDocument_AlreadyUnlockedReverts(address reader) public {
        vm.assume(reader != address(0));
        vm.assume(reader != address(paywall));

        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        usdc.mint(reader, UNLOCK_PRICE * 2);
        vm.prank(reader);
        usdc.approve(address(paywall), UNLOCK_PRICE * 2);

        vm.prank(reader);
        paywall.unlockDocument(DOC_ID);

        vm.prank(reader);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.AlreadyUnlocked.selector, DOC_ID, reader)
        );
        paywall.unlockDocument(DOC_ID);
    }

    /// Property: registering the same docId twice always reverts with DocAlreadyRegistered.
    function testFuzz_RegisterDoc_DocAlreadyRegisteredReverts(uint256 docId, address author) public {
        vm.assume(author != address(0));

        vm.prank(owner);
        paywall.registerDoc(docId, author);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.DocAlreadyRegistered.selector, docId)
        );
        paywall.registerDoc(docId, author);
    }

    /// Property: updateDocAuthor always stores the newAuthor that was passed in.
    function testFuzz_UpdateDocAuthor_StoresNewAuthor(address newAuthor) public {
        vm.assume(newAuthor != address(0));

        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(owner);
        paywall.updateDocAuthor(DOC_ID, newAuthor);

        assertEq(paywall.getAuthor(DOC_ID), newAuthor);
    }

    /// Property: after setPlatformTreasury the stored value always equals the argument.
    function testFuzz_SetPlatformTreasury_StoresValue(address newTreasury) public {
        vm.assume(newTreasury != address(0));

        vm.prank(owner);
        paywall.setPlatformTreasury(newTreasury);

        assertEq(paywall.platformTreasury(), newTreasury);
    }
}
