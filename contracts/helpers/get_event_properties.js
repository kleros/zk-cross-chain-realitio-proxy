const { ethers, network } = require("hardhat");

async function getL1MessageSentEvent(transactionHash, contractInterface) {
  const chainId = network.config.chainId;
  const provider = await getProviderBasedOnChainId(chainId);
  const receipt = await provider.getTransactionReceipt(transactionHash);

  if (!receipt) {
    console.error("Transaction receipt not found.");
    return;
  }

  const topicHash = "0x3a36e47291f4201faf137fab081d92295bce2d53be2c6ca68ba82c7faa9ce241"; // L1MessageSent
  const eventLogs = receipt.logs.filter((log) => log.topics[0] === topicHash);

  if (eventLogs.length === 0) {
    console.log(`No logs found for the specified topic.`);
    return;
  }

  const parsedLog = contractInterface.parseLog(eventLogs[0]);

  return {
    name: parsedLog.name,
    args: parsedLog.values,
    blockNumber: eventLogs[0].blockNumber,
    address: eventLogs[0].topics[1],
    msgHash: eventLogs[0].topics[2],
    data: eventLogs[0].data,
  };
}

async function getProviderBasedOnChainId(chainId) {
  let provider;

  // Switch based on manually specified chain ID
  switch (chainId) {
    case 324: // Mainnet Zk
      provider = new ethers.providers.JsonRpcProvider("https://mainnet.era.zksync.io");
      break;
    case 280: // Goerli Zk
      provider = new ethers.providers.JsonRpcProvider("https://testnet.era.zksync.dev");
      break;
    case 300: // Sepolia Zk
      provider = new ethers.providers.JsonRpcProvider("https://sepolia.era.zksync.dev");
      break;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return provider;
}

module.exports = {
  getL1MessageSentEvent,
};
