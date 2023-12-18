const { ethers } = require("ethers");
const { Provider, utils } = require("zksync-web3");
const { getL1MessageSentEvent } = require("../helpers/get_event_properties");

// https://era.zksync.io/docs/dev/how-to/send-message-l2-l1.html

// Input the relevant tx hash.
const txHash = "0xbefad5cf0625dca966dc507f87f2ba1d0cbd8e63d0faac866128e554113b17f8";

// TODO: automatically call consumeMessageFromL2
async function getL2MessageProof(blockNumber, l2Provider, homeProxy, msgHash) {
  console.log(`Getting L2 message proof for block ${blockNumber}`);
  return await l2Provider.getMessageProof(blockNumber, homeProxy, msgHash);
}

async function proveL2MessageInclusion(l1BatchNumber, proof, trxIndex, l1Provider, l2Provider, homeProxy, message) {
  const zkAddress = await l2Provider.getMainContractAddress();

  const mailboxL1Contract = new ethers.Contract(zkAddress, utils.ZKSYNC_MAIN_ABI, l1Provider);
  const messageInfo = {
    txNumberInBlock: trxIndex,
    sender: homeProxy,
    data: message,
  };

  console.log(`Retrieving proof for batch ${l1BatchNumber}, transaction index ${trxIndex} and proof id ${proof.id}`);
  const res = await mailboxL1Contract.proveL2MessageInclusion(l1BatchNumber, proof.id, messageInfo, proof.proof);

  return res;
}

async function main() {
  const { providers } = ethers;
  const foreignNetworks = {
    280: hre.config.networks.goerli,
    324: hre.config.networks.mainnet,
    300: hre.config.networks.sepolia,
  };

  const chainId = hre.network.config.chainId;
  const { url } = foreignNetworks[chainId];

  const l1Provider = new providers.JsonRpcProvider(url);
  const l2Provider = new Provider(hre.network.config.url);

  const l1MessageSentEvent = await getL1MessageSentEvent(txHash, utils.L1_MESSENGER);

  if (!l1MessageSentEvent) {
    throw new Error("No L1MessageSent event found in the transaction.");
  }

  const blockNumber = l1MessageSentEvent.blockNumber;
  const homeProxy = "0x" + BigInt(l1MessageSentEvent.address).toString(16);
  const msgHash = l1MessageSentEvent.msgHash;
  const eventData = l1MessageSentEvent.data;

  console.log(`Event: ${l1MessageSentEvent.name}`);
  console.log("Block Number:", blockNumber);
  console.log("Smart Contract Address:", homeProxy);
  console.log("Hash:", msgHash);
    // TODO: generate message yourself instead of obtaining it, since the obtained version can differ from the actual message sent.
  console.log("Message:", eventData);

  const proof = await getL2MessageProof(blockNumber, l2Provider, homeProxy, msgHash);
  console.log(`Proof is: `, proof);
  const { l1BatchNumber, l1BatchTxIndex } = await l2Provider.getTransactionReceipt(txHash);

  console.log("L1 Index for Tx in block :>> ", l1BatchTxIndex);
  console.log("L1 Batch for block :>> ", l1BatchNumber);

  const result = await proveL2MessageInclusion(
    l1BatchNumber,
    proof,
    l1BatchTxIndex,
    l1Provider,
    l2Provider,
    homeProxy,
    eventData
  );

  console.log("Result is :>> ", result);
  process.exit();
}

try {
  main();
} catch (error) {
  console.error(error);
}
