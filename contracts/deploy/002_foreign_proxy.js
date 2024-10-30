const { ethers } = require("hardhat");

const paramsByChainId = {
  5: {
    arbitrator: "0x1128eD55ab2d796fa92D2F8E1f336d745354a77A", // KlerosLiquid on Goerli
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    zkAddress: "0x1908e2BF4a88F91E4eF0DC72f02b8Ea36BEa2319",
    metaEvidence: "/ipfs/QmYPjqubn4YadZo5BwvDcNmcfDnhSD5KTAoKFKgcEtFBKu/realitio.json",
  },
  11155111: {
    arbitrator: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879", // KlerosLiquid on Sepolia
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    zkAddress: "0x9A6DE0f62Aa270A8bCB1e2610078650D539B1Ef9",
    metaEvidence: "/ipfs/QmPieAoDBaFYdoZUeZv7xgrpmcGxzDkFCvBG2SixqSfcRe",
  },
  1: {
    arbitrator: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid address
    arbitratorExtraData:
      "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f", // General Court - 31 jurors
    zkAddress: "0x32400084C286CF3E17e7B677ea9583e60a000324",
    metaEvidence: "TODO", // Need to reupload with different chain ids.
  },
};

const surplus = ethers.utils.parseUnits("0.03", "ether"); // The surplus will be automatically reimbursed when the dispute is created.
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;
const l2GasLimit = 1500000;
const l2GasPerPubdataByteLimit = 800;

async function main() {
  console.log("Starting foreign proxy deployment..");
  const chainId = hre.network.config.chainId;
  const { arbitrator, arbitratorExtraData, zkAddress, metaEvidence } = paramsByChainId[chainId];
  let governor;
  if (chainId === 1) {
    governor = "TODO"; // Determine later
  } else {
    governor = (await ethers.getSigners())[0].address;
  }

  const ForeignProxy = await ethers.getContractFactory("zkRealitioForeignProxy");
  const foreignProxy = await ForeignProxy.deploy(
    governor,
    arbitrator,
    arbitratorExtraData,
    zkAddress,
    l2GasLimit,
    l2GasPerPubdataByteLimit,
    surplus,
    metaEvidence,
    winnerMultiplier,
    loserMultiplier,
    loserAppealPeriodMultiplier
  );
  await foreignProxy.deployed();

  console.log(`Foreign proxy contract was successfully deployed at ${foreignProxy.address}`);

  // Note that the home proxy should be manually linked post-deployment using setHomeProxy()

  // TODO: link them automatically. Currently hardhat-zksync-deploy doesn't save to deployments folder so it's problematic.
  // getContractAddress helper also isn't useful because you need a specific nonce used for deploys, instead of a regular nonce.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});