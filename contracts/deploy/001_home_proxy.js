const { utils, Wallet } = require("zksync-web3");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { ethers } = require("hardhat");
const getContractAddress = require("../helpers/get_contracts_address.js");

const paramsByChainId = {
  280: {
    realitio: "0xFAD6e5e3a9421B9de71A517122D3Bb39A57D6FF5",
    foreignChainId: 5,
  },
  324: {
    realitio: "0xA8AC760332770FcF2056040B1f964750e4bEf808",
    foreignChainId: 1,
  },
  300: {
    realitio: "0x4E346436e99fb7d6567A2bd024d8806Fc10d84D2",
    foreignChainId: 11155111,
  }
};
const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}'; // Same for all chains.

module.exports = async function () {
  console.log(`Running deployment script for home proxy contract`);

  const { providers } = ethers;
  const foreignNetworks = {
    280: hre.config.networks.goerli,
    300: hre.config.networks.sepolia,
    324: hre.config.networks.mainnet,
  };

  const chainId = hre.network.config.chainId;
  const { url } = foreignNetworks[chainId];
  const foreignChainProvider = new providers.JsonRpcProvider(url);

  const [account] = await ethers.getSigners();

  const nonce = await foreignChainProvider.getTransactionCount(account.address);
  console.log(`Nonce: ${nonce}`);
  const foreignProxy = getContractAddress(account.address, nonce);
  console.log(`Foreign proxy: ${foreignProxy}`);

  const { foreignChainId, realitio } = paramsByChainId[chainId];

  const alias = utils.applyL1ToL2Alias(foreignProxy);
  console.log(`Proxy alias: ${alias}`);

  const wallet = new Wallet(process.env.PRIVATE_KEY);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("zkRealitioHomeProxy");

  const homeProxy = await deployer.deploy(artifact, [realitio, foreignChainId, foreignProxy, alias, metadata]);
  const contractAddress = homeProxy.address;
  console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
};