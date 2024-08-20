import { createMultiOwnerLightAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { LocalAccountSigner, arbitrumSepolia } from "@alchemy/aa-core";
import { encodeFunctionData } from "viem";
import dotenv from "dotenv";

dotenv.config();

const { PRIVATE_KEY, ALCHEMY_API_KEY } = process.env;

const chain = arbitrumSepolia;

// The private key of your EOA that will be the signer of Light Account
const PK = `0x${PRIVATE_KEY}`;

const signer = LocalAccountSigner.privateKeyToAccountSigner(PK);

(async () => {
  const provider = await createMultiOwnerLightAccountAlchemyClient({
    apiKey: ALCHEMY_API_KEY,
    chain,
    signer,
    version: "v2.0.0",
  });

  const address = await provider.getAddress();
  console.log("Smart Account Address:", address);

  const target = "0x819cCB9c09cB3c8733D617dfb7F78F8e2220B8cd";

  // ABI of the SimpleIncrementer contract
  const abi = [
    {
      inputs: [],
      name: "increment",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "getNumber",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "number",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  // Encode the increment function call data
  const data = encodeFunctionData({
    abi,
    functionName: "increment",
    args: [], // No arguments for the increment function
  });

  const { hash: uoHash } = await provider.sendUserOperation({
    uo: {
      target,
      data,
      value: 0n,
    },
  });

  console.log("User Operation Hash:", uoHash);

  const txHash = await provider.waitForUserOperationTransaction({
    hash: uoHash,
  });

  console.log("Transaction Hash:", txHash);
})();
