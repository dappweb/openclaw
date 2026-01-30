// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentNFT
 * @dev ERC-721 NFT contract for OpenClaw AI Agents (ERC-8004 Identity Registry)
 *
 * Each AI Agent gets a unique NFT representing its on-chain identity.
 * This follows the ERC-8004 Trustless Agents standard for decentralized
 * agent identity management.
 */
contract AgentNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable, Pausable {
    // Token ID counter (starts at 1 to avoid confusion with zero)
    uint256 private _tokenIdCounter = 1;

    // Mapping from token ID to agent ID
    mapping(uint256 => string) private _agentIds;

    // Mapping from agent ID to token ID (0 means not minted)
    mapping(string => uint256) private _agentIdToToken;

    // Mapping to track if agent ID has been used
    mapping(string => bool) private _agentIdUsed;

    // Base URI for metadata
    string private _baseTokenURI;

    // Events
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string agentId);
    event AgentMetadataUpdated(uint256 indexed tokenId, string newURI);
    event BaseURIUpdated(string newBaseURI);

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Mint a new Agent NFT (restricted to owner/authorized minters)
     * @param to Address to mint the NFT to
     * @param agentId Unique identifier for the agent
     * @param metadataURI URI for the agent's metadata
     * @return tokenId The ID of the minted token
     */
    function mint(
        address to,
        string memory agentId,
        string memory metadataURI
    ) public onlyOwner whenNotPaused returns (uint256) {
        require(bytes(agentId).length > 0, "Agent ID cannot be empty");
        require(!_agentIdUsed[agentId], "Agent already has an NFT");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        _agentIds[tokenId] = agentId;
        _agentIdToToken[agentId] = tokenId;
        _agentIdUsed[agentId] = true;

        emit AgentMinted(tokenId, to, agentId);

        return tokenId;
    }

    /**
     * @dev Get the agent ID for a token
     */
    function getAgentId(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _agentIds[tokenId];
    }

    /**
     * @dev Get the token ID for an agent
     */
    function getTokenByAgentId(string memory agentId) public view returns (uint256) {
        require(_agentIdUsed[agentId], "Agent does not have an NFT");
        uint256 tokenId = _agentIdToToken[agentId];
        require(_ownerOf(tokenId) != address(0), "Token no longer exists");
        return tokenId;
    }

    /**
     * @dev Check if a token exists
     */
    function exists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @dev Update token metadata URI (owner only)
     */
    function setTokenURI(uint256 tokenId, string memory uri) public {
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        _setTokenURI(tokenId, uri);
        emit AgentMetadataUpdated(tokenId, uri);
    }

    /**
     * @dev Set base URI for all tokens
     */
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /**
     * @dev Pause minting
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause minting
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    // Required overrides

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
