// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DocumentPaywall is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error DocNotFound(uint256 docId);
    error AlreadyUnlocked(uint256 docId, address reader);
    error DocAlreadyRegistered(uint256 docId);

    uint256 public constant UNLOCK_PRICE = 500_000;
    uint256 public constant PLATFORM_BPS = 200;

    IERC20 public immutable usdcToken;
    address public immutable platform;

    mapping(uint256 => address) public docAuthor;
    mapping(uint256 => mapping(address => bool)) public isUnlocked;

    event DocumentUnlocked(
        uint256 indexed docId,
        address indexed reader,
        address indexed author,
        uint256 authorAmount,
        uint256 platformAmount
    );
    event DocRegistered(uint256 indexed docId, address indexed author);

    constructor(address _usdcToken, address _platform) Ownable(msg.sender) {
        if (_usdcToken == address(0) || _platform == address(0)) {
            revert ZeroAddress();
        }

        usdcToken = IERC20(_usdcToken);
        platform = _platform;
    }

    function registerDoc(uint256 docId, address author) external onlyOwner {
        if (author == address(0)) {
            revert ZeroAddress();
        }
        if (docAuthor[docId] != address(0)) {
            revert DocAlreadyRegistered(docId);
        }

        docAuthor[docId] = author;
        emit DocRegistered(docId, author);
    }

    function unlockDocument(uint256 docId) external nonReentrant {
        address author = docAuthor[docId];
        if (author == address(0)) {
            revert DocNotFound(docId);
        }
        if (isUnlocked[docId][msg.sender]) {
            revert AlreadyUnlocked(docId, msg.sender);
        }

        uint256 authorAmount = (UNLOCK_PRICE * (10_000 - PLATFORM_BPS)) / 10_000;
        uint256 platformAmount = UNLOCK_PRICE - authorAmount;

        usdcToken.safeTransferFrom(msg.sender, author, authorAmount);
        usdcToken.safeTransferFrom(msg.sender, platform, platformAmount);

        isUnlocked[docId][msg.sender] = true;

        emit DocumentUnlocked(docId, msg.sender, author, authorAmount, platformAmount);
    }

    function getAuthor(uint256 docId) external view returns (address) {
        return docAuthor[docId];
    }
}
