import React, { Component } from "react";
import Web3 from "web3";

import RealitioForeignArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioForeignProxy.sol/zkRealitioForeignProxy.json";
import RealitioHomeArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioHomeProxy.sol/zkRealitioHomeProxy.json";
import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/RealitioInterface.sol/RealitioInterface.json";

import RealityLogo from "../assets/images/reality_eth_logo.png";
import { populatedJSONForTemplate } from "@reality.eth/reality-eth-lib/formatters/question";

const CONCURRENT_QUERIES = 20;
const BLOCK_RANGE = 1000;

const REALITY_STARTS_AT = {
  "0x325a2e0f3cca2ddbaebb4dfc38df8d19ca165b47": 6531265, // Reality 2.0 Mainnet
  "0x5b7dd1e86623548af054a4985f7fc8ccbb554e2c": 13194676, // Reality 3.0 Mainnet
  "0x79e32ae03fb27b07c89c0c568f80287c01ca2e57": 14005802, // Reality 2.1 Gnosis
  "0xe78996a233895be74a66f451f1019ca9734205cc": 17997262, // Reality 3.0 Gnosis
  "0x60573b8dce539ae5bf9ad7932310668997ef0428": 18901674, // Reality 3.0 Polygon
  "0x5d18bd4dc5f1ac8e9bd9b666bd71cb35a327c4a9": 459975, // Reality 3.0 ArbitrumOne
  "0xB78396EFaF0a177d125e9d45B2C6398Ac5f803B9": 41977012, // Reality 3.0 ArbitrumSepolia
  "0xaf33dcb6e8c5c4d9ddf579f53031b514d19449ca": 3044431, // Reality 3.0 Sepolia
  "0x4E346436e99fb7d6567A2bd024d8806Fc10d84D2": 255658, // Reality 3.0 zkSyncSepolia
  "0xA8AC760332770FcF2056040B1f964750e4bEf808": 9691, // Reality 3.0 zkSyncMain
  "0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA": 14341474, // Reality 3.0 OptimismSepolia
  "0xc716c23D75f523eF0C511456528F2A1980256a87": 3034954, // Reality 3.0 Redstone
  "0x1E732a1C5e9181622DD5A931Ec6801889ce66185": 10438389 // Realitiy 3.0 Chiado
}

class RealitioDisplayInterface extends Component {
  state = { question: null };

