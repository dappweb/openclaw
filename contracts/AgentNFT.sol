// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AgentNFT
 * @dev ERC-721 NFT contract for OpenClaw AI Agents (ERC-8004 Identity Registry)
 *
 * Each AI Agent gets a unique NFT representing its on-chain identity.
 * This follows the ERC-8004 Trustless Agents standard for decentralized
 * agent identity management.
 */
contract AgentNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable, Pausable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // Mapping from token ID to agent ID
    mapping(uint256 => string) private _agentIds;

    // Mapping from agent ID to token ID (for reverse lookup)
    mapping(string => uint256) private _agentIdToToken;

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
     * @dev Mint a new Agent NFT
     * @param to Address to mint the NFT to
     * @param agentId Unique identifier for the agent
     * @param metadataURI URI for the agent's metadata
     * @return tokenId The ID of the minted token
     */
    function mint(
        address to,
        string memory agentId,
        string memory metadataURI
    ) public whenNotPaused returns (uint256) {
        require(bytes(agentId).length > 0, "Agent ID cannot be empty");
        require(_agentIdToToken[agentId] == 0 || !_exists(_agentIdToToken[agentId]), "Agent already has an NFT");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        _agentIds[tokenId] = agentId;
        _agentIdToToken[agentId] = tokenId;

        emit AgentMinted(tokenId, to, agentId);

        return tokenId;
    }

    /**
     * @dev Get the agent ID for a token
     */
    function getAgentId(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _agentIds[tokenId];
    }

    /**
     * @dev Get the token ID for an agent
     */
    function getTokenByAgentId(string memory agentId) public view returns (uint256) {
        uint256 tokenId = _agentIdToToken[agentId];
        require(tokenId != 0 && _exists(tokenId), "Agent does not have an NFT");
        return tokenId;
    }

    /**
     * @dev Check if a token exists
     */
    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
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

    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenId > 0 && tokenId <= _tokenIdCounter.current() && _ownerOf(tokenId) != address(0);
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
