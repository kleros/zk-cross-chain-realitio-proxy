import React, { Component } from "react";
import Web3 from "web3";

import RealitioForeignArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioForeignProxy.sol/zkRealitioForeignProxy.json";
import RealitioHomeArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioHomeProxy.sol/zkRealitioHomeProxy.json";
import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts-zk/src/RealitioInterface.sol/RealitioInterface.json";

import RealityLogo from "../assets/images/reality_eth_logo.png";
import { populatedJSONForTemplate } from "@reality.eth/reality-eth-lib/formatters/question";

const CONCURRENT_QUERIES = 100;
const BLOCK_RANGE = 1000;

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

    const arbitrationCreatedLogs = await getForeignEventLog(foreignProxy, "ArbitrationCreated", { _disputeID: disputeID });

    const questionID = arbitrationCreatedLogs[0].returnValues._questionID;
    const questionEventLog = await realitio.getPastEvents("LogNewQuestion", {
      filter: { question_id: questionID },
      fromBlock: 0,
      toBlock: "latest",
    });

    const templateID = questionEventLog[0].returnValues.template_id;

    // seer only uses templates 1, 2 and 3, so hardcoding the templates that are part of the
    // reality spec is acceptable (only for Seer)
    const templateText = ['{"title": "%s", "type": "bool", "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "uint", "decimals": 18, "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "multiple-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "datetime", "category": "%s", "lang": "%s"}'][templateID]

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
