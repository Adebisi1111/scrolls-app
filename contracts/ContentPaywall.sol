// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ContentPaywall
/// @notice Per-document USDC paywall with author/platform fee split.
///         Owner registers documents (docId → author wallet); readers pay 0.50 USDC to unlock.
contract ContentPaywall is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ───────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error DocNotFound(uint256 docId);
    error AlreadyUnlocked(uint256 docId, address reader);
    error DocAlreadyRegistered(uint256 docId);

    // ── Constants ────────────────────────────────────────────────────────────────
    uint256 public constant UNLOCK_PRICE = 500_000; // 0.50 USDC (6 decimals)

    // ── Immutables ───────────────────────────────────────────────────────────────
    IERC20 public immutable usdcToken;

    // ── State ────────────────────────────────────────────────────────────────────
    address public platformTreasury;
    uint256 public platformFeePercent = 2;
    mapping(uint256 => address) public docAuthor;
    mapping(uint256 => mapping(address => bool)) public isUnlocked;

    // ── Events ───────────────────────────────────────────────────────────────────
    event DocRegistered(uint256 indexed docId, address indexed author);
    event DocumentUnlocked(
        uint256 indexed docId,
        address indexed reader,
        address indexed author,
        uint256 authorShare,
        uint256 devShare
    );
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ── Constructor ──────────────────────────────────────────────────────────────
    constructor(address _usdcToken, address _initialOwner) Ownable(_initialOwner) {
        if (_usdcToken == address(0) || _initialOwner == address(0)) {
            revert ZeroAddress();
        }
        usdcToken = IERC20(_usdcToken);
        platformTreasury = msg.sender;
    }

    // ── Owner functions ──────────────────────────────────────────────────────────

    /// @notice Register a document and its author. Anyone can register;
    ///         the caller sets the payout address for their own document.
    ///         Once registered a docId cannot be re-registered (use updateDocAuthor to change).
    function registerDoc(uint256 docId, address author) external {
        if (author == address(0)) revert ZeroAddress();
        if (docAuthor[docId] != address(0)) revert DocAlreadyRegistered(docId);
        docAuthor[docId] = author;
        emit DocRegistered(docId, author);
    }

    /// @notice Update the author address for a registered doc (e.g. if prior address is blocklisted).
    function updateDocAuthor(uint256 docId, address newAuthor) external onlyOwner {
        if (newAuthor == address(0)) revert ZeroAddress();
        if (docAuthor[docId] == address(0)) revert DocNotFound(docId);
        docAuthor[docId] = newAuthor;
        emit DocRegistered(docId, newAuthor);
    }

    function setPlatformTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        emit PlatformTreasuryUpdated(platformTreasury, _newTreasury);
        platformTreasury = _newTreasury;
    }

    // ── Public functions ─────────────────────────────────────────────────────────

    /// @notice Pay 0.50 USDC to unlock a document.
    function unlockDocument(uint256 docId) external nonReentrant {
        address author = docAuthor[docId];
        if (author == address(0)) revert DocNotFound(docId);
        if (isUnlocked[docId][msg.sender]) revert AlreadyUnlocked(docId, msg.sender);

        uint256 devShare = (UNLOCK_PRICE * platformFeePercent) / 100;
        uint256 authorShare = UNLOCK_PRICE - devShare;

        usdcToken.safeTransferFrom(msg.sender, author, authorShare);
        usdcToken.safeTransferFrom(msg.sender, platformTreasury, devShare);

        isUnlocked[docId][msg.sender] = true;

        emit DocumentUnlocked(docId, msg.sender, author, authorShare, devShare);
    }

    // ── View functions ───────────────────────────────────────────────────────────

    function getAuthor(uint256 docId) external view returns (address) {
        return docAuthor[docId];
    }

    function isDocumentUnlocked(uint256 docId, address reader) external view returns (bool) {
        return isUnlocked[docId][reader];
    }
}