  async componentDidMount() {
    if (window.location.search[0] !== "?") return;

    const message = Object.fromEntries(new URLSearchParams(decodeURIComponent(window.location.search.substring(1))));
    console.debug(message);

    const {
      arbitrableContractAddress,
      disputeID,
      arbitratorChainID,
      arbitrableChainID,
      chainID,
      arbitratorJsonRpcUrl,
      arbitrableJsonRpcUrl,
      jsonRpcUrl,
    } = message;

    console.log(arbitrableContractAddress);
    const rpcURL = arbitrableJsonRpcUrl || arbitratorJsonRpcUrl || jsonRpcUrl;
    const cid = arbitrableChainID || arbitratorChainID || chainID;

    if (!rpcURL || !disputeID || !cid) {
      console.error("Evidence display is missing critical information.");
      return;
    }

    const foreignWeb3 = new Web3(arbitratorJsonRpcUrl || jsonRpcUrl);
    async function getForeignEventLog(contract, event, filter) {
      const latestBlockNumber = await foreignWeb3.eth.getBlock("latest").then((block) => block.number);
      let upperBound = latestBlockNumber;
      let result = [];
      while (result.length === 0 && upperBound > 0) {
        const queries = [];
        for (let i = 1; i <= CONCURRENT_QUERIES; i++) {
          queries.push(
            contract.getPastEvents(event, {
              filter,
              fromBlock: Math.max(upperBound - BLOCK_RANGE, 0),
              toBlock: upperBound,
            })
          );
          upperBound = upperBound - BLOCK_RANGE;
        }
        result = await Promise.all(queries).then((results) => results.flat(Infinity));
      }
      return result;
    }
    const foreignProxy = new foreignWeb3.eth.Contract(RealitioForeignArbitrationProxy.abi, arbitrableContractAddress);

    const homeWeb3 = new Web3(arbitrableJsonRpcUrl || jsonRpcUrl);
    const homeProxy = new homeWeb3.eth.Contract(
      RealitioHomeArbitrationProxy.abi,
      await foreignProxy.methods.homeProxy().call()
    );

    const realitioContractAddress = await homeProxy.methods.realitio().call();
    const realitio = new homeWeb3.eth.Contract(RealitioInterface.abi, realitioContractAddress);

    const blocknumber = await foreignProxy.methods.arbitrationCreatedBlock(disputeID).call();
    const arbitrationCreatedLogs = await foreignProxy.getPastEvents("ArbitrationCreated", {
      filter: { _disputeID: disputeID },
      fromBlock: parseInt(blocknumber),
      toBlock: parseInt(blocknumber)
    });

    if (arbitrationCreatedLogs.length != 1) {
      return rejectScript("Could not find the dispute");
    }

    const questionID = arbitrationCreatedLogs[0].returnValues._questionID;
    const questionEventLog = await realitio.getPastEvents("LogNewQuestion", {
      filter: { question_id: questionID },
      fromBlock: Object.keys(REALITY_STARTS_AT).includes(realitioContractAddress.toLowerCase())
      ? REALITY_STARTS_AT[realitioContractAddress.toLowerCase()]
      : 0,
      toBlock: "latest",
    });

    const templateID = questionEventLog[0].returnValues.template_id;
    let templateText
    if (templateID < 5) {
      // first 5 templates are part of reality.eth spec, hardcode for faster loading
      templateText = ['{"title": "%s", "type": "bool", "category": "%s", "lang": "%s"}',
        '{"title": "%s", "type": "uint", "decimals": 18, "category": "%s", "lang": "%s"}',
        '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
        '{"title": "%s", "type": "multiple-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
        '{"title": "%s", "type": "datetime", "category": "%s", "lang": "%s"}'][templateID]
    } else {
      const templateCreationBlock = await realitio.methods.templates(templateID).call();
      const templateEventLog = await realitio.getPastEvents("LogNewTemplate", {
        filter: { template_id: templateID },
        fromBlock: parseInt(templateCreationBlock),
        toBlock: parseInt(templateCreationBlock),
      });
      templateText = templateEventLog[0].returnValues.question_text;
    }

    console.log(questionEventLog[0].returnValues.question);
    console.log(templateText);
    console.log(
      populatedJSONForTemplate(
        questionEventLog[0].returnValues.question,
        templateText
      )
    );
    this.setState({
      questionID,
      chainID: cid,
      realitioContractAddress,
      rawQuestion: questionEventLog[0].returnValues.question,
      rawTemplate: templateText,
    });
  }

  render() {
    const { questionID, chainID, realitioContractAddress, rawQuestion, rawTemplate } = this.state;
    if (!questionID) return <div />;

    return (
      <div
        style={{
          backgroundColor: "#f0f4f8",
          padding: "16px",
          fontFamily: "Roboto, sans-serif",
        }}
      >
        <div>
          <img src={RealityLogo} alt="Logo of reality.eth" style={{ maxWidth: "100%" }} />
        </div>
        <hr
          style={{
            height: "3px",
            border: "none",
            backgroundSize: "contain",
            color: "#27b4ee",
            background: "linear-gradient(45deg, #24b3ec 0%, #24b3ec 93%, #b9f9fb  93%, #b9f9fb  95%, #dcfb6c 95%)",
          }}
        />
        <div
          style={{
            marginTop: "16px",
            marginBottom: "32px",
            fontSize: "18x",
            lineHeight: "1.4",
            wordBreak: "break-word",
          }}
        >
          {populatedJSONForTemplate(rawTemplate, rawQuestion).title}
        </div>
        <a
          style={{ color: "#2093ff" }}
          href={`https://reality.eth.limo/app/index.html#!/network/${chainID}/question/${realitioContractAddress}-${questionID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          See on reality.eth
        </a>
      </div>
    );
  }
}

export default RealitioDisplayInterface;
