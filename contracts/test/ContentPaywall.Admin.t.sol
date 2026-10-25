// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContentPaywallTestBase} from "./ContentPaywall.Base.t.sol";
import {ContentPaywall} from "../ContentPaywall.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Admin / owner-only function tests for ContentPaywall.
contract ContentPaywallAdminTest is ContentPaywallTestBase {

    // ══════════════════════════════════════════════════════════════════════════
    // registerDoc
    // ══════════════════════════════════════════════════════════════════════════

    function test_RegisterDoc_HappyPath() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        assertEq(paywall.getAuthor(DOC_ID), bob);
        assertEq(paywall.docAuthor(DOC_ID), bob);
    }

    function test_RegisterDoc_EmitsDocRegistered() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(paywall));
        emit ContentPaywall.DocRegistered(DOC_ID, bob);
        paywall.registerDoc(DOC_ID, bob);
    }

    function test_RegisterDoc_RevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        paywall.registerDoc(DOC_ID, bob);
    }

    function test_RegisterDoc_RevertsZeroAuthor() public {
        vm.prank(owner);
        vm.expectRevert(ContentPaywall.ZeroAddress.selector);
        paywall.registerDoc(DOC_ID, address(0));
    }

    function test_RegisterDoc_RevertsDocAlreadyRegistered() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.DocAlreadyRegistered.selector, DOC_ID)
        );
        paywall.registerDoc(DOC_ID, alice);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // updateDocAuthor
    // ══════════════════════════════════════════════════════════════════════════

    function test_UpdateDocAuthor_HappyPath() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(owner);
        paywall.updateDocAuthor(DOC_ID, carol);

        assertEq(paywall.getAuthor(DOC_ID), carol);
    }

    /// updateDocAuthor re-uses the DocRegistered event.
    function test_UpdateDocAuthor_EmitsDocRegistered() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(paywall));
        emit ContentPaywall.DocRegistered(DOC_ID, carol);
        paywall.updateDocAuthor(DOC_ID, carol);
    }

    function test_UpdateDocAuthor_RevertsNonOwner() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        paywall.updateDocAuthor(DOC_ID, carol);
    }

    function test_UpdateDocAuthor_RevertsZeroNewAuthor() public {
        vm.prank(owner);
        paywall.registerDoc(DOC_ID, bob);

        vm.prank(owner);
        vm.expectRevert(ContentPaywall.ZeroAddress.selector);
        paywall.updateDocAuthor(DOC_ID, address(0));
    }

    function test_UpdateDocAuthor_RevertsDocNotFound() public {
        // DOC_ID was never registered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(ContentPaywall.DocNotFound.selector, DOC_ID)
        );
        paywall.updateDocAuthor(DOC_ID, carol);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // setPlatformTreasury
    // ══════════════════════════════════════════════════════════════════════════

    function test_SetPlatformTreasury_HappyPath() public {
        vm.prank(owner);
        paywall.setPlatformTreasury(carol);

        assertEq(paywall.platformTreasury(), carol);
    }

    function test_SetPlatformTreasury_EmitsPlatformTreasuryUpdated() public {
        address oldTreasury = paywall.platformTreasury(); // deployer

        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(paywall));
        emit ContentPaywall.PlatformTreasuryUpdated(oldTreasury, carol);
        paywall.setPlatformTreasury(carol);
    }

    function test_SetPlatformTreasury_RevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        paywall.setPlatformTreasury(carol);
    }

    function test_SetPlatformTreasury_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(ContentPaywall.ZeroAddress.selector);
        paywall.setPlatformTreasury(address(0));
    }
}
